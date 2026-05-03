DROP FUNCTION IF EXISTS public.book_lessons(timestamp with time zone[]);

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
    RAISE EXCEPTION 'Not enough credits: have %, need %', _balance, _needed USING errcode = 'P0005';
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

REVOKE ALL ON FUNCTION public.book_lessons(timestamptz[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_lessons(timestamptz[], integer) TO authenticated;