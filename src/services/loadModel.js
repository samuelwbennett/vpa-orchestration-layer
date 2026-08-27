// =====================================================
// Load model — pure math, no fetching.
// -----------------------------------------------------
// Implements the design from the 2026-08-26 research brief:
//
//   learning_load(day) = focused minutes × mind_RPE
//   physical_load(day) = training minutes × body_RPE
//     (Foster session-RPE, applied symmetrically; missing RPE
//      falls back to 5 so duration alone still counts)
//
//   Each series is normalized by its own 28-day EWMA ("chronic"),
//   combined 50/50, and the readiness ratio is the 7-day EWMA of the
//   combined normalized load. Presented DESCRIPTIVELY ("this week is
//   1.4× your normal month") — never as burnout/injury prediction;
//   the ACWR evidence doesn't support stronger claims.
//
//   Thresholds: < 0.8 capacity to bank · < 1.2 on track ·
//   1.2–1.5 elevated · > 1.5 high.
//
// Training minutes come from the schedule sheet with documented,
// deliberately crude constants (a real session-length log can
// replace them later):
//   cardio rotation listed → 45 min · ski entry → 120 · kula → 60.
//
// Cold start: fewer than MIN_BASELINE_DAYS days with any load →
// status "baseline" (show minutes, no ratio).
// =====================================================

export const RPE_FALLBACK = 5;
export const MIN_BASELINE_DAYS = 7;

export const THRESHOLDS = {
  bank: 0.8,
  onTrack: 1.2,
  elevated: 1.5,
};

// Break cadence (structured breaks are evidence-backed; the exact
// ratio is convention — pick one and hold it).
export const WORK_BLOCK_MIN = 40;
export const BREAK_MIN = 8;

const TRAINING_MINUTES = { cardio: 45, ski: 120, kula: 60 };

// ---- schedule → physical minutes ----

// scheduleDay: a row from services/schedule.js (cardio, ski, kula...).
export function physicalMinutesForDay(scheduleDay) {
  if (!scheduleDay) return 0;
  let mins = 0;
  const cardio = (scheduleDay.cardio || "").toLowerCase();
  if (cardio && !cardio.includes("break") && !cardio.includes("travel")) {
    mins += TRAINING_MINUTES.cardio;
  }
  if (scheduleDay.ski) mins += TRAINING_MINUTES.ski;
  if (scheduleDay.kula) mins += TRAINING_MINUTES.kula;
  return mins;
}

// ---- daily series assembly ----

function localDayOf(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Build per-day rows for the trailing `days` window (oldest first).
//   sessions: learning_sessions rows (started_at, seconds)
//   checkins: daily_checkins rows (day, mind_rpe, body_rpe)
//   scheduleDays: schedule.js rows (iso, cardio, ski, kula)
export function buildDailySeries({ sessions, checkins, scheduleDays, days = 28, now = new Date() }) {
  const learnMinByDay = new Map();
  for (const s of sessions || []) {
    const day = localDayOf(s.started_at);
    learnMinByDay.set(
      day,
      (learnMinByDay.get(day) || 0) + (Number(s.seconds) || 0) / 60
    );
  }
  const checkinByDay = new Map((checkins || []).map((c) => [c.day, c]));
  const scheduleByDay = new Map((scheduleDays || []).map((d) => [d.iso, d]));

  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = localDayOf(d.toISOString());
    const checkin = checkinByDay.get(key) || {};
    const learnMin = Math.round(learnMinByDay.get(key) || 0);
    const physMin = physicalMinutesForDay(scheduleByDay.get(key));
    out.push({
      day: key,
      learnMin,
      physMin,
      mindRpe: checkin.mind_rpe ?? null,
      bodyRpe: checkin.body_rpe ?? null,
      learnLoad: learnMin * (checkin.mind_rpe ?? RPE_FALLBACK),
      physLoad: physMin * (checkin.body_rpe ?? RPE_FALLBACK),
    });
  }
  return out;
}

// ---- EWMA + readiness ----

export function ewma(values, spanDays) {
  const alpha = 2 / (spanDays + 1);
  let acc = null;
  for (const v of values) {
    acc = acc === null ? v : alpha * v + (1 - alpha) * acc;
  }
  return acc ?? 0;
}

export function computeReadiness(series) {
  const activeDays = series.filter((d) => d.learnLoad > 0 || d.physLoad > 0);
  if (activeDays.length < MIN_BASELINE_DAYS) {
    return { status: "baseline", ratio: null, daysOfData: activeDays.length };
  }

  const learn = series.map((d) => d.learnLoad);
  const phys = series.map((d) => d.physLoad);
  const learnChronic = ewma(learn, 28);
  const physChronic = ewma(phys, 28);

  // Normalize each day by its own chronic load, combine 50/50. A
  // series with no chronic signal contributes 0, not NaN.
  const combined = series.map((d) => {
    const l = learnChronic > 0 ? d.learnLoad / learnChronic : 0;
    const p = physChronic > 0 ? d.physLoad / physChronic : 0;
    if (learnChronic > 0 && physChronic > 0) return 0.5 * l + 0.5 * p;
    return l + p; // only one signal present — use it alone
  });
  const ratio = ewma(combined, 7);

  let status = "onTrack";
  if (ratio < THRESHOLDS.bank) status = "bank";
  else if (ratio >= THRESHOLDS.elevated) status = "high";
  else if (ratio >= THRESHOLDS.onTrack) status = "elevated";

  return {
    status,
    ratio: Math.round(ratio * 100) / 100,
    learnChronic: Math.round(learnChronic),
    physChronic: Math.round(physChronic),
    daysOfData: activeDays.length,
  };
}

// Human copy for the readiness chip — descriptive, never diagnostic.
export function readinessCopy(readiness) {
  switch (readiness.status) {
    case "baseline":
      return {
        label: "Collecting baselines",
        detail: `${readiness.daysOfData} of ${MIN_BASELINE_DAYS} days logged — the dial unlocks with a week of data.`,
        tone: "muted",
        blockMin: WORK_BLOCK_MIN,
      };
    case "bank":
      return {
        label: "Capacity to bank",
        detail: `This week is running ${readiness.ratio}× your normal month — a good week to get ahead.`,
        tone: "green",
        blockMin: WORK_BLOCK_MIN,
      };
    case "elevated":
      return {
        label: "Elevated",
        detail: `This week is ${readiness.ratio}× your normal month — shorter blocks, stop at your goal.`,
        tone: "yellow",
        blockMin: 30,
      };
    case "high":
      return {
        label: "High load",
        detail: `This week is ${readiness.ratio}× your normal month — minimum day: hit the XP goal and stop.`,
        tone: "red",
        blockMin: 25,
      };
    default:
      return {
        label: "On track",
        detail: `This week is ${readiness.ratio}× your normal month.`,
        tone: "green",
        blockMin: WORK_BLOCK_MIN,
      };
  }
}

// ---- planner: schedule lookahead ----

// Scan the next `lookaheadDays` schedule rows for reduced-capacity
// stretches (travel / no school) and return at most one banking hint.
export function planningHint(scheduleDays, now = new Date(), lookaheadDays = 14) {
  if (!Array.isArray(scheduleDays) || scheduleDays.length === 0) return null;
  const todayKey = localDayOf(now.toISOString());
  const upcoming = scheduleDays
    .filter((d) => d.iso > todayKey)
    .slice(0, lookaheadDays);

  const first = upcoming.find(
    (d) =>
      /remote|travel/i.test(d.school || "") ||
      /^no school/i.test(d.school || "") ||
      !!d.ski
  );
  if (!first) return null;

  const kind = /^no school/i.test(first.school || "")
    ? "a school break"
    : "ski/travel days";
  return {
    startsIso: first.iso,
    label: `${kind} starting ${first.rawDate}`,
    detail: `Heads up: ${kind} start ${first.rawDate}. Banking a little extra now (up to ~30% above normal) beats cramming the day before.`,
  };
}
