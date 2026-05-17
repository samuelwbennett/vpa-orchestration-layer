# VPA Learning OS — Unified Experience Blueprint

*The spec for one role-aware front door — student, teacher, admin, parent — built into the orchestration layer. No app code yet: this is the plan, grounded in an audit of the auth and role code that already exists across the repos.*

*Written 2026-05-15. Companion to `ECOSYSTEM-MAP.md` and `ARCHITECTURE.md`.*

---

## The goal

One sign-in. Four experiences. Each role sees a simple, Apple-clean view of only what they can act on. The unified experience lives **in this repo** (the orchestration layer) — it's already the launcher that pulls every app together, so this is finishing it, not starting over.

## The audit finding that shapes everything: there are two role models

The auth code already exists — but in two incompatible shapes, both live in the same Supabase project (`dtkrnyberbpfdmikpdnw`):

| | The `guardians` model | The `user_profiles` model |
|---|---|---|
| **Where** | `math-facts-trainer-react` migrations 001–002 | `reading-academy` migrations 0004–0008 |
| **Used by** | orchestration layer, Math Facts, Reading Facts | Reading Academy |
| **"Role"** | a `relationship` text field on `guardian_students` (`parent`/`teacher`/`tutor`) | an explicit `user_profiles.role` (`student`/`teacher`/`admin`/`parent`) |
| **Scoping** | none | `organizations` table + `current_org_id()` |
| **Classes** | none | `teacher_classes` + `class_memberships` |
| **Student login** | Supabase Auth only | Supabase Auth **+ passwordless** (class code → avatar → PIN) |
| **Admin** | doesn't exist | first-class role, with an `is_admin()` helper |

**The foundational decision: standardize on Reading Academy's `user_profiles` model.** It already has everything the unified experience needs — explicit roles including admin, the `organizations` scoping that makes "single program, built to scale" a config change rather than a rewrite, the class/membership tables the teacher view runs on, passwordless student login for K-2, and clean SQL-enforced RLS. The `guardians` model has none of that.

So the core work is not *inventing* auth — it's **upgrading the orchestration layer onto the role model Reading Academy already built**, and bringing Math Facts and Reading Facts along.

## Auth model

- **Supabase Auth** (email + password, or magic link) for teachers, admins, and older students/parents. One Supabase project, one shared session → signing in once works across every app. This is the SSO the orchestration contract already assumes.
- **Passwordless** for young students: class code → tap your name + avatar → 4-digit PIN. Already built in Reading Academy (`0008_student_passwordless_auth.sql` + `useStudentSession.js`); it issues a `student_sessions` token validated by the API layer.
- **`user_profiles.role` is the single source of truth for routing.** Sign in → resolve role → land in the right experience. Role changes are service-role only (already trigger-locked) — clients can't self-promote.

## The four experiences

The rule for all four: **show only what this person can act on.** Not a settings labyrinth — a surface that answers "what do I do now?"

### Student
Essentially today's orchestration dashboard, kept as-is: rings, today's plan, progress, earnings.
**Actionable data:** what to do today, how close to the daily goal, the streak to protect.
**Status:** largely built — it's the current dashboard.

### Teacher
Their roster (via `teacher_classes` → `class_memberships`), every student's status across all four apps, and an intervention queue: who's stuck, off-pace, or disengaged *today* — with one-tap drill-down per student.
**Actionable data:** who needs me, and for what.
**Status:** the gap. The MVP teacher dashboard in `mathacademy-sync/dashboard/` is the seed of this, but it's siloed — Math-Academy-only, reads flat files. The unified teacher view runs on live multi-app data through `orchestrator.js`.

### Admin (single program, built to scale)
Everything inside their `organization` — all classes, teachers, and students — plus program health (attendance, XP, mastery rollups) and provisioning (add a teacher, add a class, invite students).
**Actionable data:** is the program working, and where's the friction.
**Status:** doesn't exist yet. Scoped today to one `organization` via `current_org_id()`; multi-program later is simply an admin who can see more than one org — a permission change, not a rebuild. That's the "built to scale" hook, and it's already in the schema.

### Parent
Their own child or children only — scoped through `guardian_students` — as a read-only, family-friendly slice of the student view: progress, today's goal, wins worth celebrating.
**Actionable data:** how my kid is doing, and what to encourage at home.
**Status:** new. Confirmed in v1 (2026-05-15).

## Routing

Sign in → resolve `user_profiles.role` → route:

| Role | Lands on | Notes |
|---|---|---|
| `student` | `/` | the dashboard that already exists |
| `teacher` | `/teacher` | new |
| `admin` | `/admin` | new |
| `parent` | `/parent` | new — sees their own children via `guardian_students` |
| signed in, no profile | holding screen | today's `AccountUnlinked` is the pattern |

Reading Academy already has the machinery — `src/lib/auth/RequireRole.jsx` and a centralized `src/config/routes.js`. Lift that pattern into the orchestration layer rather than reinventing it.

## What to reuse, build, and reconcile

**Reuse (already built):**
- Supabase Auth, the shared project, the anon-key + RLS posture
- Reading Academy's role schema: `user_profiles`, `organizations`, `teachers`, `teacher_classes`, `class_memberships`, `student_invites`, `student_sessions`, and the helpers (`current_user_role`, `is_teacher`, `is_admin`, `current_org_id`, `teacher_can_see_student`, …)
- Reading Academy's `AuthProvider.jsx`, `RequireRole.jsx`, `useStudentSession.js`
- The orchestration layer's existing student components (DailyRings, TodayPlan, Insights, Earnings) and `orchestrator.js`
- The MVP teacher dashboard's `generateInsights` logic as a starting point for the teacher view

**Build (genuinely new):**
- A role-aware `useAuth` in the orchestration layer — today's is student-only (`loading`/`anonymous`/`unlinked`/`ready`, resolves `students.auth_user_id` and nothing else)
- The routing shell (`/`, `/teacher`, `/admin` + `RequireRole`)
- The teacher view — live, multi-app, roster + intervention queue
- The admin view — org rollups + provisioning UI (currently SQL / serverless only)

**Reconcile (the hard part — bridge, not big-bang):**
- Math Facts, Reading Facts, and the orchestration layer currently use the `guardians` model. The chosen approach is a **bridge**: `user_profiles` becomes the canonical role table immediately and the orchestration layer reads it, while the older apps keep running on `guardians`/`students` untouched and are migrated opportunistically (Step 5). This works because `user_profiles` is *additive* — it keys on `auth.users` and sits alongside the existing tables rather than replacing them. Lowest blast radius; every step stays deployable.

## Aesthetic

Apple-simple — already the house style (Apple Blue `#0071E3`, Inter, the rings). The discipline for this build: every screen answers one question for that role. If a teacher opens their view and can't immediately see "who needs me," it's wrong. Simplicity is the feature, not a finish.

## Decisions — locked 2026-05-15

1. **Role model** — standardize on Reading Academy's `user_profiles` model. Confirmed.
2. **Reconciliation approach** — a **bridge**, not a big-bang migration. `user_profiles` becomes canonical immediately; the older apps keep working and migrate last, opportunistically (Step 5). Lowest risk, every step stays deployable.
3. **Parent role** — **in v1.** Student, teacher, admin, *and* parent.
4. **Role schema home** — **move it.** The `user_profiles` / `organizations` / `teachers` / `teacher_classes` / `class_memberships` / `student_invites` / `student_sessions` migrations move out of `reading-academy/` to a shared/canonical location so the role model isn't owned by one vertical. (Pick the exact home — a top-level `vpa-schema/` repo, or this repo — at the start of Step 1.)

## Build sequence — five steps, each ships something usable

The bridge approach makes this ordering possible: the older apps keep working untouched until Step 5, so the user-facing value lands first and the riskiest work lands last.

### Step 1 — Shared role schema + role-aware login ✓ built 2026-05-15
- Copied the role migrations (`user_profiles`, `organizations`, `teachers`, `teacher_classes`, `class_memberships`, `student_invites`, `student_sessions`) into `vpa-orchestration-layer/supabase/migrations/` as the canonical home, with a `supabase/README.md` explaining the bridge.
- Provisioning reuses the existing server-controlled `/api/provision-self` endpoint instead of a new bulk migration — it's idempotent, decides role server-side, and creates the `user_profiles` row on first sign-in (a lazy per-user backfill). The `guardians` rows are left untouched — that's the bridge.
- Upgraded the orchestration layer's `useAuth` from student-only to role-aware: `role` is resolved from `user_profiles` via `provision-self`, with a legacy student-only fallback so the dashboard never hard-breaks.
- Added role routing in `App.jsx`: student → the existing dashboard; teacher / admin / parent → a clean `RolePlaceholder`. Kept as a role switch rather than pulling in `react-router`, for simplicity — URL routes can come later if the app grows to need them.
- **Ships:** a real role-based front door. A teacher, admin, or parent can sign in and land somewhere coherent instead of the "account isn't linked" dead-end. Verified with a clean production build; runtime sign-in flows still need a live test.

### Step 2 — Teacher view ✓ built 2026-05-15
- Built the teacher view in the orchestration layer: the roster (from `teacher_classes` → `class_memberships`, RLS-scoped to the signed-in teacher), each student's status across all four apps fanned out through `orchestrator.js` (concurrency-capped), and a "who needs you today" intervention queue with a one-tap per-student drill-down.
- `computeOnTrack` was extracted to `src/utils/onTrack.js` and shared between the student dashboard and the teacher view, so a student's pace reads the same to them and to their teacher.
- New: `TeacherView.jsx`, `useTeacherRoster.js`, `onTrack.js`; `App.jsx` routes role `teacher` to it.
- **Ships:** teachers get a real, live, multi-app dashboard — the biggest functional gap, closed. Verified with a clean production build; needs a live test, and a seeded class, to see the roster populated.

### Step 3 — Admin view ✓ built 2026-05-15 (read-only)
- Built the admin view in the orchestration layer: "Program at a glance" stats (students / classes / teachers / needs-attention), a cross-org intervention queue (top 10 + overflow), classes list, teachers list, and a full org roster with the same per-student drill-down as the teacher view.
- Org scoping works via RLS rather than a new server endpoint: migration `0009_admin_org_visibility.sql` adds admin-scoped SELECT policies on `teacher_classes`, `class_memberships`, `students`, and `user_profiles`, all gated by `is_admin()` + `current_org_id()`. The hook queries Supabase directly through the anon client.
- Shared the per-student summary helpers (`summarize`, `priority`, `appStatusLabel`) into `src/utils/onTrack.js` so the teacher and admin views use one source of truth.
- New: `AdminView.jsx`, `useAdminOverview.js`, migration `0009`. `App.jsx` routes role `admin` to it.
- **Scope note:** provisioning UI (add teacher / add class / invite students) is *not* in this step — it needs server-side write endpoints to do safely, which deserves its own deliberate build. For now the admin can see everything; writes still happen via the seed SQL or direct DB edits. Provisioning UI is a natural follow-up.
- **Ships:** an admin can read the whole program from a screen — the visibility piece is closed. Verified with a clean production build.

### Step 3.5 — Registration UI ✓ built 2026-05-17
- Closed the provisioning gap flagged in Step 3. Admins now have first-class "Create class" and "Add students to a class" forms inside the AdminView (`RegistrationPanel.jsx`, rendered as a "Manage" section under the roster). Bulk-add returns invite URLs with one-tap copy — designed for "I have a 25-name CSV from the registrar, give me 25 sign-in links."
- New endpoint `reading-academy/api/_handlers/create-class.js` (admin-only; service-role insert into `teacher_classes` on behalf of any teacher in the admin's org). Registered in `api/[...slug].js`.
- Patched `bulk-provision-students.js`: admin in the same org can now enroll into any class, not just their own. Teacher ownership rule unchanged for non-admin callers.
- New: `services/registration.js` (thin JWT-authed POST wrapper for both endpoints), `RegistrationPanel.jsx`, `.reg-*` styles in `global.css`.
- **Ships:** an admin can stand up a whole class without touching SQL. Verified with a clean production build (1573 modules). Requires a `reading-academy` redeploy to expose `/api/create-class` and the updated `bulk-provision-students`.

### Step 4 — Parent view ✓ built 2026-05-16
- Built the parent view in the orchestration layer: one card per child, with the child's name, an "on-track" pill in warmer parent tone (`On Track` / `Building up` / `Just getting started`), today's pace, today's wins (apps where the goal was met), and an expandable per-app drill-down. Empty state when no children are linked yet.
- The bridge was the feature here, as predicted: `user_profiles.role = 'parent'` drives routing, the older `guardian_students` table drives which children the parent sees. RLS (`guardian_students_select_own` + `students_select_via_guardian`) does the scoping — no new server endpoint needed.
- Patched `reading-academy/api/_handlers/provision-self.js` so the teacher self-heal only runs for student-default users — a manually-set parent or admin no longer gets auto-upgraded to teacher just because they own a `teacher_classes` row. (Without this, a parent who's also a teacher would never stay parent across sign-ins.)
- New: `ParentView.jsx`, `useParentChildren.js`, `dev-seed-parent.sql`. `App.jsx` routes role `parent` to it.
- **Ships:** parents get visibility — "actionable data for all" is now literally all four roles. Verified with a clean production build; needs a redeploy of `reading-academy` to pick up the provision-self patch.

### Step 5 — Reconcile the verticals
- **Part A — integration seam closed ✓ 2026-05-17.** Wired the contract v1.0 `/api/today` + `/api/xp` endpoints into the launcher:
  - `services/readingAcademy.js` got `fetchToday()` + `fetchXp()` methods (graceful degradation on failure, like the existing `fetchSnapshot`/`fetchMastery`).
  - `services/orchestrator.js` got `fetchAllToday()` (returns per-app blocks + a top-priority pick) and `fetchAllXp()` (returns per-app windows + summed totals + max `lastEarnedAt`).
  - New hooks `hooks/useTodayPriority.js` and `hooks/useXpRollup.js` so any role view can opt into the contract data without touching the existing snapshot path.
  - Math Facts / Reading Facts / Math Academy adapters don't implement `fetchToday`/`fetchXp` yet — they simply don't contribute. Implementing those endpoints in each app is **Part B**.
- **Part B — identity reconciliation, still pending.** Bring Math Facts, Reading Facts, and the orchestration layer's remaining data paths fully onto the unified `user_profiles` model and helpers; retire the `guardians`-only paths. The bridge keeps both apps working until this lands. (Math Facts in particular still uses `create_student_for_guardian` RPC and reads from `students` directly without ever touching `user_profiles`.)
- **Part C — contract endpoints in the other apps.** Implement `/api/today` and `/api/xp` in Math Facts, Reading Facts, and the Math Academy proxy. Once they're live, the launcher's `fetchAllToday`/`fetchAllXp` auto-include them with no code change here.
- **Ships when complete:** one identity model across the whole ecosystem, and the launcher consuming the full orchestration contract from every app. The bridge is removed; nothing is left straddling two models.

Steps 1–4 + 3.5 each deploy on their own. Step 5 is cleanup that's safe to do precisely because the bridge kept everything working through Steps 1–4.

---

*Grounded in: `vpa-orchestration-layer` (`services/auth.js`, `hooks/useAuth.js`, `App.jsx`, `services/config.js`, `services/supabaseClient.js`), `math-facts-trainer-react/supabase/migrations/001–002`, and `reading-academy/supabase/migrations/0004–0008` plus `src/lib/auth/`. No app code was written — this is the plan.*
