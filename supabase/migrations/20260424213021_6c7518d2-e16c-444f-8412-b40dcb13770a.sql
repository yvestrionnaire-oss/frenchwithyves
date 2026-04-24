-- ============= Roles =============
create type public.app_role as enum ('student', 'teacher');

-- ============= Profiles =============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid());

-- ============= User roles =============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create policy "users read own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

-- ============= Packages =============
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_cents integer not null default 0,
  currency text not null default 'USD',
  duration text not null,
  description text not null default '',
  is_free boolean not null default false,
  is_recommended boolean not null default false,
  credits integer not null default 1,
  sort_order integer not null default 0,
  is_active boolean not null default true
);
alter table public.packages enable row level security;
create policy "anyone signed in can read packages" on public.packages
  for select to authenticated using (is_active = true);

-- ============= Purchase requests =============
create type public.purchase_status as enum ('pending', 'paid', 'cancelled');

create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  package_id uuid not null references public.packages(id),
  status purchase_status not null default 'pending',
  credits_granted integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.purchase_requests enable row level security;

create policy "students read own purchase requests" on public.purchase_requests
  for select to authenticated using (student_id = auth.uid() or public.has_role(auth.uid(), 'teacher'));
create policy "students create own purchase requests" on public.purchase_requests
  for insert to authenticated with check (student_id = auth.uid() and public.has_role(auth.uid(), 'student'));
create policy "teachers update purchase requests" on public.purchase_requests
  for update to authenticated using (public.has_role(auth.uid(), 'teacher'));

-- ============= Availability (weekly recurring) =============
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  slot_time time not null,
  created_at timestamptz not null default now(),
  unique (day_of_week, slot_time)
);
alter table public.availability_rules enable row level security;

create policy "any signed-in user can read availability" on public.availability_rules
  for select to authenticated using (true);
create policy "teacher inserts availability" on public.availability_rules
  for insert to authenticated with check (public.has_role(auth.uid(), 'teacher'));
create policy "teacher deletes availability" on public.availability_rules
  for delete to authenticated using (public.has_role(auth.uid(), 'teacher'));

-- ============= Lessons =============
create type public.lesson_status as enum ('scheduled', 'completed', 'cancelled');

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60,
  status lesson_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  unique (scheduled_at)
);
alter table public.lessons enable row level security;

create policy "student sees own lessons, teacher sees all" on public.lessons
  for select to authenticated
  using (student_id = auth.uid() or public.has_role(auth.uid(), 'teacher'));
create policy "students cancel own lessons" on public.lessons
  for update to authenticated using (student_id = auth.uid());

-- ============= Credit balance helper =============
create or replace function public.credit_balance(_user_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select sum(credits_granted) from public.purchase_requests where student_id = _user_id and status = 'paid'), 0)
       - coalesce((select count(*)::int from public.lessons where student_id = _user_id and status <> 'cancelled'), 0);
$$;

-- ============= Booking RPC (atomic credit + slot check) =============
create or replace function public.book_lesson(_scheduled_at timestamptz)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _dow int := extract(dow from _scheduled_at)::int;
  _t time := _scheduled_at::time;
  _balance int;
  _new_id uuid;
begin
  if _uid is null then raise exception 'Not authenticated' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.availability_rules where day_of_week = _dow and slot_time = _t) then
    raise exception 'Slot not available' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.lessons where scheduled_at = _scheduled_at and status <> 'cancelled') then
    raise exception 'Slot already booked' using errcode = 'P0002';
  end if;
  _balance := public.credit_balance(_uid);
  if _balance < 1 then raise exception 'No credits' using errcode = 'P0005'; end if;
  insert into public.lessons (student_id, scheduled_at) values (_uid, _scheduled_at) returning id into _new_id;
  return _new_id;
end;
$$;

-- ============= Profile auto-creation trigger =============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _role app_role;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);

  _role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'student')::app_role;
  insert into public.user_roles (user_id, role) values (new.id, _role)
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============= Seed packages (same as previous project) =============
insert into public.packages (slug, name, price_cents, currency, duration, description, is_free, is_recommended, credits, sort_order) values
  ('trial',     'Free Trial',         0,    'USD', '30 minutes',  'Meet Yves and test the experience — no payment needed.', true,  false, 0,  1),
  ('single',    'Single Lesson',      2500, 'USD', '60 minutes',  'One private 1-on-1 lesson, perfect to try a paid class.', false, false, 1,  2),
  ('pack5',     '5 Lessons',          11500,'USD', '5 × 60 min',  'Save on a small bundle and build a steady weekly habit.',  false, false, 5,  3),
  ('pack10',    '10 Lessons',         21000,'USD', '10 × 60 min', 'Best value bundle — most popular choice for serious learners.', false, true, 10, 4);