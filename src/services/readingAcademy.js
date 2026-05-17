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
const TODAY_PATH = "/api/today";
const XP_PATH = "/api/xp";

// Contract v1.0 — /api/today returns the vertical's top recommendation
// for the student: { kind, headline, subtitle, estimatedMinutes,
// priority, path, reason, details } + blocksRemaining + _notProvisioned.
// The orchestrator's fetchAllToday() rolls these up across apps so the
// launcher can pick the single highest-priority block.
export async function fetchToday({ signal, studentId } = {}) {
  const { baseUrl } = config.readingAcademy;
  const sid = studentId || config.readingAcademy.studentId;
  const url = `${baseUrl}${TODAY_PATH}?student=${encodeURIComponent(sid)}`;
  try {
    const data = await getJSON(url, { signal });
    return {
      id: APP_ID,
      name: APP_NAME,
      recommendation: data?.recommendation || null,
      blocksRemaining: Number(data?.blocksRemaining) || 0,
      link: data?.recommendation?.path
        ? `${baseUrl}${data.recommendation.path}`
        : baseUrl,
      _notProvisioned: !!data?._notProvisioned,
    };
  } catch (err) {
    console.warn("[readingAcademy] today endpoint unavailable:", err);
    return {
      id: APP_ID,
      name: APP_NAME,
      recommendation: null,
      blocksRemaining: 0,
      link: baseUrl,
      _degraded: true,
    };
  }
}

// Contract v1.0 — /api/xp returns multi-window XP for the student
// so the launcher can roll up unified totals without re-implementing
// the math per-app. Shape: { today, yesterday, thisWeek, lastWeek,
// thisMonth, allTime, lastEarnedAt }.
export async function fetchXp({ signal, studentId } = {}) {
  const { baseUrl } = config.readingAcademy;
  const sid = studentId || config.readingAcademy.studentId;
  const url = `${baseUrl}${XP_PATH}?student=${encodeURIComponent(sid)}`;
  try {
    const data = await getJSON(url, { signal });
    return {
      id: APP_ID,
      name: APP_NAME,
      windows: {
        today: Number(data?.today) || 0,
        yesterday: Number(data?.yesterday) || 0,
        thisWeek: Number(data?.thisWeek) || 0,
        lastWeek: Number(data?.lastWeek) || 0,
        thisMonth: Number(data?.thisMonth) || 0,
        allTime: Number(data?.allTime) || 0,
      },
      lastEarnedAt: data?.lastEarnedAt || null,
      _notProvisioned: !!data?._notProvisioned,
    };
  } catch (err) {
    console.warn("[readingAcademy] xp endpoint unavailable:", err);
    return {
      id: APP_ID,
      name: APP_NAME,
      windows: {
        today: 0, yesterday: 0, thisWeek: 0,
        lastWeek: 0, thisMonth: 0, allTime: 0,
      },
      lastEarnedAt: null,
      _degraded: true,
    };
  }
}

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
