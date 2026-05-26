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

export async function fetchSnapshot({ signal, studentId } = {}) {
  const { baseUrl, snapshotPath, dailyGoalFallback } = config.mathFacts;
  const sid = studentId || config.mathFacts.studentId;
  const url = `${baseUrl}${snapshotPath}?student=${encodeURIComponent(sid)}`;

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
    console.warn("[mathFacts] snapshot endpoint unavailable, degrading:", err);
    // Degraded fallback must NOT fabricate progress. Earlier this
    // returned a fake "complete 30/30" snapshot, which made every
    // student look done on the dashboard AND silently emptied the
    // teacher/admin intervention queue whenever this backend was
    // down. Fail toward "nothing earned yet" so a real outage is
    // visible rather than masked.
    return {
      id: APP_ID,
      name: APP_NAME,
      dailyGoal: dailyGoalFallback,
      todayXP: 0,
      weeklyXP: 0,
      status: "ready",
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

// Per-operation mastery for the dashboard's skill garden.
//
//   GET {baseUrl}/api/math-facts/mastery?student=<id>
//   → { studentId, strands: [{ id, label, symbol, mastered, total, ... }] }
const MASTERY_PATH = "/api/math-facts/mastery";
const TODAY_PATH = "/api/today";
const XP_PATH = "/api/xp";

// Contract v1.0 — Math Facts top recommendation for the student.
// Same shape as readingAcademy.fetchToday — see services/orchestrator.js
// for how fetchAllToday aggregates per-app blocks into a single pick.
export async function fetchToday({ signal, studentId } = {}) {
  const { baseUrl } = config.mathFacts;
  const sid = studentId || config.mathFacts.studentId;
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
    console.warn("[mathFacts] today endpoint unavailable:", err);
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

// Contract v1.0 — multi-window XP totals.
export async function fetchXp({ signal, studentId } = {}) {
  const { baseUrl } = config.mathFacts;
  const sid = studentId || config.mathFacts.studentId;
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
    console.warn("[mathFacts] xp endpoint unavailable:", err);
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
  const { baseUrl } = config.mathFacts;
  const sid = studentId || config.mathFacts.studentId;
  const url = `${baseUrl}${MASTERY_PATH}?student=${encodeURIComponent(sid)}`;
  try {
    const data = await getJSON(url, { signal });
    return {
      id: APP_ID,
      name: APP_NAME,
      strands: Array.isArray(data?.strands) ? data.strands : [],
    };
  } catch (err) {
    console.warn("[mathFacts] mastery endpoint unavailable:", err);
    return {
      id: APP_ID,
      name: APP_NAME,
      strands: [],
      _degraded: true,
    };
  }
}
