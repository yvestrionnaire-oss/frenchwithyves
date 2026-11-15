-- Teacher feed: notify when a student books a lesson.
--
-- The feed already covered package requests, cancellations and reschedules, but
-- a plain booking (spending an already-owned credit on a slot) produced no feed
-- entry at all — so a student booking their last credit was silent. This adds a
-- 'lesson_booked' notification on every new lesson via an AFTER INSERT trigger,
-- so it fires for all booking paths (book_lessons and any future one), mirroring
-- the existing notify_on_cancel / notify_on_request triggers.

create or replace function public.notify_on_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.teacher_notifications (kind, student_id, lesson_id, payload)
  values (
    'lesson_booked',
    new.student_id,
    new.id,
    jsonb_build_object('scheduled_at', new.scheduled_at, 'lesson_type', new.lesson_type)
  );
  return new;
end $$;

drop trigger if exists lessons_notify_booking on public.lessons;
create trigger lessons_notify_booking
  after insert on public.lessons
  for each row execute function public.notify_on_booking();
