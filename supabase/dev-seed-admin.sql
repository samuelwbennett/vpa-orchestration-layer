-- ============================================================
-- VPA Learning OS — dev seed: promote yourself to admin
-- ============================================================
-- Run in the Supabase SQL editor.
--
-- What this does:
--   Promotes your user_profiles row to role 'admin' (creates the
--   row if missing). Pairs with migration 0009 — once you're admin,
--   the AdminView in the orchestration layer can see every class,
--   teacher, and student in your organization.
--
-- Edit the email if needed, then run the whole block.
-- Idempotent — safe to re-run.
--
-- Note: as of the upgrade-only patch in provision-self.js, this
-- admin role IS preserved across sign-ins — provision-self will
-- never silently downgrade a manually-set higher role. (Before that
-- patch, this seed needed the ADMIN_EMAIL_ALLOWLIST env var to
-- stick.) Adding the email to ADMIN_EMAIL_ALLOWLIST on the
-- reading-academy Vercel project is still the cleaner option for
-- ongoing admins; this seed is the quick path for testing.
-- ============================================================

do $$
declare
  -- ---------- EDIT IF NEEDED ----------
  v_email text := 'samuel.bennett425@gmail.com';
  -- ------------------------------------

  v_auth_uid uuid;
  v_org_id   uuid;
begin
  -- Tell the role_lock trigger (0005/0006) we're acting as service_role
  -- for this transaction. set_config(.., true) is transaction-local.
  perform set_config('request.jwt.claim.role', 'service_role', true);

  select id into v_auth_uid from auth.users where email = v_email;
  if v_auth_uid is null then
    raise exception
      'no auth.users row for email = %  -- sign in once via the dashboard first, then re-run',
      v_email;
  end if;

  -- Use the seeded pilot org if it exists; otherwise leave null.
  select id into v_org_id from public.organizations where slug = 'vpa-pilot';

  -- Promote to admin (insert-or-update).
  insert into public.user_profiles (auth_user_id, role, organization_id)
  values (v_auth_uid, 'admin', v_org_id)
  on conflict (auth_user_id) do update
    set role = 'admin',
        organization_id = coalesce(
          user_profiles.organization_id,
          excluded.organization_id
        );

  raise notice 'admin promoted · email=%', v_email;
end $$;

-- Quick sanity check.
select
  u.email,
  up.role,
  up.organization_id
from auth.users u
left join public.user_profiles up on up.auth_user_id = u.id
where u.email = 'samuel.bennett425@gmail.com';
