-- Update user-facing error messages in booking RPCs from "credit(s)" to "lesson(s)".
-- Behavior, signatures, and column names are unchanged.

CREATE OR REPLACE FUNCTION public.book_lessons(_slots timestamp with time zone[], _duration_minutes integer DEFAULT 60)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _slot timestamptz;
  _new_id uuid;
  _ids uuid[] := ARRAY[]::uuid[];
  _balance int;
  _needed int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001'; END IF;
  _needed := COALESCE(array_length(_slots, 1), 0);
  IF _needed = 0 THEN RAISE EXCEPTION 'No slots' USING errcode = 'P0001'; END IF;
  IF _duration_minutes NOT IN (30, 60) THEN
    RAISE EXCEPTION 'Invalid lesson duration' USING errcode = 'P0001';
  END IF;

  _balance := public.credit_balance();
  IF _balance < _needed THEN
    RAISE EXCEPTION 'Not enough lessons remaining: have %, need %', _balance, _needed USING errcode = 'P0005';
  END IF;

  IF (
    SELECT COUNT(*) FROM (
      SELECT 1
      FROM unnest(_slots) a(s1), unnest(_slots) b(s2)
      WHERE s1 < s2
        AND tstzrange(s1, s1 + (_duration_minutes || ' minutes')::interval, '[)')
            && tstzrange(s2, s2 + (_duration_minutes || ' minutes')::interval, '[)')
    ) x
  ) > 0 THEN
    RAISE EXCEPTION 'That time is no longer available — please pick another slot.' USING errcode = 'P0002';
  END IF;

  PERFORM 1
  FROM public.lessons l
  WHERE l.status <> 'cancelled'
    AND EXISTS (
      SELECT 1
      FROM unnest(_slots) s(slot_start)
      WHERE l.occupied_range && tstzrange(s.slot_start, s.slot_start + (_duration_minutes || ' minutes')::interval, '[)')
    )
  FOR UPDATE;

  FOREACH _slot IN ARRAY _slots LOOP
    IF _slot < now() THEN RAISE EXCEPTION 'Cannot book a past slot' USING errcode = 'P0001'; END IF;
    IF NOT public.is_lesson_time_available(_slot, _duration_minutes) THEN
      RAISE EXCEPTION 'That time is no longer available — please pick another slot.' USING errcode = 'P0002';
    END IF;
  END LOOP;

  FOREACH _slot IN ARRAY _slots LOOP
    INSERT INTO public.lessons (student_id, scheduled_at, lesson_type, duration_minutes)
    VALUES (_uid, _slot, 'regular', _duration_minutes)
    RETURNING id INTO _new_id;
    _ids := array_append(_ids, _new_id);
  END LOOP;
  RETURN _ids;
END $function$;

CREATE OR REPLACE FUNCTION public.book_lesson(_scheduled_at timestamp with time zone, _lesson_type text DEFAULT 'regular'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _new_id uuid;
  _duration int;
  _balance int;
  _trial_approved boolean;
  _trial_used boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001'; END IF;
  IF _lesson_type NOT IN ('regular', 'trial') THEN RAISE EXCEPTION 'Invalid lesson type'; END IF;
  _duration := CASE WHEN _lesson_type = 'trial' THEN 30 ELSE 60 END;

  PERFORM 1
  FROM public.lessons l
  WHERE l.status <> 'cancelled'
    AND tstzrange(l.scheduled_at, l.scheduled_at + (l.duration_minutes || ' minutes')::interval, '[)')
        && tstzrange(_scheduled_at, _scheduled_at + (_duration || ' minutes')::interval, '[)')
  FOR UPDATE;

  IF _scheduled_at < now() THEN
    RAISE EXCEPTION 'Cannot book a past slot' USING errcode = 'P0001';
  END IF;
  IF NOT public.is_lesson_time_available(_scheduled_at, _duration) THEN
    RAISE EXCEPTION 'That time is no longer available — please pick another slot.' USING errcode = 'P0002';
  END IF;

  IF _lesson_type = 'trial' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.purchase_requests pr
      JOIN public.packages p ON p.id = pr.package_id
      WHERE pr.student_id = _uid AND p.is_free = true AND pr.status = 'approved'::public.purchase_status
    ) INTO _trial_approved;
    SELECT EXISTS (
      SELECT 1 FROM public.lessons WHERE student_id = _uid AND lesson_type = 'trial' AND status <> 'cancelled'
    ) INTO _trial_used;
    IF NOT _trial_approved THEN RAISE EXCEPTION 'Trial not approved' USING errcode = 'P0001'; END IF;
    IF _trial_used THEN RAISE EXCEPTION 'Trial already used' USING errcode = 'P0001'; END IF;
  ELSE
    _balance := public.credit_balance();
    IF _balance < 1 THEN RAISE EXCEPTION 'No lessons remaining. Request a package to get more.' USING errcode = 'P0005'; END IF;
  END IF;

  INSERT INTO public.lessons (student_id, scheduled_at, lesson_type, duration_minutes)
  VALUES (_uid, _scheduled_at, _lesson_type, _duration) RETURNING id INTO _new_id;
  RETURN _new_id;
END $function$;