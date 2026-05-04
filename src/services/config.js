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

  // ----- Math Academy (official Beta 5 partner API, via proxy) -----
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
    dailyGoalFallback: 40
  },

  // ----- Math Facts (in-house, hosted on Vercel) -----
  mathFacts: {
    enabled: true,
    baseUrl:
      env.VITE_MF_BASE_URL || "https://math-facts-trainer.vercel.app",
    // Backend contract — see services/mathFacts.js for the response shape.
    snapshotPath: env.VITE_MF_SNAPSHOT_PATH || "/api/snapshot",
    studentId: env.VITE_MF_STUDENT_ID || env.VITE_STUDENT_ID || "1240ae1d-c10f-44ed-96ef-5ee372f371a6",
    dailyGoalFallback: 30
  },

  // ----- Reading Facts (in-house, hosted on Vercel) -----
  readingFacts: {
    enabled: true,
    baseUrl:
      env.VITE_RF_BASE_URL || "https://reading-facts-app.vercel.app",
    snapshotPath: env.VITE_RF_SNAPSHOT_PATH || "/api/snapshot",
    studentId: env.VITE_RF_STUDENT_ID || env.VITE_STUDENT_ID || "1240ae1d-c10f-44ed-96ef-5ee372f371a6",
    dailyGoalFallback: 30
  },

  // ----- Polling -----
  pollIntervalMs: Number(env.VITE_POLL_INTERVAL_MS) || 60_000
};
