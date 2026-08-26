-- =====================================================
-- learning_sessions — dashboard focus-timer sessions
-- -----------------------------------------------------
-- One row per completed session: the student launched a timed app
-- (ASU Prep, Math Academy) from the dashboard and later stopped the
-- timer (or it hit the safety cap). Rows are INSERTED COMPLETE on
-- stop — there are no open rows to garbage-collect; an in-progress
-- session lives only in the browser (localStorage) until it ends.
--
-- Written directly from the browser under RLS (like auth's own
-- students lookup): a signed-in student can insert/read ONLY rows
-- for the student record linked to their auth user. Parent/teacher
-- rollups can come later through the server-side proxies
-- (service-role key bypasses RLS).
--
-- Run this in the Supabase SQL editor (project dtkrnyberbpfdmikpdnw).
-- Idempotent — safe to run twice.
-- =====================================================

create table if not exists public.learning_sessions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students (id) on delete cascade,
  app_id      text not null check (app_id in ('asu-prep', 'math-academy')),
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  seconds     integer not null check (seconds >= 0 and seconds <= 14400),
  source      text not null default 'dashboard',
  created_at  timestamptz not null default now(),
  check (ended_at >= started_at)
);

create index if not exists learning_sessions_student_started_idx
  on public.learning_sessions (student_id, started_at desc);

alter table public.learning_sessions enable row level security;

-- A student may read their own sessions.
drop policy if exists "students read own sessions" on public.learning_sessions;
create policy "students read own sessions"
  on public.learning_sessions for select
  using (
    student_id in (
      select id from public.students where auth_user_id = auth.uid()
    )
  );

-- A student may record their own sessions.
drop policy if exists "students insert own sessions" on public.learning_sessions;
create policy "students insert own sessions"
  on public.learning_sessions for insert
  with check (
    student_id in (
      select id from public.students where auth_user_id = auth.uid()
    )
  );

-- No update/delete policies: sessions are append-only from the
-- browser. Corrections happen server-side if ever needed.
