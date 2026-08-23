-- Teacher-defined weekly availability (Verbling-style).
--
-- BEFORE: bookable hours were hardcoded in is_valid_slot() as a fixed
-- 5:30am-7:00pm America/Lima window, every day, with `open` overrides to
-- extend and `block` overrides to subtract. The teacher could not actually
-- define their own weekly schedule.
--
-- AFTER: a weekly_availability table holds recurring (weekday, time-range)
-- blocks in Peru local minutes-since-midnight. A 30-min slot is valid only if
-- it falls entirely inside one of those blocks. `block` overrides still
-- subtract (one-off exceptions kept working); `open` overrides still add.
-- This inverts the default from "open unless blocked" to "closed unless the
-- teacher marked it available" — matching the new grid UI.

-- weekday: 0=Sunday .. 6=Saturday (matches JS Date.getDay()).
-- start_min/end_min: minutes since midnight in America/Lima, on a 30-min grid.
create table if not exists public.weekly_availability (
  id          uuid primary key default gen_random_uuid(),
  weekday     smallint not null check (weekday between 0 and 6),
  start_min   integer  not null check (start_min >= 0 and start_min < 1440),
  end_min     integer  not null check (end_min > 0 and end_min <= 1440),
  created_at  timestamptz not null default now(),
  check (end_min > start_min)
);

alter table public.weekly_availability enable row level security;

-- Anyone signed in can read (students need it to see open slots);
-- only the teacher can modify.
create policy "anyone signed in reads weekly availability"
  on public.weekly_availability for select to authenticated using (true);
create policy "teacher inserts weekly availability"
  on public.weekly_availability for insert to authenticated
  with check (public.has_role(auth.uid(), 'teacher'::app_role));
create policy "teacher updates weekly availability"
  on public.weekly_availability for update to authenticated
  using (public.has_role(auth.uid(), 'teacher'::app_role))
  with check (public.has_role(auth.uid(), 'teacher'::app_role));
create policy "teacher deletes weekly availability"
  on public.weekly_availability for delete to authenticated
  using (public.has_role(auth.uid(), 'teacher'::app_role));

grant select, insert, update, delete on public.weekly_availability to authenticated;
grant all privileges on public.weekly_availability to service_role;

-- Realtime so the teacher grid + student booking grid update live.
alter publication supabase_realtime add table public.weekly_availability;

-- Seed with the previous effective hours (5:30am-7:00pm every day) so
-- existing bookability is preserved the moment this goes live. The teacher
-- can then trim/extend per day from the grid.
insert into public.weekly_availability (weekday, start_min, end_min)
select d, 330, 1140 from generate_series(0, 6) AS d;

-- Rewrite is_valid_slot: a slot is valid if every 30-min cell it spans is
-- covered by a weekly_availability block for that weekday (Peru time) OR an
-- `open` override, AND is not otherwise malformed. `block` overrides are
-- still applied by slot_conflicts/booking layer as before (unchanged here).
create or replace function public.is_valid_slot(_at timestamp with time zone, _duration_minutes integer default 60)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  _pet          timestamp;
  _offset       int;
  _cell_start   timestamptz;
  _cell_end     timestamptz;
  _cell_min     int;
  _cell_weekday int;
begin
  if _duration_minutes is null
     or _duration_minutes <= 0
     or _duration_minutes % 30 <> 0
  then
    return false;
  end if;

  _pet := (_at at time zone 'America/Lima');
  if extract(minute from _pet)::int not in (0, 30) then return false; end if;
  if extract(second from _pet)::int <> 0          then return false; end if;

  _offset := 0;
  while _offset < _duration_minutes loop
    _cell_start := _at + (_offset || ' minutes')::interval;
    _cell_end   := _cell_start + interval '30 minutes';

    _cell_min :=
        extract(hour   from (_cell_start at time zone 'America/Lima'))::int * 60
      + extract(minute from (_cell_start at time zone 'America/Lima'))::int;
    _cell_weekday := extract(dow from (_cell_start at time zone 'America/Lima'))::int;

    if exists (
      select 1 from public.weekly_availability wa
      where wa.weekday = _cell_weekday
        and wa.start_min <= _cell_min
        and wa.end_min   >= _cell_min + 30
    ) then
      -- inside a teacher-defined weekly block, OK
    elsif exists (
      select 1 from public.availability_overrides
      where kind = 'open'::public.availability_override_kind
        and starts_at <= _cell_start
        and ends_at   >= _cell_end
    ) then
      -- covered by a one-off open override, OK
    else
      return false;
    end if;

    _offset := _offset + 30;
  end loop;

  return true;
end;
$function$;
