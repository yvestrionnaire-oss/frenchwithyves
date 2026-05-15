CREATE OR REPLACE FUNCTION public.cancel_request(_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001';
  END IF;

  IF public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    UPDATE public.purchase_requests
    SET status = 'cancelled'::public.purchase_status
    WHERE id = _request_id;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_requests
    WHERE id = _request_id AND student_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING errcode = 'P0001';
  END IF;

  UPDATE public.purchase_requests
  SET status = 'cancelled'::public.purchase_status
  WHERE id = _request_id
    AND status IN ('pending'::public.purchase_status, 'payment_link_sent'::public.purchase_status);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This request has already been paid. Please contact Yves to arrange a refund.'
      USING errcode = 'P0006';
  END IF;
END;
$function$;