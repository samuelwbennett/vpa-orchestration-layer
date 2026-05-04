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
