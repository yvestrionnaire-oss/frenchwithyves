
DROP POLICY IF EXISTS "students insert own lessons" ON public.lessons;
CREATE POLICY "students insert own lessons"
  ON public.lessons FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.has_role(auth.uid(), 'student'::public.app_role)
  );

-- Restrict student updates: only allow flipping status to cancelled, and ownership cannot change
DROP POLICY IF EXISTS "students update own lessons" ON public.lessons;
CREATE POLICY "students cancel own lessons"
  ON public.lessons FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (
    student_id = auth.uid()
    AND status = 'cancelled'::public.lesson_status
  );
