# VPA Learning OS — Role & Identity Schema (canonical home)

This folder is the **canonical home of the VPA role and identity schema** — the
`user_profiles` model that the unified student / teacher / admin / parent
experience is built on. See `../UNIFIED-EXPERIENCE-BLUEPRINT.md` for the plan
and `../ECOSYSTEM-MAP.md` for where this sits in the wider system.

## What's here

`migrations/` — the role-schema migrations. They originated in the
`reading-academy` repo (which had the most developed auth/role architecture)
and were copied here on 2026-05-15 as the canonical source, per the blueprint's
"move the role schema to a shared home" decision.

| File | Defines |
|---|---|
| `0004_teacher_roster.sql` | `teacher_classes`, `class_memberships`, the `teacher_can_see_student()` RLS helper |
| `0005_user_profiles.sql` | `user_profiles` (`role` ∈ student/teacher/admin/parent), `current_user_role()`, `is_teacher()` |
| `0006_role_architecture.sql` | `organizations`, `teachers`, org scoping, `is_admin()`, `current_org_id()` |
| `0007_student_invites.sql` | `student_invites` — teacher-minted, single-use student onboarding tokens |
| `0008_student_passwordless_auth.sql` | passwordless student login (class code → avatar → PIN), `student_sessions` |

## Important context

**These migrations have already been applied** to the shared Supabase project
(`dtkrnyberbpfdmikpdnw`). They live here as the canonical *definition* of the
role schema — not as pending work. Do not blindly run `supabase db push` from
this folder; coordinate with the team first.

**The base schema is a prerequisite, owned elsewhere (for now).** These
migrations extend tables — `students`, `auth.users` — that come from the older
`guardians`-era schema in `math-facts-trainer-react/supabase/migrations/`
(`001_initial_schema.sql`, `002_student_auth_and_incentives.sql`). That base
schema is the other half of the current two-model state described in the
blueprint. The role schema is *additive* — it sits alongside the base tables,
which is what makes the bridge possible.

**Provisioning is server-controlled, not a migration.** `user_profiles` rows are
created by the `/api/provision-self` endpoint (currently hosted in the
`reading-academy` deployment) — it is idempotent, decides the role server-side
via email allowlists, and is called by an app on sign-in. The orchestration
layer calls it through `src/services/auth.js → provisionSelf()`. There is
deliberately **no bulk backfill migration**: each user's `user_profiles` row is
created lazily, server-side, the first time they sign in.

## Open follow-ups (later blueprint steps)

- The `reading-academy` repo still has its own copies of these migrations —
  retire those once this home is confirmed as canonical.
- The `provision-self` (and sibling `provision-*`) endpoints are good
  candidates to move to a shared home alongside this schema — tracked as part
  of Step 5 (reconcile the verticals).
