// =====================================================
// Reading Academy adapter
// -----------------------------------------------------
// Talks to Reading Academy's snapshot + mastery endpoints, hosted
// at reading-academy.vercel.app. Same contract as the other adapters.
//
// === Backend contract (mirrors mathFacts / readingFacts) ===
//
//   GET {baseUrl}/api/snapshot?student=<vpa-student-uuid>
//   →  { todayXp, weekXp, dailyGoalXp, nextDrill: { label, path } }
//
//   GET {baseUrl}/api/mastery?student=<vpa-student-uuid>
//   →  { strands: [{ id, label, symbol, mastered, total, attempted, avgScore }] }
//
// CORS: Access-Control-Allow-Origin: *.
//
// While Reading Academy is being deployed for the first time we
// fall back gracefully — degraded mock keeps the dashboard rendering
// instead of erroring.
// =====================================================

import { config } from "./config.js";
import { getJSON } from "./apiClient.js";

const APP_ID = "reading-academy";
const APP_NAME = "Reading Academy";

export async function fetchSnapshot({ signal, studentId } = {}) {
  const { baseUrl, snapshotPath, dailyGoalFallback } = config.readingAcademy;
  const sid = studentId || config.readingAcademy.studentId;
  const url = `${baseUrl}${snapshotPath}?student=${encodeURIComponent(sid)}`;

  try {
    const data = await getJSON(url, { signal });
    const dailyGoal = Math.round(data.dailyGoalXp ?? dailyGoalFallback);
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
      nextLesson: data.nextDrill?.label || null,
      _notProvisioned: !!data._notProvisioned,
    };
  } catch (err) {
    console.warn("[readingAcademy] snapshot endpoint unavailable, using mock:", err);
    return {
      id: APP_ID,
      name: APP_NAME,
      dailyGoal: dailyGoalFallback,
      todayXP: 0,
      weeklyXP: 0,
      status: "ready",
      link: config.readingAcademy.baseUrl,
      nextLesson: null,
      _degraded: true,
    };
  }
}

const MASTERY_PATH = "/api/mastery";

export async function fetchMastery({ signal, studentId } = {}) {
  const { baseUrl } = config.readingAcademy;
  const sid = studentId || config.readingAcademy.studentId;
  const url = `${baseUrl}${MASTERY_PATH}?student=${encodeURIComponent(sid)}`;
  try {
    const data = await getJSON(url, { signal });
    return {
      id: APP_ID,
      name: APP_NAME,
      strands: Array.isArray(data?.strands) ? data.strands : [],
      _notProvisioned: !!data?._notProvisioned,
    };
  } catch (err) {
    console.warn("[readingAcademy] mastery endpoint unavailable:", err);
    return {
      id: APP_ID,
      name: APP_NAME,
      strands: [],
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
