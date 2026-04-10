-- ============================================================
-- Campus Opportunities Portal — Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- ── 1. PROFILES ─────────────────────────────────────────────
-- Extends auth.users with app-specific fields (role, name, etc.)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text not null,
  role        text not null check (role in ('student', 'admin')),
  department  text,
  -- student-specific
  year        text,
  -- admin-specific
  title       text,
  avatar      text,   -- 2-letter initials e.g. "AJ"
  created_at  timestamptz default now()
);

-- ── 2. OPPORTUNITIES ────────────────────────────────────────
create table if not exists public.opportunities (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null,
  department  text,
  description text,
  deadline    date not null,
  vacancies   integer default 1,
  stipend     text,
  eligibility text,
  status      text not null default 'active' check (status in ('active', 'draft', 'closed')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz default now()
);

-- ── 3. APPLICATIONS ─────────────────────────────────────────
create table if not exists public.applications (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles(id) on delete cascade,
  opportunity_id  uuid not null references public.opportunities(id) on delete cascade,
  status          text not null default 'pending'
                    check (status in ('pending', 'reviewing', 'approved', 'rejected')),
  cover_note      text,
  applied_at      timestamptz default now(),
  unique (student_id, opportunity_id)   -- one application per student per opportunity
);

-- ── 4. ROW LEVEL SECURITY ───────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.opportunities enable row level security;
alter table public.applications  enable row level security;

-- Drop existing policies before recreating (safe to re-run)
drop policy if exists "profiles: own read"            on public.profiles;
drop policy if exists "profiles: admin read all"      on public.profiles;
drop policy if exists "profiles: insert on signup"    on public.profiles;
drop policy if exists "profiles: own update"          on public.profiles;
drop policy if exists "opportunities: authenticated read active" on public.opportunities;
drop policy if exists "opportunities: admin read all" on public.opportunities;
drop policy if exists "opportunities: admin insert"   on public.opportunities;
drop policy if exists "opportunities: admin update"   on public.opportunities;
drop policy if exists "opportunities: admin delete"   on public.opportunities;
drop policy if exists "applications: student own"         on public.applications;
drop policy if exists "applications: admin read all"      on public.applications;
drop policy if exists "applications: student insert"      on public.applications;
drop policy if exists "applications: student cancel own"  on public.applications;
drop policy if exists "applications: admin update status" on public.applications;

-- profiles: users can read their own row; admins can read all
create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: admin read all"
  on public.profiles for select
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin');

create policy "profiles: insert on signup"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id);

-- opportunities: everyone authenticated can read active ones
create policy "opportunities: authenticated read active"
  on public.opportunities for select
  using (auth.role() = 'authenticated' and status = 'active');

create policy "opportunities: admin read all"
  on public.opportunities for select
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin');

create policy "opportunities: admin insert"
  on public.opportunities for insert
  with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin');

create policy "opportunities: admin update"
  on public.opportunities for update
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin');

create policy "opportunities: admin delete"
  on public.opportunities for delete
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin');

-- applications: students see only their own; admins see all
create policy "applications: student own"
  on public.applications for select
  using (auth.uid() = student_id);

create policy "applications: admin read all"
  on public.applications for select
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin');

create policy "applications: student insert"
  on public.applications for insert
  with check (
    auth.uid() = student_id
    and coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'student'
  );

create policy "applications: student cancel own"
  on public.applications for delete
  using (auth.uid() = student_id and status = 'pending');

create policy "applications: admin update status"
  on public.applications for update
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin');

-- ── 5. TRIGGER: auto-create profile on signup ───────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role, department, year, title, avatar)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data->>'role' in ('student', 'admin', 'mentor')
      then new.raw_user_meta_data->>'role'
      else 'student'
    end,
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'year',
    new.raw_user_meta_data->>'title',
    upper(left(coalesce(new.raw_user_meta_data->>'name', new.email), 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 6. SEED DATA ────────────────────────────────────────────
-- NOTE: These insert directly into opportunities with a null created_by.
-- After you create your admin account, you can update created_by manually.

-- ── ADDENDUM: Mentor Role + Messaging (run this block in SQL Editor) ────────

-- 1. Allow 'mentor' as a valid role
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('student', 'admin', 'mentor'));

-- 2. Messages table
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  read        boolean default false,
  created_at  timestamptz default now()
);
alter table public.messages enable row level security;

drop policy if exists "messages: participants can read"  on public.messages;
drop policy if exists "messages: authenticated can send" on public.messages;
drop policy if exists "messages: receiver can mark read" on public.messages;

create policy "messages: participants can read"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "messages: authenticated can send"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "messages: receiver can mark read"
  on public.messages for update
  using (auth.uid() = receiver_id);

-- 3. Mentor opportunity policies
drop policy if exists "opportunities: mentor read all"   on public.opportunities;
drop policy if exists "opportunities: mentor insert own" on public.opportunities;
drop policy if exists "opportunities: mentor update own" on public.opportunities;
drop policy if exists "opportunities: mentor delete own" on public.opportunities;

create policy "opportunities: mentor read all"
  on public.opportunities for select
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'mentor');

create policy "opportunities: mentor insert own"
  on public.opportunities for insert
  with check (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'mentor'
    and auth.uid() = created_by
  );

create policy "opportunities: mentor update own"
  on public.opportunities for update
  using (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'mentor'
    and auth.uid() = created_by
  );

create policy "opportunities: mentor delete own"
  on public.opportunities for delete
  using (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'mentor'
    and auth.uid() = created_by
  );

-- 4. Mentor application policies
drop policy if exists "applications: mentor read own opps"  on public.applications;
drop policy if exists "applications: mentor update status"  on public.applications;

create policy "applications: mentor read own opps"
  on public.applications for select
  using (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'mentor'
    and opportunity_id in (
      select id from public.opportunities where created_by = auth.uid()
    )
  );

create policy "applications: mentor update status"
  on public.applications for update
  using (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'mentor'
    and opportunity_id in (
      select id from public.opportunities where created_by = auth.uid()
    )
  );

-- 5. Cross-role profile visibility (for messaging)
drop policy if exists "profiles: mentor read all"      on public.profiles;
drop policy if exists "profiles: students read mentors" on public.profiles;

create policy "profiles: mentor read all"
  on public.profiles for select
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'mentor');

create policy "profiles: students read mentors"
  on public.profiles for select
  using (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'student'
    and role = 'mentor'
  );

-- ── END ADDENDUM ────────────────────────────────────────────────────────────

-- ── 7. ADMIN HELPER FUNCTIONS ───────────────────────────────
-- These run as postgres (SECURITY DEFINER) so they can call auth.admin APIs
-- Only callable by users whose JWT role = 'admin'

create or replace function public.admin_set_user_role(target_user_id uuid, new_role text)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if new_role not in ('student', 'mentor', 'admin') then
    raise exception 'Invalid role: %', new_role;
  end if;

  -- update auth.users metadata
  update auth.users
  set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', new_role)
  where id = target_user_id;

  -- update profiles table
  update public.profiles
  set role = new_role
  where id = target_user_id;
end;
$$;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  -- delete from auth.users (cascades to profiles via FK)
  delete from auth.users where id = target_user_id;
end;
$$;

-- Only admins can call these functions
revoke all on function public.admin_set_user_role(uuid, text) from public;
revoke all on function public.admin_delete_user(uuid)         from public;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid)         to authenticated;

insert into public.opportunities (title, category, department, description, deadline, vacancies, stipend, eligibility, status)
values
  (
    'Summer Research Fellowship 2024',
    'Research Grant',
    'Department of Life Sciences',
    'A prestigious 10-week immersive research fellowship. Work alongside leading faculty on cutting-edge projects in genomics, neurobiology, and environmental science.',
    '2024-11-15', 12, '$4,500',
    'Open to 2nd and 3rd year undergraduate students with GPA ≥ 3.2',
    'active'
  ),
  (
    'Neuroscience Lab Assistant',
    'Research Grant',
    'School of Medicine',
    'Support ongoing neuroscience research, assist with lab procedures, data collection and analysis under faculty supervision.',
    '2024-11-20', 4, 'Unpaid (credit eligible)',
    'Pre-med or neuroscience majors preferred',
    'active'
  ),
  (
    'Digital Archives Curator',
    'Internship',
    'University Library',
    'Help digitize and organize the university''s historical archives. Gain experience with metadata standards and digital preservation.',
    '2024-11-28', 3, '$15/hr',
    'Any major. Strong attention to detail required.',
    'active'
  ),
  (
    'Web Developer Intern',
    'Internship',
    'IT Services',
    'Build and maintain university web applications. Work with React, Node.js, and PostgreSQL in an agile team environment.',
    '2024-12-05', 5, '$20/hr',
    'CS or related major. Experience with HTML/CSS/JS required.',
    'active'
  ),
  (
    'Global Humanities Grant',
    'Scholarship',
    'Faculty of Arts',
    'Funding for humanities students to pursue independent research projects of cultural or historical significance.',
    '2024-12-12', 8, '$2,000',
    'Humanities majors in good academic standing',
    'active'
  ),
  (
    'Data Science Fellowship',
    'Research Grant',
    'Statistics & Computer Science',
    'Work on real-world data challenges alongside the analytics team. Develop skills in Python, machine learning, and statistical modeling.',
    '2024-12-18', 6, '$3,500',
    'Statistics, Math, or CS majors. Python proficiency required.',
    'active'
  ),
  (
    'Teaching Assistant — Economics',
    'Teaching Assistant',
    'School of Economics',
    'Assist professors with tutorials, grading, and office hours for introductory economics courses.',
    '2025-01-05', 20, '$12/hr',
    'Students who have completed ECON 201 with grade B or above',
    'active'
  );
