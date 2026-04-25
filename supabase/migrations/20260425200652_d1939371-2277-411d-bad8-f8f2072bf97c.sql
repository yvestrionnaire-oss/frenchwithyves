-- 1. Add guest fields & make student_id nullable
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS lesson_type text NOT NULL DEFAULT 'regular';

ALTER TABLE public.lessons ALTER COLUMN student_id DROP NOT NULL;

-- 2. Guest booking RPC — no auth, no credits
CREATE OR REPLACE FUNCTION public.book_guest_lessons(
  _guest_name text,
  _guest_email text,
  _slots timestamptz[],
  _lesson_type text DEFAULT 'regular',
  _duration_minutes int DEFAULT 60
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slot timestamptz;
  _dow int;
  _t time;
  _new_id uuid;
  _ids uuid[] := ARRAY[]::uuid[];
  _email text;
  _name text;
BEGIN
  IF _slots IS NULL OR array_length(_slots, 1) IS NULL THEN
    RAISE EXCEPTION 'No slots provided' USING errcode = 'P0001';
  END IF;

  _email := lower(trim(_guest_email));
  _name := trim(_guest_name);

  IF _email = '' OR _email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'Valid email required' USING errcode = 'P0001';
  END IF;
  IF _name = '' THEN
    RAISE EXCEPTION 'Name required' USING errcode = 'P0001';
  END IF;
  IF _lesson_type NOT IN ('trial', 'regular') THEN
    RAISE EXCEPTION 'Invalid lesson type' USING errcode = 'P0001';
  END IF;

  -- Trial: only one slot allowed; and only if this email has never booked a trial
  IF _lesson_type = 'trial' THEN
    IF array_length(_slots, 1) <> 1 THEN
      RAISE EXCEPTION 'Trial booking allows only 1 slot' USING errcode = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.lessons
      WHERE lower(guest_email) = _email
        AND lesson_type = 'trial'
        AND status <> 'cancelled'
    ) THEN
      RAISE EXCEPTION 'A trial lesson already exists for this email' USING errcode = 'P0004';
    END IF;
  END IF;

  -- Validate every slot first
  FOREACH _slot IN ARRAY _slots LOOP
    _dow := extract(dow from _slot)::int;
    _t := _slot::time;

    IF _slot < now() THEN
      RAISE EXCEPTION 'Cannot book past slot: %', _slot USING errcode = 'P0001';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.availability_rules
      WHERE day_of_week = _dow AND slot_time = _t
    ) THEN
      RAISE EXCEPTION 'Slot not available: %', _slot USING errcode = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.lessons
      WHERE scheduled_at = _slot AND status <> 'cancelled'
    ) THEN
      RAISE EXCEPTION 'Slot already booked: %', _slot USING errcode = 'P0002';
    END IF;
  END LOOP;

  -- Insert all
  FOREACH _slot IN ARRAY _slots LOOP
    INSERT INTO public.lessons
      (student_id, scheduled_at, guest_name, guest_email, lesson_type, duration_minutes)
    VALUES
      (NULL, _slot, _name, _email, _lesson_type,
       CASE WHEN _lesson_type = 'trial' THEN 30 ELSE _duration_minutes END)
    RETURNING id INTO _new_id;
    _ids := array_append(_ids, _new_id);
  END LOOP;

  RETURN _ids;
END;
$$;

-- 3. Guest reschedule RPC — requires email match
CREATE OR REPLACE FUNCTION public.reschedule_guest_lesson(
  _lesson_id uuid,
  _guest_email text,
  _new_slot timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current timestamptz;
  _email_on_file text;
  _dow int;
  _t time;
BEGIN
  SELECT scheduled_at, lower(guest_email) INTO _current, _email_on_file
  FROM public.lessons
  WHERE id = _lesson_id AND status = 'scheduled';

  IF _current IS NULL THEN
    RAISE EXCEPTION 'Lesson not found' USING errcode = 'P0001';
  END IF;

  IF _email_on_file IS DISTINCT FROM lower(trim(_guest_email)) THEN
    RAISE EXCEPTION 'Email does not match the booking' USING errcode = 'P0001';
  END IF;

  IF _current - now() < interval '5 minutes' THEN
    RAISE EXCEPTION 'Too late to reschedule (must be 5+ minutes before start)'
      USING errcode = 'P0003';
  END IF;

  IF _new_slot < now() THEN
    RAISE EXCEPTION 'Cannot reschedule to a past slot' USING errcode = 'P0001';
  END IF;

  _dow := extract(dow from _new_slot)::int;
  _t := _new_slot::time;

  IF NOT EXISTS (SELECT 1 FROM public.availability_rules WHERE day_of_week = _dow AND slot_time = _t) THEN
    RAISE EXCEPTION 'New slot not available' USING errcode = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.lessons
    WHERE scheduled_at = _new_slot AND status <> 'cancelled' AND id <> _lesson_id
  ) THEN
    RAISE EXCEPTION 'New slot already booked' USING errcode = 'P0002';
  END IF;

  UPDATE public.lessons SET scheduled_at = _new_slot WHERE id = _lesson_id;
END;
$$;

-- 4. RLS — allow anon to read upcoming lessons (already set), keep insert/update via RPCs only.
-- The existing "demo: anyone can read lessons" SELECT policy is fine for the public booking grid.
-- We do NOT add a public INSERT policy on lessons; bookings go through the SECURITY DEFINER RPCs.

GRANT EXECUTE ON FUNCTION public.book_guest_lessons(text, text, timestamptz[], text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_guest_lesson(uuid, text, timestamptz) TO anon, authenticated;