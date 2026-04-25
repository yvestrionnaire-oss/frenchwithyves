-- Drop permissive RLS write policies on user_roles to block any direct client writes
DROP POLICY IF EXISTS "teachers manage roles insert" ON public.user_roles;
DROP POLICY IF EXISTS "teachers manage roles update" ON public.user_roles;
DROP POLICY IF EXISTS "teachers manage roles delete" ON public.user_roles;

-- Note: with RLS enabled and no write policies, no client (student or teacher) can
-- INSERT/UPDATE/DELETE rows in public.user_roles directly. The only ways to modify
-- roles are:
--   1. The handle_new_user() SECURITY DEFINER trigger (defaults new users to 'student').
--   2. The assign_role() SECURITY DEFINER function below (teachers only).
--   3. Direct service_role access (server/admin context).

-- Controlled role assignment for teachers
CREATE OR REPLACE FUNCTION public.assign_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001';
  END IF;
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Only teachers can assign roles' USING errcode = 'P0001';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Controlled role removal for teachers
CREATE OR REPLACE FUNCTION public.revoke_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001';
  END IF;
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Only teachers can revoke roles' USING errcode = 'P0001';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
END;
$$;