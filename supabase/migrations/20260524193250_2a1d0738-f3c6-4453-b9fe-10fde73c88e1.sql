-- 1) Lock down SECURITY DEFINER RPCs: revoke from anon/public, keep authenticated
REVOKE EXECUTE ON FUNCTION public.book_lessons(timestamp with time zone[], integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.book_lesson(timestamp with time zone, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancel_lesson(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancel_request(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reschedule_lesson(uuid, timestamp with time zone) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.request_package(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_trial(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.confirm_paid(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_payment_link_sent(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.assign_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.revoke_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.credit_balance() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.credit_balance_for(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_lesson_time_available(timestamp with time zone, integer, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_valid_slot(timestamp with time zone, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.slot_conflicts(timestamp with time zone, integer, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.booked_ranges(timestamp with time zone, timestamp with time zone) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.teacher_propose_reschedule(uuid, text, timestamp with time zone) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.student_accept_proposal(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.student_decline_proposal(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.book_lessons(timestamp with time zone[], integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_lesson(timestamp with time zone, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_lesson(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_lesson(uuid, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_package(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_trial(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_paid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_link_sent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_balance_for(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lesson_time_available(timestamp with time zone, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_slot(timestamp with time zone, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.slot_conflicts(timestamp with time zone, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.booked_ranges(timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_propose_reschedule(uuid, text, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_accept_proposal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_decline_proposal(uuid) TO authenticated;

-- 2) Block all client writes to user_roles. Only SECURITY DEFINER funcs (assign_role/revoke_role) running as the function owner can change roles.
CREATE POLICY "no client inserts on user_roles"
  ON public.user_roles FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "no client updates on user_roles"
  ON public.user_roles FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "no client deletes on user_roles"
  ON public.user_roles FOR DELETE TO authenticated, anon
  USING (false);

-- 3) Realtime channel authorization: only allow subscribers to topics they own.
-- Topics in this app: "teacher-dash", "student-dash", "teacher-cal-*"
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read own realtime topics" ON realtime.messages;
CREATE POLICY "authenticated can read own realtime topics"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    (
      (realtime.topic() IN ('teacher-dash')
        OR realtime.topic() LIKE 'teacher-cal-%')
      AND public.has_role(auth.uid(), 'teacher'::public.app_role)
    )
    OR (
      realtime.topic() = 'student-dash'
      AND public.has_role(auth.uid(), 'student'::public.app_role)
    )
  );