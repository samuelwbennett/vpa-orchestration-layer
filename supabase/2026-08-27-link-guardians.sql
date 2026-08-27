-- =====================================================
-- Link Dan and Skip as guardians of Jackson
-- -----------------------------------------------------
-- PREREQUISITE: each of them must sign up ONCE at
-- https://app.elevateedwards.com (email + password) so an
-- auth.users row exists. This script then promotes each to the
-- 'parent' role and links them to Jackson.
--
-- Edit the three emails below, then run the whole block.
-- Idempotent — safe to re-run (e.g. after the second person signs up).
-- =====================================================

do $$
declare
  -- EDIT THESE ------------------------------------------------
  v_guardian_emails text[] := array[
    'dan@example.com',
    'skip@example.com'
  ];
  v_student_name    text   := 'Jackson';
  -- -----------------------------------------------------------

  v_email      text;
  v_auth_uid   uuid;
  v_org_id     uuid;
  v_student_id uuid;
  v_linked     int := 0;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);

  select id into v_student_id
    from public.students
   where display_name ilike v_student_name || '%'
     and archived_at is null
   order by created_at
   limit 1;

  if v_student_id is null then
    raise exception 'no student matching "%"', v_student_name;
  end if;

  select organization_id into v_org_id
    from public.students where id = v_student_id;

  foreach v_email in array v_guardian_emails loop
    select id into v_auth_uid from auth.users where email = v_email;

    if v_auth_uid is null then
      raise notice 'SKIPPED % — no account yet; have them sign up first, then re-run.', v_email;
      continue;
    end if;

    insert into public.guardians (id, email)
    values (v_auth_uid, v_email)
    on conflict (id) do nothing;

    insert into public.user_profiles (auth_user_id, role, organization_id)
    values (v_auth_uid, 'parent', v_org_id)
    on conflict (auth_user_id) do update
      set role = 'parent',
          organization_id = coalesce(
            user_profiles.organization_id, excluded.organization_id);

    insert into public.guardian_students
      (guardian_id, student_id, relationship, primary_guardian)
    values (v_auth_uid, v_student_id, 'parent', false)
    on conflict (guardian_id, student_id) do nothing;

    v_linked := v_linked + 1;
    raise notice 'linked % → %', v_email, v_student_name;
  end loop;

  raise notice 'done · guardians linked = %', v_linked;
end $$;

-- Sanity check: who can see Jackson?
select u.email, up.role
  from public.guardian_students gs
  join auth.users u on u.id = gs.guardian_id
  left join public.user_profiles up on up.auth_user_id = u.id
  join public.students s on s.id = gs.student_id
 where s.display_name ilike 'Jackson%';
