
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'teacher'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'yvestrionnaire@gmail.com'
ON CONFLICT DO NOTHING;

DELETE FROM public.user_roles
WHERE role = 'student'::public.app_role
  AND user_id = (SELECT id FROM auth.users WHERE lower(email) = 'yvestrionnaire@gmail.com');

DELETE FROM public.user_roles
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'yves@example.com');

DELETE FROM public.profiles
WHERE id = (SELECT id FROM auth.users WHERE lower(email) = 'yves@example.com');

DELETE FROM auth.users
WHERE lower(email) = 'yves@example.com';
