
-- 1. Notifications table for teacher feed
CREATE TABLE public.teacher_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL, -- 'request_created' | 'lesson_cancelled' | 'lesson_rescheduled'
  student_id uuid NOT NULL,
  lesson_id uuid,
  request_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers read notifications" ON public.teacher_notifications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher'::app_role));
CREATE POLICY "teachers update notifications" ON public.teacher_notifications
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'teacher'::app_role));
ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_notifications;

-- 2. Add column to lessons for reschedule tracking
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS rescheduled_from timestamptz;

-- Allow students to update their own lesson scheduled_at (for reschedule)
DROP POLICY IF EXISTS "students cancel own lessons" ON public.lessons;
CREATE POLICY "students update own lessons" ON public.lessons
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- 3. Slot validation function — 5:30 AM to 7:00 PM Peru time (UTC-5, no DST), 30-min increments
CREATE OR REPLACE FUNCTION public.is_valid_slot(_at timestamptz, _duration_minutes int DEFAULT 60)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pet timestamp;
  _start_minutes int;  -- minutes since midnight in Peru tz
  _end_minutes int;
BEGIN
  _pet := (_at AT TIME ZONE 'America/Lima');
  -- Must be on a 30-minute mark
  IF EXTRACT(MINUTE FROM _pet)::int NOT IN (0, 30) THEN RETURN FALSE; END IF;
  IF EXTRACT(SECOND FROM _pet)::int <> 0 THEN RETURN FALSE; END IF;
  _start_minutes := EXTRACT(HOUR FROM _pet)::int * 60 + EXTRACT(MINUTE FROM _pet)::int;
  _end_minutes := _start_minutes + _duration_minutes;
  -- Earliest start: 5:30 AM (330). Latest END: 7:00 PM (1140).
  RETURN _start_minutes >= 330 AND _end_minutes <= 1140;
END $$;

-- 4. Overlap check
CREATE OR REPLACE FUNCTION public.slot_conflicts(_at timestamptz, _duration_minutes int, _exclude_lesson uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.status <> 'cancelled'
      AND (_exclude_lesson IS NULL OR l.id <> _exclude_lesson)
      AND tstzrange(l.scheduled_at, l.scheduled_at + (l.duration_minutes || ' minutes')::interval, '[)')
          && tstzrange(_at, _at + (_duration_minutes || ' minutes')::interval, '[)')
  );
$$;

-- 5. Updated single-lesson booking (re-add for multi-slot version below — keep this for trial path)
CREATE OR REPLACE FUNCTION public.book_lesson(_scheduled_at timestamp with time zone, _lesson_type text DEFAULT 'regular')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _new_id uuid;
  _duration int;
  _balance int;
  _trial_approved boolean;
  _trial_used boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001'; END IF;
  IF _lesson_type NOT IN ('regular', 'trial') THEN RAISE EXCEPTION 'Invalid lesson type'; END IF;
  _duration := CASE WHEN _lesson_type = 'trial' THEN 30 ELSE 60 END;

  IF NOT public.is_valid_slot(_scheduled_at, _duration) THEN
    RAISE EXCEPTION 'Slot is outside teaching hours' USING errcode = 'P0001';
  END IF;
  IF public.slot_conflicts(_scheduled_at, _duration) THEN
    RAISE EXCEPTION 'Slot conflicts with another lesson' USING errcode = 'P0002';
  END IF;
  IF _scheduled_at < now() THEN
    RAISE EXCEPTION 'Cannot book a past slot' USING errcode = 'P0001';
  END IF;

  IF _lesson_type = 'trial' THEN
    -- Must have an approved (not paid) trial request and not have used a trial yet
    SELECT EXISTS (
      SELECT 1 FROM public.purchase_requests pr
      JOIN public.packages p ON p.id = pr.package_id
      WHERE pr.student_id = _uid AND p.is_free = true AND pr.status = 'approved'::public.purchase_status
    ) INTO _trial_approved;
    SELECT EXISTS (
      SELECT 1 FROM public.lessons WHERE student_id = _uid AND lesson_type = 'trial' AND status <> 'cancelled'
    ) INTO _trial_used;
    IF NOT _trial_approved THEN RAISE EXCEPTION 'Trial not approved' USING errcode = 'P0001'; END IF;
    IF _trial_used THEN RAISE EXCEPTION 'Trial already used' USING errcode = 'P0001'; END IF;
  ELSE
    _balance := public.credit_balance();
    IF _balance < 1 THEN RAISE EXCEPTION 'No credits' USING errcode = 'P0005'; END IF;
  END IF;

  INSERT INTO public.lessons (student_id, scheduled_at, lesson_type, duration_minutes)
  VALUES (_uid, _scheduled_at, _lesson_type, _duration) RETURNING id INTO _new_id;
  RETURN _new_id;
END $$;

-- 6. Multi-slot booking (regular lessons only)
CREATE OR REPLACE FUNCTION public.book_lessons(_slots timestamptz[])
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _slot timestamptz;
  _new_id uuid;
  _ids uuid[] := ARRAY[]::uuid[];
  _balance int;
  _needed int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING errcode = 'P0001'; END IF;
  _needed := COALESCE(array_length(_slots, 1), 0);
  IF _needed = 0 THEN RAISE EXCEPTION 'No slots' USING errcode = 'P0001'; END IF;

  _balance := public.credit_balance();
  IF _balance < _needed THEN
    RAISE EXCEPTION 'Not enough credits: have %, need %', _balance, _needed USING errcode = 'P0005';
  END IF;

  -- Validate each slot
  FOREACH _slot IN ARRAY _slots LOOP
    IF _slot < now() THEN RAISE EXCEPTION 'Past slot: %', _slot USING errcode = 'P0001'; END IF;
    IF NOT public.is_valid_slot(_slot, 60) THEN
      RAISE EXCEPTION 'Slot outside teaching hours: %', _slot USING errcode = 'P0001';
    END IF;
    IF public.slot_conflicts(_slot, 60) THEN
      RAISE EXCEPTION 'Slot already booked: %', _slot USING errcode = 'P0002';
    END IF;
  END LOOP;

  FOREACH _slot IN ARRAY _slots LOOP
    INSERT INTO public.lessons (student_id, scheduled_at, lesson_type, duration_minutes)
    VALUES (_uid, _slot, 'regular', 60)
    RETURNING id INTO _new_id;
    _ids := array_append(_ids, _new_id);
  END LOOP;
  RETURN _ids;
END $$;

-- 7. Reschedule (any 30-min increment; respects duration of existing lesson)
CREATE OR REPLACE FUNCTION public.reschedule_lesson(_lesson_id uuid, _new_slot timestamp with time zone)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _current timestamptz;
  _duration int;
  _student uuid;
BEGIN
  SELECT scheduled_at, duration_minutes, student_id INTO _current, _duration, _student
  FROM public.lessons WHERE id = _lesson_id AND status = 'scheduled';
  IF _current IS NULL THEN RAISE EXCEPTION 'Lesson not found' USING errcode = 'P0001'; END IF;
  IF _student <> auth.uid() AND NOT public.has_role(auth.uid(), 'teacher'::app_role) THEN
    RAISE EXCEPTION 'Not allowed' USING errcode = 'P0001';
  END IF;
  IF _current - now() < interval '5 minutes' THEN
    RAISE EXCEPTION 'Too late to reschedule' USING errcode = 'P0003';
  END IF;
  IF _new_slot < now() THEN RAISE EXCEPTION 'Past slot' USING errcode = 'P0001'; END IF;
  IF NOT public.is_valid_slot(_new_slot, _duration) THEN
    RAISE EXCEPTION 'Slot outside teaching hours' USING errcode = 'P0001';
  END IF;
  IF public.slot_conflicts(_new_slot, _duration, _lesson_id) THEN
    RAISE EXCEPTION 'Slot already booked' USING errcode = 'P0002';
  END IF;

  UPDATE public.lessons
  SET scheduled_at = _new_slot, rescheduled_from = _current
  WHERE id = _lesson_id;

  INSERT INTO public.teacher_notifications (kind, student_id, lesson_id, payload)
  VALUES ('lesson_rescheduled', _student, _lesson_id,
    jsonb_build_object('from', _current, 'to', _new_slot));
END $$;

-- 8. Cancel notification trigger
CREATE OR REPLACE FUNCTION public.notify_on_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    INSERT INTO public.teacher_notifications (kind, student_id, lesson_id, payload)
    VALUES ('lesson_cancelled', NEW.student_id, NEW.id,
      jsonb_build_object('was_at', OLD.scheduled_at, 'lesson_type', OLD.lesson_type));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS lessons_notify_cancel ON public.lessons;
CREATE TRIGGER lessons_notify_cancel
  AFTER UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_cancel();

-- 9. Notify on new purchase request
CREATE OR REPLACE FUNCTION public.notify_on_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.teacher_notifications (kind, student_id, request_id, payload)
  VALUES ('request_created', NEW.student_id, NEW.id,
    jsonb_build_object('package_id', NEW.package_id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS purchase_requests_notify ON public.purchase_requests;
CREATE TRIGGER purchase_requests_notify
  AFTER INSERT ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_request();

-- 10. Realtime for lessons
ALTER PUBLICATION supabase_realtime ADD TABLE public.lessons;
