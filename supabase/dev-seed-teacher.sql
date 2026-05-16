-- ============================================================
-- VPA Learning OS — dev seed: promote yourself to teacher + roster
-- ============================================================
-- Run in the Supabase SQL editor (which bypasses RLS).
--
-- What this does:
--   1. Promotes your user_profiles row to role 'teacher'
--      (creates it if missing) and ensures a matching `teachers` row.
--   2. Creates a single teacher_classes row owned by you (reuses an
--      existing one with the same name + owner if you re-run).
--   3. Links the 5 most recently-created students in the DB to that
--      class so the teacher view has something to render.
--
-- Edit the two variables at the top, then run the whole block.
-- Idempotent — safe to re-run.
-- ============================================================

do $$
declare
  -- ---------- EDIT THESE ----------
  v_email       text := 'you@example.com';   -- the email you sign in with
                                              -- (must have signed in once,
                                              --  so auth.users has a row)
  v_class_name  text := 'Test Roster';       -- whatever you want it called
  v_grade_label text := '4';                 -- free text, optional
  -- --------------------------------

  v_auth_uid uuid;
  v_org_id   uuid;
  v_class_id uuid;
  v_added    int;
begin
  -- Tell the role_lock trigger (defined in 0005/0006) we're acting
  -- as service_role for this transaction. set_config(.., true) is
  -- transaction-local — nothing changes outside this DO block.
  perform set_config('request.jwt.claim.role', 'service_role', true);

  -- Resolve your auth user.
  select id into v_auth_uid from auth.users where email = v_email;
  if v_auth_uid is null then
    raise exception
      'no auth.users row for email = %  -- sign in once via the dashboard first, then re-run',
      v_email;
  end if;

  -- Use the seeded pilot org if it exists; otherwise leave null.
  select id into v_org_id from public.organizations where slug = 'vpa-pilot';

  -- 1. Promote to teacher (insert-or-update).
  insert into public.user_profiles (auth_user_id, role, organization_id)
  values (v_auth_uid, 'teacher', v_org_id)
  on conflict (auth_user_id) do update
    set role = 'teacher',
        organization_id = coalesce(
          user_profiles.organization_id,
          excluded.organization_id
        );

  -- Ensure a `teachers` row too — some flows look for it.
  insert into public.teachers (auth_user_id, organization_id)
  values (v_auth_uid, v_org_id)
  on conflict (auth_user_id) do nothing;

  -- 2. Reuse an existing matching class, else create one.
  select id into v_class_id
    from public.teacher_classes
   where teacher_user_id = v_auth_uid
     and name = v_class_name
     and archived = false
   limit 1;

  if v_class_id is null then
    insert into public.teacher_classes
      (teacher_user_id, name, grade_level, organization_id)
    values
      (v_auth_uid, v_class_name, v_grade_label, v_org_id)
    returning id into v_class_id;
  end if;

  -- 3. Add the 5 most recently-created students to the class.
  --    Tweak the WHERE / LIMIT if you want specific students.
  insert into public.class_memberships (class_id, student_id)
  select v_class_id, s.id
    from public.students s
   where s.archived_at is null
   order by s.created_at desc
   limit 5
  on conflict (class_id, student_id) do nothing;

  get diagnostics v_added = row_count;

  raise notice 'seed complete · email=% · class=% · students added=%',
    v_email, v_class_name, v_added;
end $$;

-- ============================================================
-- Quick sanity check (edit the email here too if you changed it above).
-- ============================================================
with me as (
  select id from auth.users where email = 'you@example.com'
)
select
  (select role
     from public.user_profiles
    where auth_user_id = (select id from me))                  as your_role,
  (select count(*)
     from public.teacher_classes
    where teacher_user_id = (select id from me)
      and archived = false)                                    as your_classes,
  (select count(*)
     from public.class_memberships cm
     join public.teacher_classes tc on tc.id = cm.class_id
    where tc.teacher_user_id = (select id from me))            as students_in_your_roster;
