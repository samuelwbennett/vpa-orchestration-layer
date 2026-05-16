// =====================================================
// Per-student summary helpers — shared between the student
// dashboard (computeOnTrack only), the teacher view, and the
// admin view, so a student's pace and reason read the same
// everywhere they appear.
// =====================================================

// "Is this student on pace today?"
//   >= 80% of daily XP goal  → green   "On Track"
//   >= 40%                   → yellow  "Slightly Behind"
//   <  40%                   → red     "Needs Attention"
// Apps that are coming_soon, or have no daily goal, are excluded.
// Returns { status, label, pct } — `pct` lets callers rank.
export function computeOnTrack(apps) {
  const active = (apps || []).filter(
    (a) => a.status !== "coming_soon" && a.dailyGoal > 0
  );
  if (active.length === 0) {
    return { status: "green", label: "On Track", pct: 1 };
  }

  const totalGoal = active.reduce((s, a) => s + a.dailyGoal, 0);
  const totalXP = active.reduce(
    (s, a) => s + Math.min(a.todayXP, a.dailyGoal),
    0
  );
  const pct = totalGoal === 0 ? 0 : totalXP / totalGoal;

  if (pct >= 0.8) return { status: "green", label: "On Track", pct };
  if (pct >= 0.4) return { status: "yellow", label: "Slightly Behind", pct };
  return { status: "red", label: "Needs Attention", pct };
}

// Per-student rollup the teacher and admin views use to build
// intervention queues and roster-row metadata.
export function summarize(apps) {
  const active = (apps || []).filter(
    (a) => a.status !== "coming_soon" && a.dailyGoal > 0
  );
  const onTrack = computeOnTrack(apps);
  const met = active.filter((a) => a.todayXP >= a.dailyGoal).length;
  const lagging = active.filter((a) => a.todayXP < a.dailyGoal);
  const noXp = active.length > 0 && active.every((a) => a.todayXP === 0);

  let reason;
  if (!apps || apps.length === 0) reason = "Status unavailable";
  else if (active.length === 0) reason = "No active apps today";
  else if (noXp) reason = "No XP yet today";
  else reason = `${met} of ${active.length} daily goals met`;

  return { onTrack, met, lagging, noXp, reason };
}

// Lower priority = more urgent. 3 means on track (kept out of the queue).
export function priority(summary) {
  if (summary.noXp) return 0;
  if (summary.onTrack.status === "red") return 1;
  if (summary.onTrack.status === "yellow") return 2;
  return 3;
}

// Compact per-app label for hover/tooltips.
export function appStatusLabel(a) {
  if (a.status === "coming_soon") return "coming soon";
  if (a.status === "complete") return "goal met";
  if (a.status === "in_progress") return `${a.todayXP} / ${a.dailyGoal} XP`;
  return "not started today";
}
