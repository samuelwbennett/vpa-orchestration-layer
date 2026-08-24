// =====================================================
// Service-layer configuration.
// All env vars are Vite-style (VITE_*) so they're inlined at build.
// Set them in a `.env.local` file at the project root (see .env.example).
// =====================================================

const env = import.meta.env || {};

export const config = {
  // Global student id used by adapters when none is per-app specific.
  // Default points at the real Math Facts test student UUID so the
  // dashboard shows live data without any .env.local setup.
  studentId: env.VITE_STUDENT_ID || "1240ae1d-c10f-44ed-96ef-5ee372f371a6",

  // ----- Math Academy (official partner API, via proxy) -----
  // Beta 5 for snapshot/today/xp/mastery; the knowledge profile
  // (services/mathAcademy.js fetchKnowledge) rides the proxy's
  // Beta 9 getStudentKnowledge integration.
  // The MA Public-API-Key lives server-side on the math-facts-trainer
  // Vercel project. The browser only talks to our proxy.
  //
  //   apiBaseUrl + snapshotPath  → where to fetch JSON
  //   deepLinkBaseUrl            → where the launch button sends the user
  //
  // `studentId` here is the VPA student UUID; the proxy translates it
  // to the Math Academy student id by reading student_app_accounts.
  mathAcademy: {
    enabled: true,
    apiBaseUrl:
      env.VITE_MA_API_BASE_URL || "https://math-facts-trainer.vercel.app",
    snapshotPath:
      env.VITE_MA_SNAPSHOT_PATH || "/api/math-academy/snapshot",
    deepLinkBaseUrl:
      env.VITE_MA_DEEP_LINK || "https://www.mathacademy.com",
    studentId:
      env.VITE_MA_STUDENT_ID || env.VITE_STUDENT_ID || "1240ae1d-c10f-44ed-96ef-5ee372f371a6",
    // Fallback only: the adapter now reads each student's real
    // per-weekday goal from Math Academy (the proxy's dailyGoalXp).
    // This value is used solely when the proxy can't supply a goal
    // (degraded/offline). A 0 from MA is a real rest day, not a fallback.
    dailyGoalFallback: 30
  },

  // ----- Math Facts (in-house, hosted on Vercel) -----
  mathFacts: {
    enabled: true,
    baseUrl:
      env.VITE_MF_BASE_URL || "https://math-facts-trainer.vercel.app",
    // Backend contract — see services/mathFacts.js for the response shape.
    snapshotPath: env.VITE_MF_SNAPSHOT_PATH || "/api/snapshot",
    studentId: env.VITE_MF_STUDENT_ID || env.VITE_STUDENT_ID || "1240ae1d-c10f-44ed-96ef-5ee372f371a6",
    dailyGoalFallback: 5
  },

  // ----- ASU Prep (Canvas LMS) -----
  // Link-only for now: the ring deep-links to ASU Prep's own dashboard
  // (which links through to Canvas). When we get a Canvas access token
  // from ASU Prep, the proxy grows /api/asu-prep/* endpoints and the
  // adapter (services/asuPrep.js) starts showing real course/assignment
  // data automatically — see the contract comment in that file.
  asuPrep: {
    enabled: true,
    // Future proxy home (same Vercel project that proxies Math Academy).
    apiBaseUrl:
      env.VITE_ASU_API_BASE_URL || "https://math-facts-trainer.vercel.app",
    snapshotPath: env.VITE_ASU_SNAPSHOT_PATH || "/api/asu-prep/snapshot",
    // Where the ring sends the student. Override with VITE_ASU_DEEP_LINK
    // once we confirm Jackson's exact login URL (Canvas lives at
    // asuprep.instructure.com).
    deepLinkBaseUrl:
      env.VITE_ASU_DEEP_LINK || "https://asuprep.instructure.com",
    studentId:
      env.VITE_ASU_STUDENT_ID || env.VITE_STUDENT_ID || "1240ae1d-c10f-44ed-96ef-5ee372f371a6"
  },

  // ----- Jackson's semester schedule (live Google Sheet) -----
  // The sheet is link-viewable, so the browser reads it directly via
  // Google's gviz CSV endpoint (CORS-friendly, no key needed). Skip's
  // Kula/ski/rehab entries flow onto the Semester Calendar tab inside
  // the sheet, so one tab fetch carries everything.
  schedule: {
    enabled: true,
    sheetId:
      env.VITE_SCHEDULE_SHEET_ID || "1WYotyKqwuBLzf7KPakOrkdnQb8Uu-h2pDASJw5tThfU",
    calendarTab: env.VITE_SCHEDULE_TAB || "Semester Calendar",
    // Which students see the schedule panel. Match by student UUID
    // (comma-separated env) OR by display-name prefix as a fallback,
    // so it works before we look up Jackson's UUID.
    studentIds: (env.VITE_SCHEDULE_STUDENT_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    studentNamePrefix: env.VITE_SCHEDULE_NAME_PREFIX || "Jackson"
  },

  // ----- Reading Facts (in-house, hosted on Vercel) -----
  // PARKED 2026-08-24: removed from the dashboard (adapter file kept in
  // the repo). Flip enabled back to true to restore the ring.
  readingFacts: {
    enabled: false,
    baseUrl:
      env.VITE_RF_BASE_URL || "https://reading-facts-app.vercel.app",
    snapshotPath: env.VITE_RF_SNAPSHOT_PATH || "/api/snapshot",
    studentId: env.VITE_RF_STUDENT_ID || env.VITE_STUDENT_ID || "1240ae1d-c10f-44ed-96ef-5ee372f371a6",
    dailyGoalFallback: 5
  },

  // ----- Reading Academy (in-house adaptive curriculum) -----
  // PARKED 2026-08-24: removed from the dashboard (adapter file kept in
  // the repo). NOTE: the reading-academy *deployment* still hosts
  // /api/provision-self (see provisionSelfUrl below) — parking the
  // adapter does not touch auth provisioning.
  readingAcademy: {
    enabled: false,
    baseUrl:
      env.VITE_RA_BASE_URL || "https://reading-academy.vercel.app",
    snapshotPath: env.VITE_RA_SNAPSHOT_PATH || "/api/snapshot",
    studentId:
      env.VITE_RA_STUDENT_ID || env.VITE_STUDENT_ID || "1240ae1d-c10f-44ed-96ef-5ee372f371a6",
    dailyGoalFallback: 30
  },

  // ----- Polling -----
  pollIntervalMs: Number(env.VITE_POLL_INTERVAL_MS) || 60_000,

  // ----- Auth provisioning -----
  // /api/provision-self is the server-controlled endpoint that
  // idempotently creates a user_profiles row on first sign-in and
  // returns the caller's role. Currently hosted on the Reading
  // Academy deployment; a candidate to move to a shared home
  // alongside the role schema (see supabase/README.md).
  provisionSelfUrl:
    env.VITE_PROVISION_SELF_URL ||
    "https://reading-academy.vercel.app/api/provision-self"
};
