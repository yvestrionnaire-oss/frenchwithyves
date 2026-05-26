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

  UPDATE public.reschedule_proposals
  SET status = 'accepted', responded_at = now()
  WHERE lesson_id = _lesson_id AND status = 'pending';

  INSERT INTO public.teacher_notifications (kind, student_id, lesson_id, payload)
  VALUES ('lesson_rescheduled', _student, _lesson_id,
    jsonb_build_object('from', _current, 'to', _new_slot));
END $function$;