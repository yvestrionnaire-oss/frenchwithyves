
-- 1) Fix book_lessons (multi) to use slot_conflicts (overlap check) instead of exact equality
CREATE OR REPLACE FUNCTION public.book_lessons(_slots timestamp with time zone[])
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

  _balance := public.credit_balance();
  IF _balance < _needed THEN
    RAISE EXCEPTION 'Not enough credits: have %, need %', _balance, _needed USING errcode = 'P0005';
  END IF;

  FOREACH _slot IN ARRAY _slots LOOP
    IF _slot < now() THEN RAISE EXCEPTION 'Past slot: %', _slot USING errcode = 'P0001'; END IF;
    IF NOT public.is_valid_slot(_slot, 60) THEN
      RAISE EXCEPTION 'Slot outside teaching hours: %', _slot USING errcode = 'P0001';
    END IF;
    IF public.slot_conflicts(_slot, 60) THEN
      RAISE EXCEPTION 'Slot conflicts with another lesson: %', _slot USING errcode = 'P0002';
    END IF;
  END LOOP;

  -- Re-check overlaps within the batch itself
  IF (
    SELECT COUNT(*) FROM (
      SELECT 1 FROM unnest(_slots) a(s1), unnest(_slots) b(s2)
      WHERE s1 < s2 AND tstzrange(s1, s1 + interval '60 minutes', '[)') && tstzrange(s2, s2 + interval '60 minutes', '[)')
    ) x
  ) > 0 THEN
    RAISE EXCEPTION 'Selected slots overlap each other' USING errcode = 'P0002';
  END IF;

  FOREACH _slot IN ARRAY _slots LOOP
    INSERT INTO public.lessons (student_id, scheduled_at, lesson_type, duration_minutes)
    VALUES (_uid, _slot, 'regular', 60)
    RETURNING id INTO _new_id;
    _ids := array_append(_ids, _new_id);
  END LOOP;
  RETURN _ids;
END $function$;

-- 2) Function returning all booked time ranges (anonymized) for a window.
-- Anyone authenticated can call it to know which times are taken.
CREATE OR REPLACE FUNCTION public.booked_ranges(_from timestamptz, _to timestamptz)
 RETURNS TABLE(start_at timestamptz, end_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT l.scheduled_at AS start_at,
         l.scheduled_at + (l.duration_minutes || ' minutes')::interval AS end_at
  FROM public.lessons l
  WHERE l.status <> 'cancelled'
    AND l.scheduled_at < _to
    AND (l.scheduled_at + (l.duration_minutes || ' minutes')::interval) > _from;
$function$;

REVOKE ALL ON FUNCTION public.booked_ranges(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booked_ranges(timestamptz, timestamptz) TO authenticated;
