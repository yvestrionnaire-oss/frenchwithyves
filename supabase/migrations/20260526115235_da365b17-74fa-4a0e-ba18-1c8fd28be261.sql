CREATE OR REPLACE FUNCTION public.cancel_lesson(_lesson_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _scheduled_at timestamptz;
  _student_id   uuid;
  _is_teacher   boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001';
  END IF;

  _is_teacher := public.has_role(auth.uid(), 'teacher'::public.app_role);

  SELECT scheduled_at, student_id
    INTO _scheduled_at, _student_id
    FROM public.lessons
    WHERE id = _lesson_id;

  IF _scheduled_at IS NULL THEN
    RAISE EXCEPTION 'Lesson not found' USING errcode = 'P0001';
  END IF;

  IF _student_id <> auth.uid() AND NOT _is_teacher THEN
    RAISE EXCEPTION 'Lesson not found' USING errcode = 'P0001';
  END IF;

  IF NOT _is_teacher AND _scheduled_at - now() < interval '5 minutes' THEN
    RAISE EXCEPTION 'Too late to cancel — lessons can only be cancelled up to 5 minutes before they start.'
      USING errcode = 'P0003';
  END IF;

  UPDATE public.lessons
    SET status = 'cancelled'::lesson_status
    WHERE id = _lesson_id;
END;
$function$;