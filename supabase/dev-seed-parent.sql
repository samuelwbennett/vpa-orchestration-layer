-- ============================================================
-- VPA Learning OS — dev seed: promote yourself to parent + link kids
-- ============================================================
-- Run in the Supabase SQL editor.
--
-- What this does:
--   1. Ensures a `guardians` row for you (the auto-trigger usually
--      makes one on first sign-in, but be safe).
--   2. Promotes your user_profiles row to role 'parent'.
--   3. Links the 2 most recently-created students to you via
--      guardian_students so the parent view has children to render.
--
-- Edit the email if needed, then run the whole block. Idempotent.
--
-- Note: this seed assumes the provision-self self-heal patch is
-- deployed (the one that limits self-heal to student-default users).
-- Without that patch, owning a teacher_classes row will auto-upgrade
-- you out of 'parent' on the next sign-in.
-- ============================================================

do $$
declare
  v_email text := 'samuel.bennett425@gmail.com';

  v_auth_uid uuid;
  v_org_id   uuid;
  v_added    int := 0;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);

  select id into v_auth_uid from auth.users where email = v_email;
  if v_auth_uid is null then
    raise exception
      'no auth.users row for email = %  -- sign in once first', v_email;
  end if;

  select id into v_org_id from public.organizations where slug = 'vpa-pilot';

  -- 1. Ensure guardians row exists.
  insert into public.guardians (id, email)
  values (v_auth_uid, v_email)
  on conflict (id) do nothing;

  -- 2. Promote to parent.
  insert into public.user_profiles (auth_user_id, role, organization_id)
  values (v_auth_uid, 'parent', v_org_id)
  on conflict (auth_user_id) do update
    set role = 'parent',
        organization_id = coalesce(
          user_profiles.organization_id,
          excluded.organization_id
        );

  -- 3. Link to the 2 most recently-created students.
  insert into public.guardian_students (guardian_id, student_id, relationship, primary_guardian)
  select v_auth_uid, s.id, 'parent', true
    from public.students s
   where s.archived_at is null
   order by s.created_at desc
   limit 2
  on conflict (guardian_id, student_id) do nothing;

  get diagnostics v_added = row_count;
  raise notice 'parent linked · email=% · children added=%', v_email, v_added;
end $$;

-- Sanity check.
select
  u.email,
  up.role,
  (
    select count(*)
    from public.guardian_students gs
    where gs.guardian_id = u.id
  ) as children_linked
from auth.users u
left join public.user_profiles up on up.auth_user_id = u.id
where u.email = 'samuel.bennett425@gmail.com';
