# VPA Learning OS — Architecture

A unified dashboard for a multi-app learning environment for K-5 students.
This document captures what's deployed where, how data flows, and how to
rebuild the system if everything goes sideways.

Last updated at the **v0.1.0-mvp** release tag.

## Repos

Three GitHub repos, three Vercel projects, one Supabase project.

| Repo | Role | Deployed at |
|------|------|-------------|
| `samuelwbennett/vpa-orchestration-layer` | Dashboard SPA — the page parents/students see | `vpa-orchestration-layer.vercel.app` |
| `samuelwbennett/math-facts-trainer` | Math Facts SPA + serverless backends for Math Facts, Math Academy, and Reading Facts | `math-facts-trainer.vercel.app` |
| (nested in math-facts-trainer) `reading-facts-app/` | Reading Facts SPA + its own snapshot/mastery endpoints | `reading-facts-app.vercel.app` |

The nesting is historical — `reading-facts-app/` lives as a folder inside
`math-facts-trainer-react` but Vercel deploys it as a separate project
(see its `.vercel/project.json`).

## High-level data flow

```
                 [Browser: vpa-orchestration-layer.vercel.app]
                                |
            ┌───────────────────┼────────────────────┐
            ↓                   ↓                    ↓
[math-facts-trainer.vercel.app] (Math Facts)    [reading-facts-app.vercel.app]
       /api/snapshot                                /api/snapshot
       /api/math-facts/mastery                      /api/mastery
       /api/math-academy/snapshot                  ↓
       /api/math-academy/mastery               [Supabase] (reading_mastery, reading_sessions)
            |
   ┌────────┴────────┐
   ↓                 ↓
[Supabase]   [mathacademy.com /api/beta5]
(student_app_accounts,
 daily_progress,
 students,
 learning_apps)
```

The dashboard never talks to Math Academy or Supabase directly — every
request goes through one of our serverless proxies, which hold the
secrets server-side.

## Adapters and contracts

Each app on the dashboard is an "adapter" in
`vpa-orchestration-layer/src/services/`. Every adapter exposes:

- `fetchSnapshot({ signal })` → today's XP, weekly XP, daily goal, next-lesson hint, status
- `fetchMastery({ signal })` → strand-level cumulative mastery counts (for the Skill Garden)

The contracts are documented in the comment block at the top of each file.

| App | Snapshot | Mastery |
|-----|----------|---------|
| Math Facts | `math-facts-trainer.vercel.app/api/snapshot` | `/api/math-facts/mastery` |
| Math Academy | `/api/math-academy/snapshot` (proxies MA partner API) | `/api/math-academy/mastery` |
| Reading Facts | `reading-facts-app.vercel.app/api/snapshot` | `/api/mastery` |
| Reading Academy | stub (coming-soon) | stub |

`orchestrator.js` fans out to all four in parallel and tolerates
individual adapter failures (`Promise.allSettled`).

## Vercel env vars

Each Vercel project needs its own env vars. Lost vars = broken deploy
(though the app stays live serving the previous build).

### `math-facts-trainer-react`

| Variable | What | Where to find |
|---|---|---|
| `SUPABASE_URL` | `https://dtkrnyberbpfdmikpdnw.supabase.co` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (bypasses RLS) | Supabase dashboard → Project Settings → API → service_role |
| `MA_PUBLIC_API_KEY` | Math Academy public partner key (34-char base-36) | Math Academy partner dashboard |
| `MA_SECRET_KEY` | Math Academy secret key — only needed if we add HMAC writes (postStudent) | same place |

### `reading-facts-app`

| Variable | What |
|---|---|
| `SUPABASE_URL` | same Supabase project as above |
| `SUPABASE_SERVICE_ROLE_KEY` | same service-role key |

### `vpa-orchestration-layer`

| Variable | What |
|---|---|
| `VITE_STUDENT_ID` | Default student UUID for the demo deploy (currently `1240ae1d-c10f-44ed-96ef-5ee372f371a6`) |
| `VITE_MA_API_BASE_URL`, `VITE_MA_SNAPSHOT_PATH`, `VITE_MA_DEEP_LINK`, `VITE_MA_STUDENT_ID` | Optional overrides — defaults are baked into `src/services/config.js` and work in production |
| `VITE_MF_BASE_URL`, `VITE_MF_SNAPSHOT_PATH`, `VITE_MF_STUDENT_ID` | Same |
| `VITE_RF_BASE_URL`, `VITE_RF_SNAPSHOT_PATH`, `VITE_RF_STUDENT_ID` | Same |

**Backup the MA keys somewhere outside Vercel** — Vercel doesn't surface
them once saved, so if the project gets deleted by accident, you'd need
the Math Academy admin to re-issue.

## Supabase

One project: `dtkrnyberbpfdmikpdnw`. Schema lives at
`math-facts-trainer-react/supabase/migrations/001_initial_schema.sql`.
Reading-app schemas live in `reading-facts-app/data/*.sql` and are run
by hand in the SQL editor (a small operational debt — should fold them
into the migrations folder one day).

### Tables in use

| Table | Used by | Notes |
|---|---|---|
| `learning_apps` | all | Registry. Pre-seeded with `math_facts`, `math_academy`, `reading` rows. |
| `students` | all | One row per VPA student. UUID primary key. |
| `guardians`, `guardian_students` | auth (read by the apps) | Maps Supabase auth users → students they can see. |
| `student_app_accounts` | math-facts, math-academy mastery | Per (student, app) row holding `external_id` (e.g. MA student id) and per-app `state` JSONB. |
| `practice_sessions` | math-facts | One row per quiz session. |
| `daily_progress` | math-facts snapshot | Denormalized rollup `{day, total_xp, per_app}`. |
| `reading_sessions` | reading-facts snapshot | Per-quiz log for reading. |
| `reading_mastery` | reading-facts mastery | Per-(student, atom_id) mastery score. |

**RLS posture:** orchestration tables (`student_app_accounts`,
`practice_sessions`, `daily_progress`, etc.) have proper guardian-of-student
RLS policies. The reading tables (`reading_mastery`, `reading_sessions`)
have permissive dev-mode RLS — tighten before real users.

## Recreate from scratch (rough runbook)

If everything except GitHub disappears, this is roughly what you do:

1. **Supabase:** create a new project. Run
   `math-facts-trainer-react/supabase/migrations/001_initial_schema.sql`
   in the SQL editor, then the two `reading-facts-app/data/*.sql` files.
   Update the Supabase URL/keys you'll use in step 4.
2. **Math Academy:** ask the partner team to issue a new public + secret
   key. Note the keys.
3. **Vercel — math-facts-trainer-react:** import the GitHub repo as a
   project. Set the four env vars from the table above. Deploy.
4. **Vercel — reading-facts-app:** import the same GitHub repo, but
   configure root directory = `reading-facts-app`. Set the two
   Supabase env vars. Deploy.
5. **Vercel — vpa-orchestration-layer:** import the GitHub repo. Set
   `VITE_STUDENT_ID` to a real student UUID from `students`. Deploy.
6. **Re-link students** by inserting `student_app_accounts` rows for
   each linked Math Academy student. The SQL is in this doc's history /
   in the conversation log.

## Current state (v0.1.0-mvp)

**Working end-to-end:**

- Today's-goal rings (Apple-style palette, XP-centered display, hover tooltips)
- Math Facts snapshot live (real today/week XP, daily goal 5)
- Reading Facts snapshot live (real today/week XP, daily goal 5)
- Math Academy snapshot live (real today/week XP via partner API; daily goal pinned to VPA's 30, deep-links to `/students/<id>/activity`)
- Skill Garden showing per-strand mastery for Math Facts (4 ops),
  Math Academy (course %), Reading Facts (6 strands), Reading
  Academy (locked tile)
- League badge on the Math Academy card

**Known gaps / next-up:**

- No in-app UI for adding `student_app_accounts` rows — currently SQL only.
  A settings page that calls a new `/api/math-academy/link` endpoint is
  the natural next feature.
- Reading Academy doesn't exist yet — every adapter renders it as
  coming-soon.
- Reading-facts dev-mode RLS policies need tightening before real users.
- Math-facts snapshot returns `weekXp = todayXp` (a known shallow
  endpoint). Real 7-day rolling sum is in reading-facts; symmetrical
  fix on math-facts is a small change.
- Supabase free tier pauses idle projects after 7 days — a single curl
  every few days keeps it warm; Pro tier ($25/mo) removes the pause.

## Useful commands

```bash
# Smoke-test each snapshot endpoint
curl 'https://math-facts-trainer.vercel.app/api/snapshot?student=<uuid>'
curl 'https://math-facts-trainer.vercel.app/api/math-academy/snapshot?student=<uuid>'
curl 'https://reading-facts-app.vercel.app/api/snapshot?student=<uuid>'

# Smoke-test mastery
curl 'https://math-facts-trainer.vercel.app/api/math-facts/mastery?student=<uuid>'
curl 'https://math-facts-trainer.vercel.app/api/math-academy/mastery?student=<uuid>'
curl 'https://reading-facts-app.vercel.app/api/mastery?student=<uuid>'

# Roll back to this stable state
git checkout v0.1.0-mvp
```
