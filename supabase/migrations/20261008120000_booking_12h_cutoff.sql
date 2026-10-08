-- 12-hour booking cutoff: students must book (and reschedule into) a slot at
-- least 12 hours before it starts. Teachers are exempt on reschedule so they
-- can still move lessons on short notice. Enforced server-side so it can't be
-- bypassed by calling the RPCs directly; the frontend mirrors it by greying
-- out near-term slots.

-- book_lessons: replace the "past slot" guard with a 12-hour-ahead guard
-- (which also covers past slots).
create or replace function public.book_lessons(_slots timestamp with time zone[], _duration_minutes integer default 60)
returns uuid[]
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _uid uuid := auth.uid();
  _slot timestamptz;
  _new_id uuid;
  _ids uuid[] := ARRAY[]::uuid[];
  _balance int;
  _needed int;
begin
  if _uid is null then raise exception 'Not authenticated' using errcode = 'P0001'; end if;
  _needed := coalesce(array_length(_slots, 1), 0);
  if _needed = 0 then raise exception 'No slots' using errcode = 'P0001'; end if;
  if _duration_minutes not in (30, 60) then
    raise exception 'Invalid lesson duration' using errcode = 'P0001';
  end if;

  _balance := public.credit_balance();
  if _balance < _needed then
    raise exception 'Not enough lessons remaining: have %, need %', _balance, _needed using errcode = 'P0005';
  end if;

  if (
    select count(*) from (
      select 1
      from unnest(_slots) a(s1), unnest(_slots) b(s2)
      where s1 < s2
        and tstzrange(s1, s1 + (_duration_minutes || ' minutes')::interval, '[)')
            && tstzrange(s2, s2 + (_duration_minutes || ' minutes')::interval, '[)')
    ) x
  ) > 0 then
    raise exception 'That time is no longer available — please pick another slot.' using errcode = 'P0002';
  end if;

  perform 1
  from public.lessons l
  where l.status <> 'cancelled'
    and exists (
      select 1
      from unnest(_slots) s(slot_start)
      where l.occupied_range && tstzrange(s.slot_start, s.slot_start + (_duration_minutes || ' minutes')::interval, '[)')
    )
  for update;

  foreach _slot in array _slots loop
    if _slot < now() + interval '12 hours' then
      raise exception 'Lessons must be booked at least 12 hours in advance — please pick a later time.' using errcode = 'P0006';
    end if;
    if not public.is_lesson_time_available(_slot, _duration_minutes) then
      raise exception 'That time is no longer available — please pick another slot.' using errcode = 'P0002';
    end if;
  end loop;

  foreach _slot in array _slots loop
    insert into public.lessons (student_id, scheduled_at, lesson_type, duration_minutes)
    values (_uid, _slot, 'regular', _duration_minutes)
    returning id into _new_id;
    _ids := array_append(_ids, _new_id);
  end loop;
  return _ids;
end $function$;

-- reschedule_lesson: students must reschedule into a slot >= 12h away.
-- Teachers keep short-notice flexibility.
create or replace function public.reschedule_lesson(_lesson_id uuid, _new_slot timestamp with time zone)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _current timestamptz;
  _duration int;
  _student uuid;
  _is_teacher boolean;
begin
  select scheduled_at, duration_minutes, student_id into _current, _duration, _student
  from public.lessons where id = _lesson_id and status = 'scheduled';
  if _current is null then raise exception 'Lesson not found' using errcode = 'P0001'; end if;

  _is_teacher := public.has_role(auth.uid(), 'teacher'::app_role);
  if _student <> auth.uid() and not _is_teacher then
    raise exception 'Not allowed' using errcode = 'P0001';
  end if;
  if _current - now() < interval '5 minutes' then
    raise exception 'Too late to reschedule' using errcode = 'P0003';
  end if;

  -- Students must pick a new time at least 12 hours out; teachers exempt.
  if not _is_teacher and _new_slot < now() + interval '12 hours' then
    raise exception 'Lessons must be rescheduled to a time at least 12 hours ahead.' using errcode = 'P0006';
  end if;

  perform 1
  from public.lessons l
  where l.status <> 'cancelled'
    and l.id <> _lesson_id
    and tstzrange(l.scheduled_at, l.scheduled_at + (l.duration_minutes || ' minutes')::interval, '[)')
        && tstzrange(_new_slot, _new_slot + (_duration || ' minutes')::interval, '[)')
  for update;

  if _new_slot < now() then raise exception 'Past slot' using errcode = 'P0001'; end if;
  if not public.is_lesson_time_available(_new_slot, _duration, _lesson_id) then
    raise exception 'That time is no longer available — please pick another slot.' using errcode = 'P0002';
  end if;

  update public.lessons
  set scheduled_at = _new_slot, rescheduled_from = _current
  where id = _lesson_id;

  update public.reschedule_proposals
  set status = 'accepted', responded_at = now()
  where lesson_id = _lesson_id and status = 'pending';

  insert into public.teacher_notifications (kind, student_id, lesson_id, payload)
  values ('lesson_rescheduled', _student, _lesson_id,
    jsonb_build_object('from', _current, 'to', _new_slot));
end $function$;
