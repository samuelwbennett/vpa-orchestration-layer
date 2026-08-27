-- =====================================================
-- Guardian read access to the load-model tables
-- -----------------------------------------------------
-- learning_sessions and daily_checkins shipped with student-only
-- policies. The parent dashboard needs Dan and Skip (guardians linked
-- to Jackson via guardian_students) to READ those rows — never to
-- write them. Effort ratings stay Jackson's to enter.
--
-- Mirrors the existing guardian pattern: guardian_students.guardian_id
-- is the guardian's auth uid.
--
-- Run in the Supabase SQL editor (project dtkrnyberbpfdmikpdnw).
-- Idempotent — safe to run twice.
-- =====================================================

drop policy if exists "guardians read child sessions" on public.learning_sessions;
create policy "guardians read child sessions"
  on public.learning_sessions for select
  using (
    student_id in (
      select gs.student_id
        from public.guardian_students gs
       where gs.guardian_id = auth.uid()
    )
  );

drop policy if exists "guardians read child checkins" on public.daily_checkins;
create policy "guardians read child checkins"
  on public.daily_checkins for select
  using (
    student_id in (
      select gs.student_id
        from public.guardian_students gs
       where gs.guardian_id = auth.uid()
    )
  );

-- Deliberately NO guardian insert/update policies: parents watch,
-- they don't log sessions or rate effort on their kid's behalf.
