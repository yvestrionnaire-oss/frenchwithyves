-- Restore table-level privileges for the `authenticated` (and `anon`) roles.
--
-- ROOT CAUSE: When this database was recreated from migrations (during the
-- move off Lovable), the GRANT statements that Supabase normally applies were
-- never reproduced. Row Level Security policies existed, but Postgres checks
-- table-level privileges FIRST — so every logged-in query failed with
-- "permission denied for table ...", silently returning no rows.
--
-- This caused: packages not showing on the student dashboard, the teacher
-- role read failing (defaulting users to "student"), and would have broken
-- booking/payments too.
--
-- SECURITY: This does NOT weaken access control. The real restrictions live in
-- the RLS policies already defined on each table. These grants only let those
-- policies be evaluated. RLS remains enabled on every table.

-- Standard Supabase data privileges for the authenticated role.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- anon: no table grants needed — no table has an anon RLS policy, so anon
-- sees nothing regardless. Only function execute is granted (needed for
-- auth-related RPCs invoked before a session exists).
grant execute on all functions in schema public to anon;

-- Ensure future tables/sequences/functions inherit the same grants, so this
-- never silently breaks again.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
alter default privileges in schema public
  grant execute on functions to anon;
