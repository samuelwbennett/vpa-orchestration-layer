# VPA Learning OS — fresh-account acceptance tests

A 15-minute end-to-end pass that verifies all four role views render correctly
against a clean, isolated test account per role. Run before any deploy that
touches `useAuth`, `provision-self`, or role routing.

The pattern: never test on an account that's accumulated state from prior
debugging. Create a fresh auth user, seed it with exactly one role, sign in via
Chrome incognito, verify the rendered view.

---

## 0. Prerequisites

- `reading-academy` deployed with the latest `provision-self.js` (upgrade-only
  + self-heal only for student-default). Otherwise the parent test will fail
  the way it did on 2026-05-16.
- The Supabase project (`dtkrnyberbpfdmikpdnw`) is reachable.
- The orchestration layer is running locally (`npm run dev` in
  `~/vpa-orchestration-layer/`, default `http://localhost:5173`) **or** the
  deployed URL is current.

---

## 1. Create the four test auth users

In the Supabase dashboard → **Authentication → Users → Add user → Create new user**,
create four users with throwaway passwords (or magic-link only). Use Gmail
plus-addressing so the emails route to the same inbox:

| Role    | Suggested email                                |
| ------- | ---------------------------------------------- |
| student | `samuel.bennett425+student.test@gmail.com`     |
| teacher | `samuel.bennett425+teacher.test@gmail.com`     |
| admin   | `samuel.bennett425+admin.test@gmail.com`       |
| parent  | `samuel.bennett425+parent.test@gmail.com`      |

**Sign in once with each account** (Chrome incognito, one window per role) to
let the on-first-sign-in trigger create the `auth.users` row. Then sign out.
This is required before any of the seed SQL below will find the user.

---

## 2. Run the role seeds

Open the Supabase SQL editor and run each block once. Each block is idempotent
and includes its own sanity-check select at the bottom.

### 2a. Student

A fresh sign-in already produces a `user_profiles` row with `role='student'`
via `/api/provision-self`, so no seed is needed. Just confirm:

```sql
select u.email, up.role
  from auth.users u
  left join public.user_profiles up on up.auth_user_id = u.id
 where u.email = 'samuel.bennett425+student.test@gmail.com';
-- expect: role = 'student'
```

If `role` is null, the orchestration layer hasn't called provision-self for
this user yet — sign in via the app once, then re-check.

### 2b. Teacher

Edit `supabase/dev-seed-teacher.sql` line 21 to
`v_email := 'samuel.bennett425+teacher.test@gmail.com';` then run the whole
file in the SQL editor. Expect the sanity-check select at the bottom to show
`your_role = teacher`, `your_classes = 1`, `students_in_your_roster = 5`.

### 2c. Admin

Edit `supabase/dev-seed-admin.sql` similarly and run. Expect
`your_role = admin`.

### 2d. Parent

Edit `supabase/dev-seed-parent.sql` line 23 to
`v_email := 'samuel.bennett425+parent.test@gmail.com';` then run. Expect the
sanity-check select to show `role = parent`, `children_linked = 2`.

---

## 3. Verify each role in the browser

For each test account, open a **separate Chrome incognito window** (so cookies
and Supabase session don't bleed between accounts). Sign in via the orchestration
layer's login screen, then check the criteria below.

### 3a. Student — pass criteria

- Header reads "Good morning/afternoon/evening, [name]".
- The single-student dashboard renders (Today Plan, Daily Rings, Earnings,
  Pomodoro, etc.). Per-app cards appear for Math Academy / Math Facts /
  Reading Facts / Reading Academy.
- **Fail signals:** "VPA Account isn't linked yet" card; teacher view appears;
  blank screen.

### 3b. Teacher — pass criteria

- Header reads "Teacher Dashboard" eyebrow.
- "Class roster" section shows the 5 seeded students.
- Clicking a student expands the per-app drill-down.
- The "who needs attention today" queue renders (might be empty — that's fine).
- **Fail signals:** "No classes assigned yet" empty state (means the seed
  didn't create the teacher_classes row, or RLS is blocking); admin view
  appears.

### 3c. Admin — pass criteria

- Header reads "Admin Dashboard".
- "Program at a glance" shows non-zero stats for Students / Classes / Teachers.
- "Staff (N)" section shows all teachers + admins in the org.
- "All students (N)" — N is the unique student count (not class-row count).
- "Manage" section at the bottom shows two forms: **Create class** and
  **Add students to a class**. Both have populated dropdowns.
- **Smoke test:** create a class named "ACCEPTANCE-TEST-CLASS"; verify it
  appears in the Classes list after the page refreshes. Then add one student
  via the bulk form; verify the invite URL is returned and clickable.
  Clean up by archiving via SQL:
  `update public.teacher_classes set archived = true where name = 'ACCEPTANCE-TEST-CLASS';`
- **Fail signals:** Manage section shows "No teachers in your organization yet"
  (means the user_profiles query is mis-scoped); 403 on create-class POST
  (means the create-class endpoint isn't deployed, see deploy doc).

### 3d. Parent — pass criteria

- Header reads "Parent Dashboard".
- One card per child (expect 2 children from the seed).
- Each card shows an on-track pill in warmer tone ("On Track" / "Building up" /
  "Just getting started"), today's pace, and today's wins.
- Expanding a card shows per-app drill-down.
- **Fail signals:** teacher or admin view appears instead (means
  provision-self self-heal patch isn't deployed on reading-academy, or the
  parent account also owns a teacher_classes row).

---

## 4. Cross-role boundary checks

Quick sanity checks that RLS is enforcing isolation:

- **Teacher account cannot see admin-only data.** Open browser devtools
  Network tab while teacher view loads; confirm no calls return rows for
  classes owned by a different teacher.
- **Parent account cannot see other parents' children.** In the parent
  account's SQL session (run as that user via `select set_config('request.jwt.claim.sub', '<auth-user-id>', true);` won't actually scope — easiest is to verify via the UI: the parent only sees the 2 children seeded above, no others).

---

## 5. Teardown

```sql
-- One-shot teardown of all four test users + their seeded data.
do $$
declare
  emails text[] := array[
    'samuel.bennett425+student.test@gmail.com',
    'samuel.bennett425+teacher.test@gmail.com',
    'samuel.bennett425+admin.test@gmail.com',
    'samuel.bennett425+parent.test@gmail.com'
  ];
  uids uuid[];
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);

  select array_agg(id) into uids from auth.users where email = any(emails);
  if uids is null then return; end if;

  delete from public.guardian_students where guardian_id = any(uids);
  delete from public.class_memberships
   where class_id in (select id from public.teacher_classes
                       where teacher_user_id = any(uids));
  delete from public.teacher_classes where teacher_user_id = any(uids);
  delete from public.teachers where auth_user_id = any(uids);
  delete from public.user_profiles where auth_user_id = any(uids);
  delete from public.guardians where id = any(uids);
  -- Deleting from auth.users requires the Supabase dashboard
  -- (cascades trigger). Do it manually for each.
end $$;
```

After running the cleanup SQL, delete the four test users from
**Authentication → Users** in the Supabase dashboard.

---

## 6. What to report after a run

Paste the four sanity-check select outputs from §2 + a pass/fail flag per role
from §3 — that's the whole acceptance result.
