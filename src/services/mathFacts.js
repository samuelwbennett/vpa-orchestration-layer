// =====================================================
// Math Facts adapter
// -----------------------------------------------------
// Talks to your in-house Math Facts Trainer:
//   https://math-facts-trainer.vercel.app
//
// === Backend contract to add to math-facts-trainer ===
//
//   GET {baseUrl}/api/snapshot?student=<id>
//
//   Response 200 (application/json):
//   {
//     "todayXp":      number,        // XP earned today
//     "weekXp":       number,        // XP earned across the last 7 days
//     "dailyGoalXp":  number,        // configured per-student daily goal
//     "nextDrill": {
//       "label":      string,        // e.g. "Multiplication facts to 12"
//       "path":       string         // e.g. "/#/drill/mult-12" — appended to baseUrl
//     }
//   }
//
//   CORS: must allow the dashboard origin (or "*" while in dev).
//
// Until that endpoint is deployed the adapter falls back to mock data
// but the launch button still deep-links to the live app.
// =====================================================

import { config } from "./config.js";
import { getJSON } from "./apiClient.js";

const APP_ID = "math-facts";
const APP_NAME = "Math Facts";

export async function fetchSnapshot({ signal } = {}) {
  const { baseUrl, snapshotPath, studentId, dailyGoalFallback } = config.mathFacts;
  const url = `${baseUrl}${snapshotPath}?student=${encodeURIComponent(studentId)}`;

  try {
    const data = await getJSON(url, { signal });
    const dailyGoal = Math.round(data.dailyGoalXp ?? dailyGoalFallback);
    // API returns floats (e.g. 24.7382). Round for display.
    const todayXP = Math.round(data.todayXp ?? 0);

    return {
      id: APP_ID,
      name: APP_NAME,
      dailyGoal,
      todayXP,
      weeklyXP: Math.round(data.weekXp ?? 0),
      status: deriveStatus(todayXP, dailyGoal),
      link: data.nextDrill?.path
        ? `${baseUrl}${data.nextDrill.path}`
        : baseUrl,
      nextLesson: data.nextDrill?.label || null
    };
  } catch (err) {
    console.warn("[mathFacts] snapshot endpoint unavailable, using mock:", err);
    return {
      id: APP_ID,
      name: APP_NAME,
      dailyGoal: 30,
      todayXP: 30,
      weeklyXP: 180,
      status: "complete",
      link: baseUrl, // launch still works — sends them to the live app
      nextLesson: null,
      _degraded: true
    };
  }
}

function deriveStatus(today, goal) {
  if (goal === 0) return "ready";
  if (today >= goal) return "complete";
  if (today > 0) return "in_progress";
  return "ready";
}
