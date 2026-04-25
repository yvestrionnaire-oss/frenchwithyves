
-- Drop FKs to auth.users so we can seed a demo student without auth signup
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_student_id_fkey;
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_student_id_fkey;

-- Add Google Calendar columns to lessons
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS meet_link text,
  ADD COLUMN IF NOT EXISTS google_event_id text;

-- Multi-booking RPC
CREATE OR REPLACE FUNCTION public.book_lessons(
  _student_id uuid,
  _slots timestamptz[]
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
  _balance int;
  _needed int := array_length(_slots, 1);
BEGIN
  IF _needed IS NULL OR _needed = 0 THEN
    RAISE EXCEPTION 'No slots provided' USING errcode = 'P0001';
  END IF;

  SELECT
    COALESCE((SELECT SUM(credits_granted) FROM public.purchase_requests
              WHERE student_id = _student_id AND status = 'paid'), 0)
    - COALESCE((SELECT COUNT(*)::int FROM public.lessons
                WHERE student_id = _student_id AND status <> 'cancelled'), 0)
  INTO _balance;

  IF _balance < _needed THEN
    RAISE EXCEPTION 'Not enough credits: have %, need %', _balance, _needed
      USING errcode = 'P0005';
  END IF;

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

  FOREACH _slot IN ARRAY _slots LOOP
    INSERT INTO public.lessons (student_id, scheduled_at)
    VALUES (_student_id, _slot)
    RETURNING id INTO _new_id;
    _ids := array_append(_ids, _new_id);
  END LOOP;

  RETURN _ids;
END;
$$;

-- Reschedule RPC
CREATE OR REPLACE FUNCTION public.reschedule_lesson(
  _lesson_id uuid,
  _new_slot timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current timestamptz;
  _dow int;
  _t time;
BEGIN
  SELECT scheduled_at INTO _current
  FROM public.lessons
  WHERE id = _lesson_id AND status = 'scheduled';

  IF _current IS NULL THEN
    RAISE EXCEPTION 'Lesson not found' USING errcode = 'P0001';
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

  IF NOT EXISTS (
    SELECT 1 FROM public.availability_rules
    WHERE day_of_week = _dow AND slot_time = _t
  ) THEN
    RAISE EXCEPTION 'New slot not available' USING errcode = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.lessons
    WHERE scheduled_at = _new_slot AND status <> 'cancelled' AND id <> _lesson_id
  ) THEN
    RAISE EXCEPTION 'New slot already booked' USING errcode = 'P0002';
  END IF;

  UPDATE public.lessons
  SET scheduled_at = _new_slot
  WHERE id = _lesson_id;
END;
$$;

-- credit_balance_for: returns balance for any student id (demo mode)
CREATE OR REPLACE FUNCTION public.credit_balance_for(_student_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT SUM(credits_granted) FROM public.purchase_requests
              WHERE student_id = _student_id AND status = 'paid'), 0)
    - COALESCE((SELECT COUNT(*)::int FROM public.lessons
                WHERE student_id = _student_id AND status <> 'cancelled'), 0);
$$;

-- Demo permissions: open read access
DROP POLICY IF EXISTS "demo: anyone can read lessons" ON public.lessons;
CREATE POLICY "demo: anyone can read lessons"
ON public.lessons FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "demo: anon can read availability" ON public.availability_rules;
CREATE POLICY "demo: anon can read availability"
ON public.availability_rules FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "demo: anon can read packages" ON public.packages;
CREATE POLICY "demo: anon can read packages"
ON public.packages FOR SELECT
TO anon
USING (is_active = true);

-- Seed availability: Mon-Fri (1-5), hourly 9:00 to 18:00 (slot starts)
INSERT INTO public.availability_rules (day_of_week, slot_time)
SELECT d, make_time(h, 0, 0)
FROM generate_series(1, 5) d
CROSS JOIN generate_series(9, 17) h
ON CONFLICT DO NOTHING;

-- Unique constraint on packages.slug for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'packages_slug_key'
  ) THEN
    ALTER TABLE public.packages ADD CONSTRAINT packages_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Seed packages
INSERT INTO public.packages (name, slug, price_cents, currency, duration, description, credits, is_recommended, sort_order, is_free)
VALUES
  ('Trial Lesson', 'trial', 0, 'USD', '1 lesson', 'Try a free 60-minute lesson', 1, false, 1, true),
  ('Starter Pack', 'starter-5', 20000, 'USD', '5 lessons', '5 one-hour lessons', 5, false, 2, false),
  ('Standard Pack', 'standard-10', 38000, 'USD', '10 lessons', '10 one-hour lessons (save 5%)', 10, true, 3, false),
  ('Premium Pack', 'premium-20', 72000, 'USD', '20 lessons', '20 one-hour lessons (save 10%)', 20, false, 4, false)
ON CONFLICT (slug) DO NOTHING;

-- Demo student profile + 20 credits
INSERT INTO public.profiles (id, full_name, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Student', 'demo@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.purchase_requests (student_id, package_id, credits_granted, status, paid_at)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  id,
  20,
  'paid'::purchase_status,
  now()
FROM public.packages
WHERE slug = 'premium-20'
AND NOT EXISTS (
  SELECT 1 FROM public.purchase_requests
  WHERE student_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- Allow anon to call demo RPCs
GRANT EXECUTE ON FUNCTION public.book_lessons(uuid, timestamptz[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_lesson(uuid, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_balance_for(uuid) TO anon, authenticated;
