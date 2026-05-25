CREATE OR REPLACE FUNCTION public.credit_balance_for(_student_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001';
  END IF;
  IF auth.uid() <> _student_id AND NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Not allowed' USING errcode = 'P0001';
  END IF;
  RETURN
    COALESCE((SELECT SUM(credits_granted)::int FROM public.purchase_requests
              WHERE student_id = _student_id
              AND status IN ('paid'::public.purchase_status, 'approved'::public.purchase_status)), 0)
    - COALESCE((SELECT COUNT(*)::int FROM public.lessons
                WHERE student_id = _student_id AND status <> 'cancelled'::public.lesson_status), 0);
END;
$function$;