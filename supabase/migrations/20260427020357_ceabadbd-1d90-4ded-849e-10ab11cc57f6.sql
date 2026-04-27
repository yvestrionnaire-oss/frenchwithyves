-- Teacher-initiated reschedule proposals
CREATE TABLE public.reschedule_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  initiated_by uuid NOT NULL,
  message text,
  proposed_slot timestamptz, -- NULL means "student picks"
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | declined | cancelled
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

ALTER TABLE public.reschedule_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers manage proposals"
  ON public.reschedule_proposals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'::public.app_role));

CREATE POLICY "students see own proposals"
  ON public.reschedule_proposals
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = reschedule_proposals.lesson_id AND l.student_id = auth.uid())
  );

CREATE POLICY "students respond to proposals"
  ON public.reschedule_proposals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = reschedule_proposals.lesson_id AND l.student_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.reschedule_proposals;

-- RPC: teacher creates a reschedule proposal
CREATE OR REPLACE FUNCTION public.teacher_propose_reschedule(
  _lesson_id uuid,
  _message text,
  _proposed_slot timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id uuid;
  _duration int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Not allowed' USING errcode = 'P0001';
  END IF;
  SELECT duration_minutes INTO _duration FROM public.lessons WHERE id = _lesson_id AND status = 'scheduled';
  IF _duration IS NULL THEN RAISE EXCEPTION 'Lesson not found' USING errcode = 'P0001'; END IF;

  IF _proposed_slot IS NOT NULL THEN
    IF NOT public.is_valid_slot(_proposed_slot, _duration) THEN
      RAISE EXCEPTION 'Proposed slot outside teaching hours' USING errcode = 'P0001';
    END IF;
    IF public.slot_conflicts(_proposed_slot, _duration, _lesson_id) THEN
      RAISE EXCEPTION 'Proposed slot conflicts' USING errcode = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.reschedule_proposals (lesson_id, initiated_by, message, proposed_slot)
  VALUES (_lesson_id, auth.uid(), _message, _proposed_slot)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- RPC: student accepts a teacher's proposed slot
CREATE OR REPLACE FUNCTION public.student_accept_proposal(_proposal_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lesson_id uuid;
  _slot timestamptz;
  _duration int;
  _student uuid;
  _current timestamptz;
BEGIN
  SELECT rp.lesson_id, rp.proposed_slot, l.duration_minutes, l.student_id, l.scheduled_at
    INTO _lesson_id, _slot, _duration, _student, _current
  FROM public.reschedule_proposals rp
  JOIN public.lessons l ON l.id = rp.lesson_id
  WHERE rp.id = _proposal_id AND rp.status = 'pending';
  IF _lesson_id IS NULL THEN RAISE EXCEPTION 'Proposal not found' USING errcode = 'P0001'; END IF;
  IF _student <> auth.uid() THEN RAISE EXCEPTION 'Not allowed' USING errcode = 'P0001'; END IF;
  IF _slot IS NULL THEN RAISE EXCEPTION 'No proposed slot' USING errcode = 'P0001'; END IF;
  IF public.slot_conflicts(_slot, _duration, _lesson_id) THEN
    RAISE EXCEPTION 'Slot no longer available' USING errcode = 'P0002';
  END IF;

  UPDATE public.lessons SET scheduled_at = _slot, rescheduled_from = _current WHERE id = _lesson_id;
  UPDATE public.reschedule_proposals SET status = 'accepted', responded_at = now() WHERE id = _proposal_id;
  UPDATE public.reschedule_proposals SET status = 'cancelled' WHERE lesson_id = _lesson_id AND status = 'pending' AND id <> _proposal_id;
END $$;

CREATE OR REPLACE FUNCTION public.student_decline_proposal(_proposal_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.reschedule_proposals
  SET status = 'declined', responded_at = now()
  WHERE id = _proposal_id
    AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND l.student_id = auth.uid());
END $$;