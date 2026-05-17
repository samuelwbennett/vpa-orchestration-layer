// =====================================================
// Orchestrator
// -----------------------------------------------------
// Single function the UI calls. Fans out to every adapter in parallel,
// merges their results, and tolerates individual adapter failures.
//
// Adapters must each export:
//   fetchSnapshot({ signal }) -> Promise<{
//     id, name, dailyGoal, todayXP, weeklyXP, status, link, nextLesson
//   }>
// =====================================================

import * as mathAcademy from "./mathAcademy.js";
import * as mathFacts from "./mathFacts.js";
import * as readingFacts from "./readingFacts.js";
import * as readingAcademy from "./readingAcademy.js";

// Order here = display order in the dashboard.
const ADAPTERS = [
  { key: "math-academy", impl: mathAcademy },
  { key: "math-facts", impl: mathFacts },
  { key: "reading-facts", impl: readingFacts },
  { key: "reading-academy", impl: readingAcademy }
];

export async function fetchAllSnapshots({ signal, studentId } = {}) {
  const results = await Promise.allSettled(
    ADAPTERS.map(({ impl }) => impl.fetchSnapshot({ signal, studentId }))
  );

  return results
    .map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      console.error(
        `[orchestrator] ${ADAPTERS[i].key} adapter failed:`,
        r.reason
      );
      return null;
    })
    .filter(Boolean);
}

// Mastery rollup for the skill garden. Adapters that expose
// fetchMastery() participate; the rest return empty strand arrays
// (handled by the adapter's own missing-implementation path).
//
// Returns array of { id, name, strands: [...] } in the same display
// order as fetchAllSnapshots.
export async function fetchAllMastery({ signal, studentId } = {}) {
  const results = await Promise.allSettled(
    ADAPTERS.map(({ impl }) =>
      typeof impl.fetchMastery === "function"
        ? impl.fetchMastery({ signal, studentId })
        : Promise.resolve({ strands: [] })
    )
  );

  return results
    .map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      console.error(
        `[orchestrator] ${ADAPTERS[i].key} mastery failed:`,
        r.reason
      );
      return { id: ADAPTERS[i].key, name: ADAPTERS[i].key, strands: [], _degraded: true };
    });
}

// =====================================================
// Contract v1.0 endpoints — today + xp
// -----------------------------------------------------
// These are wired in but not every adapter implements them yet
// (Reading Academy does; Math Facts / Reading Facts / Math Academy
// will follow in their own PRs). Adapters that don't implement
// fetchToday()/fetchXp() simply don't contribute — the launcher
// degrades gracefully app-by-app.
// =====================================================

// Roll up "what should this student do today" across every app and
// pick the single highest-priority block. Returns the full per-app
// list AND the top-pick, so the launcher can render either.
//
// Priority order: high > medium > low; ties broken by adapter order.
export async function fetchAllToday({ signal, studentId } = {}) {
  const results = await Promise.allSettled(
    ADAPTERS.map(({ impl }) =>
      typeof impl.fetchToday === "function"
        ? impl.fetchToday({ signal, studentId })
        : Promise.resolve(null)
    )
  );

  const perApp = results
    .map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      console.error(`[orchestrator] ${ADAPTERS[i].key} today failed:`, r.reason);
      return null;
    })
    .filter(Boolean);

  const RANK = { high: 0, medium: 1, low: 2 };
  const ranked = perApp
    .filter((a) => a.recommendation && a.recommendation.kind !== "none")
    .sort((a, b) => {
      const ra = RANK[a.recommendation.priority] ?? 3;
      const rb = RANK[b.recommendation.priority] ?? 3;
      return ra - rb;
    });

  return { perApp, top: ranked[0] || null };
}

// Roll up XP across every app for each contract window. Returns the
// per-app responses and a summed object the launcher can render in
// the unified XP ring. lastEarnedAt is the MAX across apps.
export async function fetchAllXp({ signal, studentId } = {}) {
  const results = await Promise.allSettled(
    ADAPTERS.map(({ impl }) =>
      typeof impl.fetchXp === "function"
        ? impl.fetchXp({ signal, studentId })
        : Promise.resolve(null)
    )
  );

  const perApp = results
    .map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      console.error(`[orchestrator] ${ADAPTERS[i].key} xp failed:`, r.reason);
      return null;
    })
    .filter(Boolean);

  const totals = {
    today: 0, yesterday: 0, thisWeek: 0,
    lastWeek: 0, thisMonth: 0, allTime: 0,
  };
  let lastEarnedAt = null;
  for (const a of perApp) {
    if (!a?.windows) continue;
    for (const k of Object.keys(totals)) {
      totals[k] += Number(a.windows[k]) || 0;
    }
    if (a.lastEarnedAt) {
      if (!lastEarnedAt || a.lastEarnedAt > lastEarnedAt) {
        lastEarnedAt = a.lastEarnedAt;
      }
    }
  }

  return { perApp, totals, lastEarnedAt };
}
