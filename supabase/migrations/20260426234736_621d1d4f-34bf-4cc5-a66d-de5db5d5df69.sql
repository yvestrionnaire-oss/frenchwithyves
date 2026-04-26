
-- 1. Wipe legacy guest data
DELETE FROM public.lessons;
DELETE FROM public.purchase_requests;

-- 2. Drop guest functions (no longer used; new flow is auth-only)
DROP FUNCTION IF EXISTS public.book_guest_lessons(text, text, timestamptz[], text, integer);
DROP FUNCTION IF EXISTS public.reschedule_guest_lesson(uuid, text, timestamptz);

-- 3. Remove guest fields from lessons (keep nullable migration safe)
ALTER TABLE public.lessons DROP COLUMN IF EXISTS guest_name;
ALTER TABLE public.lessons DROP COLUMN IF EXISTS guest_email;
ALTER TABLE public.lessons ALTER COLUMN student_id SET NOT NULL;

-- 4. Drop anon read policies (calendar is now login-only)
DROP POLICY IF EXISTS "demo: anon can read availability" ON public.availability_rules;
DROP POLICY IF EXISTS "demo: anyone can read lessons" ON public.lessons;
DROP POLICY IF EXISTS "demo: anon can read packages" ON public.packages;

-- 5. Extend purchase_status with new states
ALTER TYPE public.purchase_status ADD VALUE IF NOT EXISTS 'payment_link_sent';
ALTER TYPE public.purchase_status ADD VALUE IF NOT EXISTS 'approved';
COMMIT;
