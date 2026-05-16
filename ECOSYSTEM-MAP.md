# VPA Learning OS — Ecosystem Map

*One level above `ARCHITECTURE.md`. That doc covers the orchestration repo in depth — this one covers the **whole** ecosystem: every component, where it lives, how the layers fit, what overlaps, and what's missing. The point of this document is that nothing gets built twice.*

*Compiled 2026-05-15 from all six mounted folders. Supersedes the 2026-05-14 draft, which was written with partial access and wrongly listed Reading Academy and a teacher dashboard as "not built."*

---

## The four-layer model

The ecosystem is four layers. Every component lives on one. Students, teachers, and parents only ever touch the **Run** layer.

| Layer | What it is |
|---|---|
| **Learn** | The apps that teach — plus the AI overlay that helps students get unstuck. |
| **Measure** | The pipelines and endpoints that turn learning into data. |
| **Run** | The live dashboards people open every day. |
| **Operate** | The playbook — how a program is run on the ground. |

## The six components

| # | Component | Folder | What it is |
|---|---|---|---|
| 1 | orchestration layer | `~/vpa-orchestration-layer` | The launcher / dashboard SPA — student & parent-facing |
| 2 | Math Facts | `~/math-facts-trainer-react` | Fact-fluency app + the shared serverless backends |
| 3 | Reading Facts | `~/math-facts-trainer-react/reading-facts-app` | Phonics / sight-word drills (nested; deploys separately) |
| 4 | Reading Academy | `~/Desktop/reading-academy` | Adaptive reading curriculum — built, substantial |
| 5 | mathacademy-sync | `~/mathacademy-sync` | The Math Academy scraper/sync pipeline + the MVP teacher dashboard |
| 6 | Learning Assist OS | `~/Desktop/learning-assist-os` | AI "get-unstuck" browser extension — a separate product |

Plus the **Math Academy Pilot** folder (`~/Documents/Claude/Projects/Math Academy Pilot`) — the Elevate Edwards summer program, pilot data, the Operate-layer playbook docs, and some duplicate HTML (see Reconcile). Math Academy itself is a third-party platform — not our code.

---

## What exists, by layer

### Layer 1 — Learn

| Component | What it is | Where | Status |
|---|---|---|---|
| Math Academy | Third-party adaptive math platform | External (partner API) | Live — not our code |
| Math Facts | Fact-fluency drill SPA | `math-facts-trainer-react/` | Built, deployed — `math-facts-trainer.vercel.app` |
| Reading Facts | Atom-level phonics / sight-word / blending drills | `math-facts-trainer-react/reading-facts-app/` | Built, deployed — `reading-facts-app.vercel.app` |
| Reading Academy | Adaptive reading curriculum — knowledge graph, mastery engine, fluency, passwordless student auth, teacher rostering | `~/Desktop/reading-academy` | **Built**, deployed — `reading-academy.vercel.app` |
| Learning Assist OS | AI intervention **overlay** — a browser extension that helps students get unstuck *without giving answers*. Not a curriculum app; it augments the others. | `~/Desktop/learning-assist-os` | Built — browser extension + Vercel API |

### Layer 2 — Measure

| Component | What it is | Where | Status |
|---|---|---|---|
| Serverless API — Math Facts + Math Academy | `/api/snapshot`, `/api/math-facts/mastery`, `/api/math-academy/*` (proxies the MA partner API, holds secrets server-side) | `math-facts-trainer-react/api/` | Built |
| Serverless API — Reading Facts | `/api/snapshot`, `/api/mastery` | `reading-facts-app/api/` | Built |
| Serverless API — Reading Academy | `/api/snapshot`, `/api/mastery`, `/api/today`, `/api/xp` via an `[...slug].js` dispatcher — implements Orchestration Contract v1.0 | `reading-academy/api/` | Built |
| Supabase | Shared database — project `dtkrnyberbpfdmikpdnw` (students, app accounts, mastery, the `learning_apps` registry) | cloud | Built |
| `mathacademy-sync` pipeline | Math Academy scraper → mastery CSV/JSON. Playwright-based, now also API-based; `upload-to-supabase.js` writes results back to Supabase. | `~/mathacademy-sync` | Built — **parallel path, see Reconcile** |

### Layer 3 — Run

| Component | What it is | Where | Status |
|---|---|---|---|
| orchestration layer | The dashboard SPA — rings, skill garden, leaderboard, weekly summary. **Student/parent-facing.** Fans out to all four Learn adapters via `orchestrator.js`. | `~/vpa-orchestration-layer` | Built, deployed — `vpa-orchestration-layer.vercel.app` |
| MVP teacher dashboard | React + Express. Reads the `mathacademy-sync` outputs and generates teacher insights — off-pace, hit-goal, low-accuracy, weakest-domain — 60s auto-refresh. **Teacher-facing, Math-Academy-only.** | `~/mathacademy-sync/dashboard/` | Built — MVP |
| Command Center Dashboard *(HTML)* | Static dashboard, loaded from pilot CSVs | `Math Academy Pilot/` | **Duplicate — see Reconcile** |

### Layer 4 — Operate

| Component | What it is | Where | Status |
|---|---|---|---|
| Operations Hub | 8-section operating playbook for the summer program + 18-day launch roadmap | `Math Academy Pilot/` | Built — draft v0.1 |
| Decision Checklist | 28 open pre-launch decisions | `Math Academy Pilot/` | Built |
| Staff Handouts | Emergency quick-reference, troubleshooting SOP, teacher + guide handbooks | `Math Academy Pilot/` | Built — draft v0.1 |
| Learning OS (Start Here) front door *(HTML)* | Role-based launcher linking the docs above | `Math Academy Pilot/` | **Concept overlaps Run layer — see Reconcile** |

---

## How it connects

The orchestration layer is the launcher. Per `reading-academy/docs/integration/vpa-orchestration-contract-v1.md`, every "vertical" app exposes a versioned 4-endpoint contract — `/api/snapshot`, `/api/mastery`, `/api/today`, `/api/xp` — and the launcher fans out across them via `orchestrator.js`, tolerating any single failure. All apps share one Supabase project for identity and state.

Two things feed mastery data: the **live path** (each app's serverless `/api`, read by the launcher) and the **`mathacademy-sync` path** (scrape → CSV/JSON → also uploaded to Supabase, read by the MVP teacher dashboard). They overlap — see Reconcile.

---

## What's actually missing — and it's mostly *integration*, not components

The earlier draft listed Reading Academy and a teacher view as missing. Both exist. With the full picture, the real gaps are seams, not greenfield:

1. **The orchestration adapter is behind the contract.** Reading Academy implements all four contract endpoints, but the launcher's `orchestrator.js` only fans out `snapshot` + `mastery`. `/api/today` and `/api/xp` (added in Contract v1.0) aren't wired into any adapter yet.
2. **The teacher dashboard is siloed.** It's an MVP: Math-Academy-only, and it reads flat files from `mathacademy-sync` rather than the live multi-app data path. A unified teacher view — all four apps, live — is the real "staff view" target.
3. **`ARCHITECTURE.md` is itself stale.** It still describes Reading Academy as a "stub." It needs a refresh now that Reading Academy is built and contract-compliant.
4. **Smaller, already-tracked items** — in-app account-linking UI, Reading Facts RLS tightening, the Reading Facts audio upgrade, the Math Facts `weekXp` shallow endpoint. Tracked in `ARCHITECTURE.md` and `reading-facts-app/NOTES.md`; not repeated here.

---

## Overlaps & duplication — what to reconcile

1. **Command Center Dashboard (HTML)** now duplicates *two* things — the deployed orchestration layer *and* the existing MVP teacher dashboard. *Recommendation:* retire it.
2. **Learning OS (Start Here) front door (HTML)** overlaps in concept with the orchestration layer and its name collides with the system. *Recommendation:* retire it as a standalone artifact; "front door / role routing" belongs inside the orchestration SPA.
3. **`App.jsx` in the pilot folder** is a fork of `vpa-orchestration-layer/src/App.jsx`. *Recommendation:* the repo is canonical; archive the fork.
4. **Two mastery-data paths** — the live `/api` path and the `mathacademy-sync` scrape, which *also* writes to Supabase. *Recommendation:* make the live path canonical for the product, and scope `mathacademy-sync` to what only it can do — historical pilot snapshots and skill-level knowledge-graph reconstruction — then document that boundary so the two don't silently diverge.
5. **Two dashboards** — orchestration layer (student/parent) and the MVP teacher dashboard (teacher). Not pure duplication — different audiences — but decide deliberately whether the teacher view becomes a route in the orchestration layer or stays a separate app.

---

## Naming — lock it

*Correction from the earlier draft:* "Learning Assist OS" is **not** a synonym for the orchestration layer — it is a separate product, the AI intervention extension. The earlier draft wrongly conflated them.

Recommended canonical terms — and only these:

- **VPA Learning OS** — the whole system (all four layers, all six components).
- **orchestration layer** — specifically the `vpa-orchestration-layer` repo, the Run-layer launcher.
- **Learning Assist OS** — the AI intervention browser extension. A real, distinct product — keep the name.

Use them consistently across repos, docs, and Vercel project names. Retire the standalone "Learning OS" HTML name. Naming drift is the single easiest way to accidentally build the same thing twice — this map exists partly because that already happened.

---

## Where things live — quick reference

| Folder | Path | Contains |
|---|---|---|
| orchestration layer | `~/vpa-orchestration-layer` | The launcher SPA, the four adapters, `orchestrator.js`, `ARCHITECTURE.md`, this map |
| Math Facts + backends | `~/math-facts-trainer-react` | Math Facts SPA, the shared serverless `/api`, Supabase migrations, `reading-facts-app/` nested |
| Reading Academy | `~/Desktop/reading-academy` | The Reading Academy app, its `/api`, the orchestration contract spec, extensive `docs/` |
| mathacademy-sync | `~/mathacademy-sync` | The Math Academy scraper/sync pipeline + the MVP teacher dashboard in `dashboard/` |
| Learning Assist OS | `~/Desktop/learning-assist-os` | The AI intervention browser extension + its Vercel API |
| Math Academy Pilot | `~/Documents/Claude/Projects/Math Academy Pilot` | Elevate Edwards summer program, pilot data, the Operate-layer playbook docs, duplicate HTML |

---

## Suggested order of operations

Not a build plan — just the dependency logic:

1. **Lock the naming.** Costs nothing; prevents the next duplication.
2. **Reconcile the duplicates.** Retire the two HTML files and the forked `App.jsx`; decide and document the scraper-vs-live-API boundary.
3. **Close the integration seams.** Wire `/api/today` + `/api/xp` into the launcher; refresh `ARCHITECTURE.md`.
4. **Then the one real product gap** — a unified, live, multi-app teacher view, evolving the MVP teacher dashboard (into, or alongside, the orchestration layer).

---

*This is the top-level index. `ARCHITECTURE.md` is the orchestration-system detail beneath it. Keep both current as the ecosystem changes.*
