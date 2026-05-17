# Deploy guide — Steps 1–5 (incl. Step 3.5 + cosmetic fixes)

Two repos need to ship: `reading-academy` (the API host for `/api/create-class`,
the patched `bulk-provision-students`, and the contract endpoints) and
`vpa-orchestration-layer` (the launcher). Order matters — deploy reading-academy
**first** because the orchestration layer calls into it.

All commands assume you're on your Mac in a regular Terminal.

---

## 1. Deploy reading-academy

What's shipping:

- `api/_handlers/create-class.js` (new admin-only endpoint)
- `api/[...slug].js` (registers the new route)
- `api/_handlers/bulk-provision-students.js` (admin-in-org may enroll into any class)

```bash
cd ~/Desktop/reading-academy
npx vercel --prod
```

Confirm it stuck:

```bash
# Should return 405 (POST only) — proves the route is registered.
curl -i https://reading-academy.vercel.app/api/create-class
```

A `200` or `405` means the route exists; `404` means the deploy didn't pick it
up — check `api/[...slug].js`'s ROUTES map locally for `"create-class"`.

If you're using a different production hostname, swap it above. (Don't forget to
clear `git/index.lock` if you ever go to commit reading-academy work later:
`rm -f .git/index.lock`.)

---

## 2. Deploy the orchestration layer

What's shipping:

- `src/components/RegistrationPanel.jsx` (new)
- `src/services/registration.js` (new)
- `src/hooks/useTodayPriority.js` (new — contract /api/today)
- `src/hooks/useXpRollup.js` (new — contract /api/xp)
- `src/services/readingAcademy.js` (adds `fetchToday()` + `fetchXp()`)
- `src/services/orchestrator.js` (adds `fetchAllToday()` + `fetchAllXp()`)
- `src/components/AdminView.jsx` (renders RegistrationPanel; Staff count fix;
  unique-students count fix)
- `src/styles/global.css` (adds `.reg-*` styles)
- `UNIFIED-EXPERIENCE-BLUEPRINT.md` (marks 3.5 + Step 5 Part A)
- `ACCEPTANCE-TESTS.md` (new)
- `.gitignore` (ignores `dist-*` and vite timestamp files)

### 2a. Commit + push

```bash
cd ~/vpa-orchestration-layer
rm -f .git/index.lock                # in case a prior session left one
git add -A
git commit -m "Step 3.5 (Registration UI), Step 5 Part A (contract today+xp), AdminView cosmetic fixes, acceptance tests doc"
git push origin main
```

If Vercel's GitHub integration is wired to this repo, the push alone triggers
the production deploy. If not:

```bash
npx vercel --prod
```

### 2b. Smoke-test the live deploy

Open the production URL (likely `https://vpa-orchestration-layer.vercel.app`)
in a Chrome incognito window and:

1. Sign in as an admin account.
2. Confirm the "Manage" section appears at the bottom of the admin view with
   the Create class + Add students forms.
3. Create a class named `DEPLOY-SMOKE-TEST`; verify it appears in the Classes
   list after the page refreshes.
4. Open devtools → Network and confirm a POST to
   `reading-academy.vercel.app/api/create-class` returned 200.
5. Archive the test class via SQL:
   `update public.teacher_classes set archived = true where name = 'DEPLOY-SMOKE-TEST';`

---

## 3. Run the acceptance suite

Follow `ACCEPTANCE-TESTS.md` end to end against the live deploy. That's the
gating check before declaring Steps 1–4 + 3.5 + 5A truly shipped.

---

## 4. Common gotchas (carry-over from prior deploys)

- **`zsh: command not found: vercel`** — use `npx vercel --prod`, not the
  globally-installed binary.
- **`.git/index.lock: File exists`** — `rm -f .git/index.lock` and retry. This
  comes from prior interrupted git operations.
- **Build failure: `Cannot find module '@rollup/rollup-linux-arm64-gnu'`** —
  `npm install @rollup/rollup-linux-arm64-gnu --no-save`.
- **`EPERM: operation not permitted, unlink dist/...`** — `npx vite build
  --outDir dist-fresh` to dodge a sandbox-locked dist directory.
- **Vercel zsh prompt `Ok to proceed?`** — answer `y`.
- **`git commit -m "..."` opens a `quote>` prompt** — zsh is converting your
  straight quotes to smart quotes. Use single quotes or wrap the message in
  `$'...'`.
