
CREATE OR REPLACE FUNCTION public.cancel_lesson(_lesson_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lessons
    WHERE id = _lesson_id
      AND (student_id = auth.uid() OR public.has_role(auth.uid(), 'teacher'::public.app_role))
  ) THEN
    RAISE EXCEPTION 'Lesson not found' USING errcode = 'P0001';
  END IF;
  UPDATE public.lessons SET status = 'cancelled'::lesson_status WHERE id = _lesson_id;
END;
$function$;
