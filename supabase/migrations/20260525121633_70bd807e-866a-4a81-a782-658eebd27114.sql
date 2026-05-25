-- Remove permissive student write policies; all student mutations go through SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "students update own lessons" ON public.lessons;
DROP POLICY IF EXISTS "students insert own lessons" ON public.lessons;
DROP POLICY IF EXISTS "students create own purchase requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "students respond to proposals" ON public.reschedule_proposals;