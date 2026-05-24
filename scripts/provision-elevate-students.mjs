#!/usr/bin/env node
// =====================================================================
// provision-elevate-students.mjs
//
// One-run provisioning of the Elevate Edwards Summer 2026 roster into the
// VPA orchestration layer.
//
// What it does:
//   1. Signs in to Supabase as an admin (you).
//   2. Ensures your user_profiles row exists (calls /api/provision-self)
//      and reports your role.
//   3. Creates two classes -- "Elevate Edwards - Spark (K-3)" and
//      "Elevate Edwards - Ascent (4-6)" -- unless you pass existing
//      class IDs via env (SPARK_CLASS_ID / ASCENT_CLASS_ID).
//   4. Bulk-provisions all 45 distinct students into their class via
//      reading-academy's /api/bulk-provision-students endpoint.
//   5. Writes every invite link (or per-row error) to a CSV + JSON
//      next to this script.
//
// Student login afterwards is PASSWORDLESS: class code -> tap your name
// + avatar -> 4-digit PIN. The invite link is the one-time claim step;
// there is no per-student text password for this platform.
//
// USAGE (run from the repo root so node_modules resolves):
//   cd ~/vpa-orchestration-layer
//   node scripts/provision-elevate-students.mjs --dry-run      # preview, no network
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret \
//     node scripts/provision-elevate-students.mjs              # live run
//   node scripts/provision-elevate-students.mjs                # live, prompts for login
//
// FLAGS / ENV:
//   --dry-run            Print the plan + write a preview CSV. No network, no writes.
//   --yes                Skip the "type yes to continue" confirmation.
//   --no-grades          Don't send per-student gradeLevel (use only if the
//                        provisioning endpoint rejects grades 3-5).
//   ADMIN_EMAIL / ADMIN_PASSWORD       Admin login (else prompted interactively).
//   SPARK_CLASS_ID / ASCENT_CLASS_ID   Use existing classes; skip create-class.
//   INVITE_EXPIRES_HOURS               Override invite link lifetime.
// =====================================================================

import readline from "node:readline";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- configuration (matches src/services/supabaseClient.js + config.js) ----
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://dtkrnyberbpfdmikpdnw.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0a3JueWJlcmJwZmRtaWtwZG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MDE0MzIsImV4cCI6MjA5MzM3NzQzMn0.oElhVtcEbq8nDBBFzpsTdfDcSGO1b6TLBclKFxBAUC8";
const READING_ACADEMY_BASE =
  process.env.VITE_RA_BASE_URL || "https://reading-academy.vercel.app";
const PROVISION_SELF_URL =
  process.env.VITE_PROVISION_SELF_URL ||
  `${READING_ACADEMY_BASE}/api/provision-self`;

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_CONFIRM = process.argv.includes("--yes");
const SEND_GRADES = !process.argv.includes("--no-grades");
const INVITE_EXPIRES_HOURS = process.env.INVITE_EXPIRES_HOURS
  ? Number(process.env.INVITE_EXPIRES_HOURS)
  : null;

// ---------------------------------------------------------------------
// The roster: 45 distinct Elevate Edwards Summer 2026 students.
// Grouped per Samuel's decision -- Spark = K-3, Ascent = 4-6.
// Names are case-normalized; the Macyn / Quinn LaFaver duplicate
// registrations have already been collapsed to one entry each.
// ---------------------------------------------------------------------
const SPARK = [
  { name: "Charles Cryer", grade: "K" },
  { name: "Pedro Sanchez Diaz", grade: "1" },
  { name: "Fletcher Hood", grade: "1" },
  { name: "Martin Rincon", grade: "1" },
  { name: "Ford Smith", grade: "1" },
  { name: "Nicolas Arana", grade: "2" },
  { name: "Victor Manuel Ramírez Arzola", grade: "2" },
  { name: "Savanna Furlong", grade: "2" },
  { name: "Aitana Garcia", grade: "2" },
  { name: "Daralyn Loera", grade: "2" },
  { name: "Hisui Miyamoto", grade: "2" },
  { name: "Ryann Scott", grade: "2" },
  { name: "Stanley Aguilar", grade: "3" },
  { name: "Cordelia Cryer", grade: "3" },
  { name: "Edward Álvarez Garcia", grade: "3" },
  { name: "Macyn LaFaver", grade: "3" },
  { name: "Quinn LaFaver", grade: "3" },
  { name: "LilyAnn McKenzie", grade: "3" },
  { name: "Violet Thomson", grade: "3" },
  { name: "London Weingast", grade: "3" },
];

const ASCENT = [
  { name: "Citlali Yazmin Garcia Carrillo", grade: "4" },
  { name: "Dereck Loera", grade: "4" },
  { name: "Gael Nunez", grade: "4" },
  { name: "Mía Ramos", grade: "4" },
  { name: "Zoe Ramos", grade: "4" },
  { name: "Sadie Tanis", grade: "4" },
  { name: "Miguel Angel Perez Varela", grade: "4" },
  { name: "Elliott Baugh", grade: "5" },
  { name: "Yazmin Calzadillas", grade: "5" },
  { name: "Luna Abdali Herrera Centeno", grade: "5" },
  { name: "Kylie Chaparro", grade: "5" },
  { name: "Rosner Esteban", grade: "5" },
  { name: "Woods Furlong", grade: "5" },
  { name: "Logan Gonzalez", grade: "5" },
  { name: "Kevin Herrera", grade: "5" },
  { name: "Luke LaFaver", grade: "5" },
  { name: "Emmett McDaniel", grade: "5" },
  { name: "Utaha Miyamoto", grade: "5" },
  { name: "Benjamin Pantoja", grade: "5" },
  { name: "Logan Parisb", grade: "5" },
  { name: "Cormac Smith", grade: "5" },
  { name: "William Tanis", grade: "5" },
  { name: "Riley Thomson", grade: "5" },
  { name: "Barrett Zenor", grade: "5" },
  { name: "Bode Zenor", grade: "5" },
];

// Students whose registration row has an open review flag. They are
// still provisioned by default -- this is surfaced so you can decide
// whether to hold them. To exclude one, delete its line above.
const FLAGGED = {
  "Fletcher Hood": "DOB is a future date - data-entry error; verify with family",
  "Utaha Miyamoto": "Liability waiver + emergency medical auth NOT signed",
  "William Tanis": "Parent note mentions 6th grade - verify K-5 eligibility",
  "Barrett Zenor": "Age check - would be 12 on Jun 1 2026; verify grade",
  "Bode Zenor": "Parent note mentions 6th grade - verify K-5 eligibility",
};

const CLASSES = [
  { key: "spark", name: "Elevate Edwards - Spark (K-3)", students: SPARK, envId: process.env.SPARK_CLASS_ID },
  { key: "ascent", name: "Elevate Edwards - Ascent (4-6)", students: ASCENT, envId: process.env.ASCENT_CLASS_ID },
];

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------
function log(...a) { console.log(...a); }
function rule() { log("-".repeat(70)); }

function askVisible(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

function askHidden(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(q);
    rl._writeToOutput = () => {}; // suppress echo of typed characters
    rl.question("", (ans) => { rl.close(); process.stdout.write("\n"); resolve(ans.trim()); });
  });
}

// POST with a Supabase JWT. 207 (partial success) is treated as resolved
// so the caller can inspect per-row results -- mirrors src/services/registration.js.
async function authedPost(url, token, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body || {}),
  });
  let payload = null;
  try { payload = await res.json(); } catch { /* no JSON body */ }
  if (!res.ok && res.status !== 207) {
    const msg = (payload && (payload.error || payload.details)) || `request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return { status: res.status, payload };
}

function pick(obj, ...keys) {
  for (const k of keys) {
    const v = k.split(".").reduce((o, kk) => (o == null ? o : o[kk]), obj);
    if (v != null && v !== "") return v;
  }
  return null;
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(path, headers, rows) {
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
}

// ---------------------------------------------------------------------
// main
// ---------------------------------------------------------------------
async function main() {
  const total = SPARK.length + ASCENT.length;
  const flaggedNames = Object.keys(FLAGGED);

  log("");
  log("=".repeat(70));
  log("  ELEVATE EDWARDS - SUMMER 2026  |  Orchestration layer provisioning");
  log("=".repeat(70));
  log(`  Supabase project : ${SUPABASE_URL}`);
  log(`  Provisioning API : ${READING_ACADEMY_BASE}`);
  log(`  Mode             : ${DRY_RUN ? "DRY RUN (no network, no writes)" : "LIVE"}`);
  log(`  Per-student grade: ${SEND_GRADES ? "included" : "omitted (--no-grades)"}`);
  log("");
  for (const c of CLASSES) {
    log(`  ${c.name}`);
    log(`     ${c.students.length} students` + (c.envId ? `  (existing class ${c.envId})` : "  (class will be created)"));
  }
  log(`  TOTAL: ${total} distinct students  (LaFaver twins de-duplicated)`);
  log("");
  log(`  Review flags (${flaggedNames.length}) - provisioned anyway, decide later:`);
  for (const n of flaggedNames) log(`     - ${n}: ${FLAGGED[n]}`);
  rule();

  // ---- dry run: write a preview and stop -------------------------------
  if (DRY_RUN) {
    const previewPath = join(__dirname, "elevate-provision-preview.csv");
    const rows = [];
    for (const c of CLASSES)
      for (const s of c.students)
        rows.push([c.name, s.name, s.grade, FLAGGED[s.name] ? "REVIEW" : "", FLAGGED[s.name] || ""]);
    writeCsv(previewPath, ["Class", "Student", "Grade", "Status", "Review Flag"], rows);
    log(`  Dry run complete. Preview of all ${total} students written to:`);
    log(`     ${previewPath}`);
    log("  Re-run without --dry-run to create the accounts for real.");
    log("");
    return;
  }

  // ---- credentials -----------------------------------------------------
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;
  if (!email) email = await askVisible("  Admin email: ");
  if (!password) password = await askHidden("  Admin password (hidden): ");
  if (!email || !password) {
    log("  ! Email and password are required. Aborting.");
    process.exitCode = 1;
    return;
  }

  // ---- sign in ---------------------------------------------------------
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  log("");
  log(`  Signing in as ${email} ...`);
  const { data: signInData, error: signInErr } =
    await supabase.auth.signInWithPassword({ email, password });
  if (signInErr || !signInData?.session) {
    log(`  ! Sign-in failed: ${signInErr?.message || "no session returned"}`);
    process.exitCode = 1;
    return;
  }
  const token = signInData.session.access_token;
  const authUserId = signInData.user.id;
  log(`  Signed in. auth user id: ${authUserId}`);

  // ---- ensure user_profiles row + check role --------------------------
  let role = "unknown";
  try {
    const { payload } = await authedPost(PROVISION_SELF_URL, token, {});
    role = pick(payload, "role", "profile.role", "data.role") || "unknown";
    log(`  user_profiles role: ${role}`);
  } catch (e) {
    log(`  ! Could not confirm role via provision-self (${e.message}). Continuing.`);
  }
  if (role !== "admin") {
    log("");
    log(`  !! Your role is "${role}", not "admin".`);
    log("     create-class is admin-only. If class creation fails below,");
    log("     set your role to admin in Supabase, or pass SPARK_CLASS_ID /");
    log("     ASCENT_CLASS_ID for classes that already exist, then re-run.");
    log("");
  }

  // ---- confirm ---------------------------------------------------------
  if (!SKIP_CONFIRM) {
    const ans = await askVisible(
      `  About to create up to ${total} students in ${SUPABASE_URL}. Type "yes" to continue: `
    );
    if (ans.toLowerCase() !== "yes") {
      log("  Cancelled. Nothing was created.");
      return;
    }
  }

  // ---- ensure classes --------------------------------------------------
  const classInfo = {};
  for (const c of CLASSES) {
    if (c.envId) {
      classInfo[c.key] = { id: c.envId, code: null, reused: true };
      log(`  ${c.name}: using existing class ${c.envId}`);
      continue;
    }
    try {
      const { payload } = await authedPost(`${READING_ACADEMY_BASE}/api/create-class`, token, {
        name: c.name,
        teacherUserId: authUserId,
      });
      const id = pick(payload, "class.id", "classId", "id", "data.id", "data.class.id");
      const code = pick(payload, "class.class_code", "class.classCode", "class_code", "classCode", "code", "data.class_code");
      if (!id) throw new Error("no class id in response: " + JSON.stringify(payload));
      classInfo[c.key] = { id, code, reused: false };
      log(`  ${c.name}: created  (id ${id}${code ? `, class code ${code}` : ""})`);
    } catch (e) {
      log("");
      log(`  ! create-class failed for "${c.name}": ${e.message}`);
      log("    The create-class endpoint may not be deployed yet. Either deploy");
      log("    reading-academy, or create the two classes another way, then re-run:");
      log("      SPARK_CLASS_ID=<id> ASCENT_CLASS_ID=<id> \\");
      log("        node scripts/provision-elevate-students.mjs --yes");
      process.exitCode = 1;
      return;
    }
  }

  // ---- bulk-provision students ----------------------------------------
  const allRows = [];
  let created = 0, enrolled = 0, failed = 0;
  for (const c of CLASSES) {
    const info = classInfo[c.key];
    log("");
    log(`  Provisioning ${c.students.length} students into ${c.name} ...`);
    const body = {
      classId: info.id,
      students: c.students.map((s) =>
        SEND_GRADES ? { displayName: s.name, gradeLevel: s.grade } : { displayName: s.name }
      ),
    };
    if (INVITE_EXPIRES_HOURS) body.expiresInHours = INVITE_EXPIRES_HOURS;

    let payload;
    try {
      ({ payload } = await authedPost(`${READING_ACADEMY_BASE}/api/bulk-provision-students`, token, body));
    } catch (e) {
      log(`  ! bulk-provision failed for ${c.name}: ${e.message}`);
      for (const s of c.students) {
        failed++;
        allRows.push([c.name, info.id, s.name, s.grade, "ERROR", e.message, FLAGGED[s.name] || ""]);
      }
      continue;
    }

    const sum = payload?.summary || {};
    created += sum.created ?? 0;
    enrolled += sum.enrolled ?? 0;
    failed += sum.failed ?? 0;

    const results = Array.isArray(payload?.results) ? payload.results : [];
    const byName = new Map(results.map((r) => [String(r.displayName), r]));
    for (const s of c.students) {
      const r = byName.get(s.name);
      if (r && r.ok) {
        allRows.push([c.name, info.id, s.name, s.grade, "OK", r.inviteUrl || "", FLAGGED[s.name] || ""]);
      } else {
        allRows.push([c.name, info.id, s.name, s.grade, "FAILED", (r && r.error) || "no result returned", FLAGGED[s.name] || ""]);
      }
    }
    log(`     created ${sum.created ?? 0}, enrolled ${sum.enrolled ?? 0}` + (sum.failed ? `, ${sum.failed} failed` : ""));
  }

  // ---- write output ----------------------------------------------------
  const stamp = new Date().toISOString().slice(0, 10);
  const csvPath = join(__dirname, `elevate-invites-${stamp}.csv`);
  const jsonPath = join(__dirname, `elevate-invites-${stamp}.json`);
  writeCsv(
    csvPath,
    ["Class", "Class ID", "Student", "Grade", "Status", "Invite URL / Error", "Review Flag"],
    allRows
  );
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        classes: classInfo,
        summary: { created, enrolled, failed, total },
        students: allRows.map((r) => ({
          class: r[0], classId: r[1], student: r[2], grade: r[3],
          status: r[4], inviteUrlOrError: r[5], reviewFlag: r[6],
        })),
      },
      null,
      2
    ),
    "utf8"
  );

  // ---- summary ---------------------------------------------------------
  log("");
  rule();
  log(`  DONE.  created ${created} | enrolled ${enrolled} | failed ${failed}`);
  for (const c of CLASSES) {
    const info = classInfo[c.key];
    log(`  ${c.name}`);
    log(`     class id   : ${info.id}`);
    log(`     class code : ${info.code || "(check the Admin roster screen)"}`);
  }
  log("");
  log("  Invite links written to:");
  log(`     ${csvPath}`);
  log(`     ${jsonPath}`);
  log("");
  log("  Next: send each student/parent their one-time invite link to claim");
  log("  the account. Day-to-day login is the class code + name tap + 4-digit PIN.");
  if (failed > 0) {
    log("");
    log("  Some rows failed. If EVERY row failed on a grade error, re-run with");
    log("  --no-grades. Otherwise see the Status / error column in the CSV.");
  }
  rule();
  log("");
}

main().catch((e) => {
  console.error("\n  ! Unexpected error:", e?.stack || e?.message || e);
  process.exitCode = 1;
});
