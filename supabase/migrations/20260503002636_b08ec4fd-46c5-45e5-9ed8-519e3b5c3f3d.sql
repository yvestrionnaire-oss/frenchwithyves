CREATE OR REPLACE FUNCTION public.slot_conflicts(_at timestamp with time zone, _duration_minutes integer, _exclude_lesson uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.status <> 'cancelled'
      AND (_exclude_lesson IS NULL OR l.id <> _exclude_lesson)
      AND tstzrange(l.scheduled_at, l.scheduled_at + (l.duration_minutes || ' minutes')::interval, '[)')
          && tstzrange(_at, _at + (_duration_minutes || ' minutes')::interval, '[)')
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_valid_slot(_at timestamp with time zone, _duration_minutes integer DEFAULT 60)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _pet timestamp;
  _start_minutes int;
  _end_minutes int;
BEGIN
  _pet := (_at AT TIME ZONE 'America/Lima');
  IF _duration_minutes IS NULL OR _duration_minutes <= 0 OR _duration_minutes % 30 <> 0 THEN RETURN FALSE; END IF;
  IF EXTRACT(MINUTE FROM _pet)::int NOT IN (0, 30) THEN RETURN FALSE; END IF;
  IF EXTRACT(SECOND FROM _pet)::int <> 0 THEN RETURN FALSE; END IF;
  _start_minutes := EXTRACT(HOUR FROM _pet)::int * 60 + EXTRACT(MINUTE FROM _pet)::int;
  _end_minutes := _start_minutes + _duration_minutes;
  RETURN _start_minutes >= 330 AND _end_minutes <= 1140;
END $function$;

CREATE OR REPLACE FUNCTION public.is_lesson_time_available(
  _at timestamp with time zone,
  _duration_minutes integer DEFAULT 60,
  _exclude_lesson uuid DEFAULT NULL::uuid
)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_valid_slot(_at, _duration_minutes) THEN
    RETURN FALSE;
  END IF;

  RETURN NOT public.slot_conflicts(_at, _duration_minutes, _exclude_lesson);
END $function$;

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

  -- Re-check overlaps within the requested batch before looking at stored lessons.
  IF (
    SELECT COUNT(*) FROM (
      SELECT 1
      FROM unnest(_slots) a(s1), unnest(_slots) b(s2)
      WHERE s1 < s2
        AND tstzrange(s1, s1 + interval '60 minutes', '[)') && tstzrange(s2, s2 + interval '60 minutes', '[)')
    ) x
  ) > 0 THEN
    RAISE EXCEPTION 'That time is no longer available — please pick another slot.' USING errcode = 'P0002';
  END IF;

  -- Lock all existing scheduled lessons that could overlap this batch, so two simultaneous
  -- bookings cannot both pass validation before either insert is visible.
  PERFORM 1
  FROM public.lessons l
  WHERE l.status <> 'cancelled'
    AND EXISTS (
      SELECT 1
      FROM unnest(_slots) s(slot_start)
      WHERE tstzrange(l.scheduled_at, l.scheduled_at + (l.duration_minutes || ' minutes')::interval, '[)')
            && tstzrange(s.slot_start, s.slot_start + interval '60 minutes', '[)')
    )
  FOR UPDATE;

  FOREACH _slot IN ARRAY _slots LOOP
    IF _slot < now() THEN RAISE EXCEPTION 'Cannot book a past slot' USING errcode = 'P0001'; END IF;
    IF NOT public.is_lesson_time_available(_slot, 60) THEN
      RAISE EXCEPTION 'That time is no longer available — please pick another slot.' USING errcode = 'P0002';
    END IF;
  END LOOP;

  FOREACH _slot IN ARRAY _slots LOOP
    INSERT INTO public.lessons (student_id, scheduled_at, lesson_type, duration_minutes)
    VALUES (_uid, _slot, 'regular', 60)
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
    IF _balance < 1 THEN RAISE EXCEPTION 'No credits' USING errcode = 'P0005'; END IF;
  END IF;

  INSERT INTO public.lessons (student_id, scheduled_at, lesson_type, duration_minutes)
  VALUES (_uid, _scheduled_at, _lesson_type, _duration) RETURNING id INTO _new_id;
  RETURN _new_id;
END $function$;

CREATE OR REPLACE FUNCTION public.reschedule_lesson(_lesson_id uuid, _new_slot timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _current timestamptz;
  _duration int;
  _student uuid;
BEGIN
  SELECT scheduled_at, duration_minutes, student_id INTO _current, _duration, _student
  FROM public.lessons WHERE id = _lesson_id AND status = 'scheduled';
  IF _current IS NULL THEN RAISE EXCEPTION 'Lesson not found' USING errcode = 'P0001'; END IF;
  IF _student <> auth.uid() AND NOT public.has_role(auth.uid(), 'teacher'::app_role) THEN
    RAISE EXCEPTION 'Not allowed' USING errcode = 'P0001';
  END IF;
  IF _current - now() < interval '5 minutes' THEN
    RAISE EXCEPTION 'Too late to reschedule' USING errcode = 'P0003';
  END IF;

  PERFORM 1
  FROM public.lessons l
  WHERE l.status <> 'cancelled'
    AND l.id <> _lesson_id
    AND tstzrange(l.scheduled_at, l.scheduled_at + (l.duration_minutes || ' minutes')::interval, '[)')
        && tstzrange(_new_slot, _new_slot + (_duration || ' minutes')::interval, '[)')
  FOR UPDATE;

  IF _new_slot < now() THEN RAISE EXCEPTION 'Past slot' USING errcode = 'P0001'; END IF;
  IF NOT public.is_lesson_time_available(_new_slot, _duration, _lesson_id) THEN
    RAISE EXCEPTION 'That time is no longer available — please pick another slot.' USING errcode = 'P0002';
  END IF;

  UPDATE public.lessons
  SET scheduled_at = _new_slot, rescheduled_from = _current
  WHERE id = _lesson_id;

  INSERT INTO public.teacher_notifications (kind, student_id, lesson_id, payload)
  VALUES ('lesson_rescheduled', _student, _lesson_id,
    jsonb_build_object('from', _current, 'to', _new_slot));
END $function$;

GRANT EXECUTE ON FUNCTION public.is_lesson_time_available(timestamptz, integer, uuid) TO authenticated;