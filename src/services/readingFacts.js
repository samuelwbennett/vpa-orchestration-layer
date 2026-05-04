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
    console.warn("[readingFacts] snapshot endpoint unavailable, using mock:", err);
    return {
      id: APP_ID,
      name: APP_NAME,
      dailyGoal: 30,
      todayXP: 0,
      weeklyXP: 90,
      status: "ready",
      link: baseUrl, // launch still works — sends them to the live app
      nextLesson: "Phonics: short-vowel review",
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
