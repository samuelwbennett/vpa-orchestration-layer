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

export async function fetchAllSnapshots({ signal } = {}) {
  const results = await Promise.allSettled(
    ADAPTERS.map(({ impl }) => impl.fetchSnapshot({ signal }))
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
export async function fetchAllMastery({ signal } = {}) {
  const results = await Promise.allSettled(
    ADAPTERS.map(({ impl }) =>
      typeof impl.fetchMastery === "function"
        ? impl.fetchMastery({ signal })
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
