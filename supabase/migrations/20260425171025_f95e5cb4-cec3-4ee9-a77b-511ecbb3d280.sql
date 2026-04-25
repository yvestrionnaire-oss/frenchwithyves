-- 1. Fix handle_new_user: never trust client-supplied role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email);

  -- Always default to student; never trust client metadata for roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'student'::app_role)
  ON CONFLICT DO NOTHING;
  RETURN new;
END;
$$;

-- 2. Fix credit_balance: drop param version, use auth.uid() internally
DROP FUNCTION IF EXISTS public.credit_balance(uuid);

CREATE OR REPLACE FUNCTION public.credit_balance()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT SUM(credits_granted) FROM public.purchase_requests
              WHERE student_id = auth.uid() AND status = 'paid'), 0)
    - COALESCE((SELECT COUNT(*)::int FROM public.lessons
                WHERE student_id = auth.uid() AND status <> 'cancelled'), 0);
$$;

-- Update book_lesson to use the new no-arg credit_balance
CREATE OR REPLACE FUNCTION public.book_lesson(_scheduled_at timestamp with time zone)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _uid uuid := auth.uid();
  _dow int := extract(dow from _scheduled_at)::int;
  _t time := _scheduled_at::time;
  _balance int;
  _new_id uuid;
begin
  if _uid is null then raise exception 'Not authenticated' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.availability_rules where day_of_week = _dow and slot_time = _t) then
    raise exception 'Slot not available' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.lessons where scheduled_at = _scheduled_at and status <> 'cancelled') then
    raise exception 'Slot already booked' using errcode = 'P0002';
  end if;
  _balance := public.credit_balance();
  if _balance < 1 then raise exception 'No credits' using errcode = 'P0005'; end if;
  insert into public.lessons (student_id, scheduled_at) values (_uid, _scheduled_at) returning id into _new_id;
  return _new_id;
end;
$$;

-- 3. Replace overly permissive lessons UPDATE policy with a safe cancel RPC
DROP POLICY IF EXISTS "students cancel own lessons" ON public.lessons;

CREATE OR REPLACE FUNCTION public.cancel_lesson(_lesson_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lessons
    WHERE id = _lesson_id AND student_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Lesson not found' USING errcode = 'P0001';
  END IF;
  UPDATE public.lessons SET status = 'cancelled'::lesson_status WHERE id = _lesson_id;
END;
$$;

-- Allow teachers to update lessons (e.g. mark complete)
CREATE POLICY "teachers update lessons"
ON public.lessons
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role))
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));

-- 4. Lock down user_roles writes — only teachers (admins) may manage roles
CREATE POLICY "teachers manage roles insert"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "teachers manage roles update"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role))
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "teachers manage roles delete"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role));