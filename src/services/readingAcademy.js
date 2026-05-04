// =====================================================
// Reading Academy adapter — locked / "Coming Soon"
// Returns a fixed snapshot so the orchestrator treats it uniformly.
// =====================================================

const APP_ID = "reading-academy";
const APP_NAME = "Reading Academy";

export async function fetchSnapshot() {
  return {
    id: APP_ID,
    name: APP_NAME,
    dailyGoal: 0,
    todayXP: 0,
    weeklyXP: 0,
    status: "coming_soon",
    link: "#",
    nextLesson: null
  };
}

// Reading Academy is coming-soon — return an empty strand list so the
// skill garden can render a locked tile.
export async function fetchMastery() {
  return {
    id: APP_ID,
    name: APP_NAME,
    strands: [],
    _comingSoon: true,
  };
}
