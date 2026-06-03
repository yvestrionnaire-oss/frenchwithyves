-- Restore table privileges for the `service_role`.
--
-- ROOT CAUSE (same class as the earlier authenticated-grants bug): the DB was
-- recreated from migrations during the move off Lovable, and the GRANTs
-- Supabase normally applies were never reproduced. service_role had ZERO
-- privileges on every table, so edge functions using the service-role key
-- (create-lesson-events, cancel-lesson-event, reschedule-lesson-event, and
-- the PayPal capture flow) failed with "permission denied for table ...".
--
-- This is why booking succeeded (the calendar CHECK uses the user's
-- authenticated role, which we already fixed) but the Google Calendar event
-- + Meet link were never created (that step runs as service_role).
--
-- service_role is the trusted backend role and is designed to BYPASS RLS, so
-- it gets full DML on all tables, plus sequence and function access.

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- Future objects inherit the same, so this can't silently regress.
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  grant all privileges on functions to service_role;
