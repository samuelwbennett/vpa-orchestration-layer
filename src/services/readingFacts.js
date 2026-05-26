// =====================================================
// Reading Facts adapter
// -----------------------------------------------------
// Talks to your in-house Reading Facts app:
//   https://reading-facts-app.vercel.app
//
// === Backend contract to add to reading-facts-app ===
//
//   GET {baseUrl}/api/snapshot?student=<id>
//
//   Response 200 (application/json):
//   {
//     "todayXp":      number,        // XP earned today
//     "weekXp":       number,        // XP earned across the last 7 days
//     "dailyGoalXp":  number,        // configured per-student daily goal
//     "nextDrill": {
//       "label":      string,        // e.g. "Phonics: short-vowel review"
//       "path":       string         // e.g. "/#/phonics/short-vowels" — appended to baseUrl
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

const APP_ID = "reading-facts";
const APP_NAME = "Reading Facts";

export async function fetchSnapshot({ signal, studentId } = {}) {
  const { baseUrl, snapshotPath, dailyGoalFallback } = config.readingFacts;
  const sid = studentId || config.readingFacts.studentId;
  const url = `${baseUrl}${snapshotPath}?student=${encodeURIComponent(sid)}`;

  try {
    const data = await getJSON(url, { signal });
    const dailyGoal = Math.round(data.dailyGoalXp ?? dailyGoalFallback);
    // API may return floats — round for display.
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
    console.warn("[readingFacts] snapshot endpoint unavailable, degrading:", err);
    // Degraded fallback must not fabricate progress (no fake weekly
    // XP, no fake next-lesson). Fail toward "nothing earned yet".
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

// Per-strand mastery for the dashboard's skill garden. Same baseUrl
// as fetchSnapshot — the proxy lives next to the snapshot endpoint.
//
//   GET {baseUrl}/api/mastery?student=<id>
//   → { studentId, strands: [{ id, label, symbol, mastered, attempted, ... }] }
//
// Returns { id, name, strands: [...] } shaped for the orchestrator.
// On error, returns an empty strands array tagged _degraded so the
// UI can render a quiet placeholder.
const MASTERY_PATH = "/api/mastery";
const TODAY_PATH = "/api/today";
const XP_PATH = "/api/xp";

// Contract v1.0 — Reading Facts top recommendation. Same shape as
// readingAcademy.fetchToday and mathFacts.fetchToday.
export async function fetchToday({ signal, studentId } = {}) {
  const { baseUrl } = config.readingFacts;
  const sid = studentId || config.readingFacts.studentId;
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
    console.warn("[readingFacts] today endpoint unavailable:", err);
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
  const { baseUrl } = config.readingFacts;
  const sid = studentId || config.readingFacts.studentId;
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
    console.warn("[readingFacts] xp endpoint unavailable:", err);
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
  const { baseUrl } = config.readingFacts;
  const sid = studentId || config.readingFacts.studentId;
  const url = `${baseUrl}${MASTERY_PATH}?student=${encodeURIComponent(sid)}`;
  try {
    const data = await getJSON(url, { signal });
    return {
      id: APP_ID,
      name: APP_NAME,
      strands: Array.isArray(data?.strands) ? data.strands : [],
    };
  } catch (err) {
    console.warn("[readingFacts] mastery endpoint unavailable:", err);
    return {
      id: APP_ID,
      name: APP_NAME,
      strands: [],
      _degraded: true,
    };
  }
}
