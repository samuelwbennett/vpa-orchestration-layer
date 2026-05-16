-- ============================================================
-- VPA Learning OS — 0009: admin org-wide visibility
-- ============================================================
-- Adds admin-scoped SELECT policies so a role='admin' user can see
-- every class, membership, student, and user profile in their
-- organization. Strictly additive — no existing tables or policies
-- are dropped or altered; the older teacher/student policies stay
-- in place and a non-admin sees no change in behaviour.
--
-- Pairs with the AdminView in the orchestration layer (Step 3 of
-- UNIFIED-EXPERIENCE-BLUEPRINT.md), which queries these tables
-- directly through the anon client and relies on RLS to scope to
-- the admin's org.
--
-- The is_admin() and current_org_id() helpers were added in 0006.
--
-- Idempotent. Safe to re-run.
-- ============================================================

-- teacher_classes: an admin sees every class in their org.
drop policy if exists tc_admin_select on public.teacher_classes;
create policy tc_admin_select on public.teacher_classes for select
  using (
    public.is_admin()
    and (
      organization_id is null
      or organization_id = public.current_org_id()
    )
  );

-- class_memberships: an admin sees every membership whose class is
-- in their org.
drop policy if exists cm_admin_select on public.class_memberships;
create policy cm_admin_select on public.class_memberships for select
  using (
    public.is_admin()
    and exists (
      select 1 from public.teacher_classes tc
      where tc.id = class_memberships.class_id
        and (
          tc.organization_id is null
          or tc.organization_id = public.current_org_id()
        )
    )
  );

-- students: an admin sees every student who is a member of at least
-- one class in their org. Orphan students (not in any class) remain
-- invisible by design — they aren't yet "part of" the program.
drop policy if exists students_admin_select on public.students;
create policy students_admin_select on public.students for select
  using (
    public.is_admin()
    and exists (
      select 1
      from public.class_memberships cm
      join public.teacher_classes tc on tc.id = cm.class_id
      where cm.student_id = students.id
        and (
          tc.organization_id is null
          or tc.organization_id = public.current_org_id()
        )
    )
  );

-- user_profiles: an admin reads every profile in their org so the
-- admin overview can show teacher (and, later, parent) names.
drop policy if exists user_profiles_admin_select on public.user_profiles;
create policy user_profiles_admin_select on public.user_profiles for select
  using (
    public.is_admin()
    and organization_id = public.current_org_id()
  );
