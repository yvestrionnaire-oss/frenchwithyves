-- availability_rules has been superseded by hardcoded teaching hours +
-- availability_overrides. No current function references it. Drop it.
DROP TABLE IF EXISTS public.availability_rules CASCADE;