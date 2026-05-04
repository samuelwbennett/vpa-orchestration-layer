// =====================================================
// Math Academy adapter
// -----------------------------------------------------
// Talks to the Math Academy proxy hosted alongside the math-facts
// backend:
//
//   https://math-facts-trainer.vercel.app/api/math-academy/snapshot
//
// The proxy holds our partner Public-API-Key server-side and queries
// Math Academy's official Beta 5 partner API on our behalf. The
// browser never sees the MA key.
//
// === Backend contract (mirrors mathFacts / readingFacts) ===
//
//   GET {apiBaseUrl}{snapshotPath}?student=<vpa-student-uuid>
//
//   Response 200 (application/json):
//   {
//     "todayXp":      number,        // XP earned today (MA xpAwarded)
//     "weekXp":       number,        // XP earned across the last 7 days
//     "dailyGoalXp":  number,        // today's per-weekday goal from MA schedule
//     "nextDrill": {
//       "label":      string,        // e.g. "Algebra I — 31% complete"
//       "path":       string         // appended to deepLinkBaseUrl
//     },
//     "_notLinked":   boolean        // true when no math_academy row in
//                                    // student_app_accounts for this student
//   }
//
//   CORS: Access-Control-Allow-Origin: *.
//
// Two URLs are configured separately because the proxy lives on
// Vercel (math-facts-trainer.vercel.app) but the user-facing deep
// link target is mathacademy.com.
// =====================================================

import { config } from "./config.js";
import { getJSON } from "./apiClient.js";

const APP_ID = "math-academy";
const APP_NAME = "Math Academy";

export async function fetchSnapshot({ signal } = {}) {
  const {
    apiBaseUrl,
    snapshotPath,
    deepLinkBaseUrl,
    studentId,
    dailyGoalFallback,
  } = config.mathAcademy;
  const url = `${apiBaseUrl}${snapshotPath}?student=${encodeURIComponent(studentId)}`;

  try {
    const data = await getJSON(url, { signal });
    // VPA pins the Math Academy daily goal to 30 XP regardless of
    // what's configured inside Math Academy's own per-weekday
    // schedule. Ignore data.dailyGoalXp on purpose.
    const dailyGoal = dailyGoalFallback;
    const todayXP = Math.round(data.todayXp ?? 0);

    return {
      id: APP_ID,
      name: APP_NAME,
      dailyGoal,
      todayXP,
      weeklyXP: Math.round(data.weekXp ?? 0),
      status: deriveStatus(todayXP, dailyGoal),
      // nextDrill.path is rooted at the user-facing domain, not the
      // proxy domain. For Math Academy that's mathacademy.com.
      link: data.nextDrill?.path
        ? `${deepLinkBaseUrl}${data.nextDrill.path}`
        : deepLinkBaseUrl,
      nextLesson: data.nextDrill?.label || null,
      // Math Academy league info, when the student is enrolled in one.
      // Shape: { name, level, position, participants } or null.
      league: data.league || null,
      _notLinked: !!data._notLinked,
    };
  } catch (err) {
    console.warn("[mathAcademy] snapshot endpoint unavailable, using mock:", err);
    return {
      id: APP_ID,
      name: APP_NAME,
      dailyGoal: dailyGoalFallback,
      todayXP: 0,
      weeklyXP: 0,
      status: "ready",
      link: deepLinkBaseUrl, // launch still works
      nextLesson: null,
      _degraded: true,
    };
  }
}

function deriveStatus(today, goal) {
  if (goal === 0) return "ready";
  if (today >= goal) return "complete";
  if (today > 0) return "in_progress";
  return "ready";
}

// Course-level mastery for the dashboard's skill garden. Math Academy
// doesn't expose per-topic mastery via the partner API, so the proxy
// returns a single strand representing the current course's overall
// progress — letterGrade and xpRemaining are passed through too.
//
//   GET {apiBaseUrl}/api/math-academy/mastery?student=<id>
//   → { studentId, strands: [{ id, label, symbol, mastered, total, grade, ... }] }
const MASTERY_PATH = "/api/math-academy/mastery";

export async function fetchMastery({ signal } = {}) {
  const { apiBaseUrl, studentId } = config.mathAcademy;
  const url = `${apiBaseUrl}${MASTERY_PATH}?student=${encodeURIComponent(studentId)}`;
  try {
    const data = await getJSON(url, { signal });
    return {
      id: APP_ID,
      name: APP_NAME,
      strands: Array.isArray(data?.strands) ? data.strands : [],
      _notLinked: !!data?._notLinked,
    };
  } catch (err) {
    console.warn("[mathAcademy] mastery endpoint unavailable:", err);
    return {
      id: APP_ID,
      name: APP_NAME,
      strands: [],
      _degraded: true,
    };
  }
}
