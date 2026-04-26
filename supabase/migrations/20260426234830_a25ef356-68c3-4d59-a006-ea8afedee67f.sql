
-- Allow teacher to read all profiles & roles (for dashboard listings)
CREATE POLICY "teacher reads all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::public.app_role));

CREATE POLICY "teacher reads all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::public.app_role));

-- Bootstrap: first user with the admin email becomes teacher
CREATE OR REPLACE FUNCTION public.bootstrap_admin(_admin_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  IF lower(_email) <> lower(_admin_email) THEN
    RAISE EXCEPTION 'Not the admin email';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'teacher'::public.app_role)
  ON CONFLICT DO NOTHING;
  -- Remove default student role so dashboard routing is clean
  DELETE FROM public.user_roles WHERE user_id = _uid AND role = 'student'::public.app_role;
END;
$$;

-- Student requests a package (trial included)
CREATE OR REPLACE FUNCTION public.request_package(_package_id uuid, _notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pkg public.packages%ROWTYPE;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001'; END IF;
  IF NOT public.has_role(_uid, 'student'::public.app_role) THEN
    RAISE EXCEPTION 'Only students can request packages' USING errcode = 'P0001';
  END IF;
  SELECT * INTO _pkg FROM public.packages WHERE id = _package_id AND is_active = true;
  IF _pkg.id IS NULL THEN RAISE EXCEPTION 'Package not found' USING errcode = 'P0001'; END IF;

  -- Trial: only one allowed per student (any non-cancelled trial request blocks new ones)
  IF _pkg.is_free THEN
    IF EXISTS (
      SELECT 1 FROM public.purchase_requests pr
      JOIN public.packages p ON p.id = pr.package_id
      WHERE pr.student_id = _uid AND p.is_free = true AND pr.status <> 'cancelled'::public.purchase_status
    ) THEN
      RAISE EXCEPTION 'Trial already requested' USING errcode = 'P0004';
    END IF;
  END IF;

  INSERT INTO public.purchase_requests (student_id, package_id, status, credits_granted, notes)
  VALUES (_uid, _package_id, 'pending'::public.purchase_status, 0, _notes)
  RETURNING id INTO _new_id;
  RETURN _new_id;
END;
$$;

-- Teacher: mark payment link as sent
CREATE OR REPLACE FUNCTION public.mark_payment_link_sent(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Only teachers' USING errcode = 'P0001';
  END IF;
  UPDATE public.purchase_requests
  SET status = 'payment_link_sent'::public.purchase_status
  WHERE id = _request_id AND status = 'pending'::public.purchase_status;
END;
$$;

-- Teacher: confirm payment received → grants credits
CREATE OR REPLACE FUNCTION public.confirm_paid(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credits int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Only teachers' USING errcode = 'P0001';
  END IF;
  SELECT p.credits INTO _credits
  FROM public.purchase_requests pr JOIN public.packages p ON p.id = pr.package_id
  WHERE pr.id = _request_id;
  IF _credits IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  UPDATE public.purchase_requests
  SET status = 'paid'::public.purchase_status,
      credits_granted = _credits,
      paid_at = now()
  WHERE id = _request_id;
END;
$$;

-- Teacher: approve trial → grants 1 trial credit (tracked separately via lesson_type)
CREATE OR REPLACE FUNCTION public.approve_trial(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Only teachers' USING errcode = 'P0001';
  END IF;
  UPDATE public.purchase_requests
  SET status = 'approved'::public.purchase_status,
      credits_granted = 1,
      paid_at = now()
  WHERE id = _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.purchase_requests WHERE id = _request_id AND student_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.purchase_requests SET status = 'cancelled'::public.purchase_status WHERE id = _request_id;
END;
$$;

-- Update credit_balance to count trial credits (approved status)
CREATE OR REPLACE FUNCTION public.credit_balance()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT SUM(credits_granted)::int FROM public.purchase_requests
              WHERE student_id = auth.uid()
              AND status IN ('paid'::public.purchase_status, 'approved'::public.purchase_status)), 0)
    - COALESCE((SELECT COUNT(*)::int FROM public.lessons
                WHERE student_id = auth.uid() AND status <> 'cancelled'::public.lesson_status), 0);
$$;

CREATE OR REPLACE FUNCTION public.credit_balance_for(_student_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT SUM(credits_granted)::int FROM public.purchase_requests
              WHERE student_id = _student_id
              AND status IN ('paid'::public.purchase_status, 'approved'::public.purchase_status)), 0)
    - COALESCE((SELECT COUNT(*)::int FROM public.lessons
                WHERE student_id = _student_id AND status <> 'cancelled'::public.lesson_status), 0);
$$;

-- Update book_lesson signature to accept lesson_type and set duration
DROP FUNCTION IF EXISTS public.book_lesson(timestamptz);
CREATE OR REPLACE FUNCTION public.book_lesson(_scheduled_at timestamptz, _lesson_type text DEFAULT 'regular')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _dow int := extract(dow from _scheduled_at)::int;
  _t time := _scheduled_at::time;
  _balance int;
  _new_id uuid;
  _duration int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001'; END IF;
  IF _lesson_type NOT IN ('regular', 'trial') THEN RAISE EXCEPTION 'Invalid lesson type'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.availability_rules WHERE day_of_week = _dow AND slot_time = _t) THEN
    RAISE EXCEPTION 'Slot not available' USING errcode = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lessons WHERE scheduled_at = _scheduled_at AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'Slot already booked' USING errcode = 'P0002';
  END IF;
  _balance := public.credit_balance();
  IF _balance < 1 THEN RAISE EXCEPTION 'No credits' USING errcode = 'P0005'; END IF;
  _duration := CASE WHEN _lesson_type = 'trial' THEN 30 ELSE 60 END;
  INSERT INTO public.lessons (student_id, scheduled_at, lesson_type, duration_minutes)
  VALUES (_uid, _scheduled_at, _lesson_type, _duration) RETURNING id INTO _new_id;
  RETURN _new_id;
END;
$$;

-- Allow students to insert lessons via the RPC (RLS on table)
CREATE POLICY "students insert own lessons"
  ON public.lessons FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Allow students to update own lessons (cancel/reschedule via RPCs)
CREATE POLICY "students update own lessons"
  ON public.lessons FOR UPDATE TO authenticated
  USING (student_id = auth.uid());

-- Cleanup duplicate packages → keep clean canonical set
DELETE FROM public.packages;
INSERT INTO public.packages (slug, name, description, price_cents, currency, duration, is_free, is_recommended, credits, sort_order, is_active) VALUES
  ('trial',    'Free trial lesson', '30-minute introduction lesson, free of charge', 0,     'USD', '30 min', true,  false, 1,  1, true),
  ('single',   '1 lesson',          '60-minute lesson',                              2000,  'USD', '60 min', false, false, 1,  2, true),
  ('pack5',    '5 lessons',         '5 × 60-min lessons (save $5)',                  9500,  'USD', '60 min', false, false, 5,  3, true),
  ('pack10',   '10 lessons',        '10 × 60-min lessons (save $12)',                18800, 'USD', '60 min', false, true,  10, 4, true),
  ('pack20',   '20 lessons',        '20 × 60-min lessons (save $36)',                36400, 'USD', '60 min', false, false, 20, 5, true);
