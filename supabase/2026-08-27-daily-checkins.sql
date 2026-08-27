-- =====================================================
-- daily_checkins — the two-tap end-of-day effort ratings
-- -----------------------------------------------------
-- Foster session-RPE applied symmetrically: one CR-10 rating for
-- mental effort ("school-brain") and one for physical effort
-- ("training-body") per student per local day. The dashboard's load
-- model multiplies these by measured minutes to get daily learning
-- and physical load.
--
-- Same trust model as learning_sessions: direct browser writes under
-- RLS. One row per (student, day); the student can update their own
-- row (re-rating the same evening is allowed and normal).
--
-- Run in the Supabase SQL editor (project dtkrnyberbpfdmikpdnw).
-- Idempotent — safe to run twice.
-- =====================================================

create table if not exists public.daily_checkins (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students (id) on delete cascade,
  day         date not null,
  mind_rpe    integer check (mind_rpe between 1 and 10),
  body_rpe    integer check (body_rpe between 1 and 10),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (student_id, day)
);

alter table public.daily_checkins enable row level security;

drop policy if exists "students read own checkins" on public.daily_checkins;
create policy "students read own checkins"
  on public.daily_checkins for select
  using (
    student_id in (
      select id from public.students where auth_user_id = auth.uid()
    )
  );

drop policy if exists "students insert own checkins" on public.daily_checkins;
create policy "students insert own checkins"
  on public.daily_checkins for insert
  with check (
    student_id in (
      select id from public.students where auth_user_id = auth.uid()
    )
  );

drop policy if exists "students update own checkins" on public.daily_checkins;
create policy "students update own checkins"
  on public.daily_checkins for update
  using (
    student_id in (
      select id from public.students where auth_user_id = auth.uid()
    )
  )
  with check (
    student_id in (
      select id from public.students where auth_user_id = auth.uid()
    )
  );
