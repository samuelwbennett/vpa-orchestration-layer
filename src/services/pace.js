// =====================================================
// Pace projection — pure math, no fetching.
// -----------------------------------------------------
// Answers the question Dan and Skip actually have: "at this rate,
// when is he done?" — and lets them drag the rate to see what would
// change.
//
// Two projections, deliberately simple and explainable:
//   ASU course:    remaining assignments ÷ assignments-per-week
//   Math Academy:  XP remaining ÷ XP-per-day
//
// Both are straight-line. That's honest for a planning tool: it says
// "if he keeps doing N per week", not "we predict". Break weeks and
// ski travel are NOT subtracted — a projection that quietly assumes
// days off is a projection nobody can sanity-check. The semester-end
// comparison is what carries the warning.
// =====================================================

// End of Semester 1, from the family schedule sheet. Overridable so
// the tool keeps working next semester without a code change.
export const SEMESTER_END = "2026-12-18";

const MS_DAY = 86400000;

export function addDays(date, days) {
  return new Date(date.getTime() + days * MS_DAY);
}

export function formatDate(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Whole weeks (rounded up) to clear `remaining` at `perWeek`.
export function projectCourse({ assignmentsTotal, assignmentsSubmitted, perWeek, now = new Date() }) {
  const total = Number(assignmentsTotal) || 0;
  const done = Number(assignmentsSubmitted) || 0;
  const remaining = Math.max(0, total - done);
  const rate = Number(perWeek) || 0;

  if (remaining === 0) {
    return { remaining: 0, weeksNeeded: 0, finishDate: now, complete: true };
  }
  if (rate <= 0) {
    return { remaining, weeksNeeded: Infinity, finishDate: null, complete: false };
  }
  const weeksNeeded = remaining / rate;
  return {
    remaining,
    weeksNeeded,
    finishDate: addDays(now, Math.ceil(weeksNeeded * 7)),
    complete: false,
  };
}

export function projectMathAcademy({ xpRemaining, xpPerDay, now = new Date() }) {
  const remaining = Math.max(0, Number(xpRemaining) || 0);
  const rate = Number(xpPerDay) || 0;
  if (remaining === 0) return { remaining: 0, daysNeeded: 0, finishDate: now, complete: true };
  if (rate <= 0) return { remaining, daysNeeded: Infinity, finishDate: null, complete: false };
  const daysNeeded = remaining / rate;
  return {
    remaining,
    daysNeeded,
    finishDate: addDays(now, Math.ceil(daysNeeded)),
    complete: false,
  };
}

// How a projected finish date reads against the semester deadline.
// Returns { tone, label } — tone drives the chip color.
export function verdictVsSemester(finishDate, semesterEnd = SEMESTER_END) {
  if (!finishDate) {
    return { tone: "red", label: "Never at this rate" };
  }
  const end = new Date(`${semesterEnd}T23:59:59`);
  const diffDays = Math.round((end - finishDate) / MS_DAY);
  if (diffDays >= 21) return { tone: "green", label: `${diffDays} days to spare` };
  if (diffDays >= 0) return { tone: "yellow", label: `Just makes it — ${diffDays} days to spare` };
  return { tone: "red", label: `${Math.abs(diffDays)} days past Dec 18` };
}

// The rate he's actually averaged so far this semester — the honest
// starting position for the slider, so the default isn't a guess.
export function observedPerWeek({ assignmentsSubmitted, semesterStart = "2026-08-18", now = new Date() }) {
  const start = new Date(`${semesterStart}T00:00:00`);
  const weeksElapsed = Math.max(1, (now - start) / (7 * MS_DAY));
  const rate = (Number(assignmentsSubmitted) || 0) / weeksElapsed;
  return Math.round(rate * 10) / 10;
}

// =====================================================
// Assignment-based pace — "how far behind is he?" answered in the
// unit the work actually comes in.
// -----------------------------------------------------
// WHY THIS REPLACED THE DAYS-ONLY CHIP (2026-09-11):
// The old chip derived days from the IDEAL schedule:
//     daysBehind = (completionPct - expectedPct) / 100 * semesterLength
// That reads as "days behind the perfect-pace line", which only
// converts to real catch-up time if he works at exactly the pace the
// course requires. He doesn't — so the number was optimistic in the
// one direction that matters. Physics on 2026-09-11: the old chip
// said 6 days behind; at his own observed rate the gap is ~8.5 days
// of work. Same data, 40% understated.
//
// Two honest numbers instead:
//   behind   = expected assignments by today - assignments submitted
//              (countable, checkable against Canvas)
//   daysBehind = behind / his OBSERVED per-day rate
//              ("days of work at the pace he's actually going")
//
// daysBehind deliberately does NOT model new work arriving while he
// catches up. If his rate is below the course's required rate he
// never closes the gap at all, and saying so is the Pace Projector's
// job (finish date vs Dec 18), not a chip's. The wording stays
// "to close today's gap" so the chip never implies more than it knows.
// =====================================================

export const SEMESTER_START = "2026-08-18";

// Guards, same spirit as the load model's baseline rules: a rate
// computed from almost no data is noise wearing a number's clothes.
export const MIN_ELAPSED_DAYS = 7;  // under a week in, any rate is noise
export const MIN_SUBMITTED = 3;     // under 3 submissions, likewise
export const ON_PACE_ASSIGNMENTS = 1; // within ±1 assignment reads as on pace
export const FAR_BEHIND_ASSIGNMENTS = 5;
export const AHEAD_ASSIGNMENTS = 2;
export const MAX_DISPLAY_DAYS = 60; // past this the number stops informing

/**
 * @returns {{
 *   status: "complete"|"ahead"|"onpace"|"behind"|"farbehind"|"notstarted"|"unknown",
 *   behind: number|null, behindExact: number|null, expectedDone: number|null,
 *   perWeek: number|null, daysBehind: number|null, daysCapped: boolean,
 *   label: string|null, detail: string|null
 * }}
 */
export function assignmentPace({
  assignmentsTotal,
  assignmentsSubmitted,
  expectedPct,
  startAt = SEMESTER_START,
  now = new Date(),
} = {}) {
  const total = Number(assignmentsTotal) || 0;
  const done = Number(assignmentsSubmitted) || 0;
  // Explicit null check: Number(null) is 0, not NaN, so a course with
  // no pace window would otherwise read as "0% expected" and report
  // him wildly AHEAD. Canvas returns null here more often than not.
  const expPct =
    expectedPct === null || expectedPct === undefined ? NaN : Number(expectedPct);

  const unknown = {
    status: "unknown", behind: null, behindExact: null, expectedDone: null,
    perWeek: null, daysBehind: null, daysCapped: false, label: null, detail: null,
  };
  if (total <= 0 || !Number.isFinite(expPct)) return unknown;

  if (done >= total) {
    return {
      ...unknown,
      status: "complete", behind: 0, behindExact: 0, expectedDone: total,
      label: "Complete", detail: `All ${total} assignments submitted.`,
    };
  }

  const expectedDone = (expPct / 100) * total;
  const behindExact = expectedDone - done;
  const behind = Math.round(behindExact);

  // Observed rate: what he has actually averaged since the course began.
  const start = Date.parse(`${String(startAt).slice(0, 10)}T00:00:00`);
  const elapsedDays = Number.isFinite(start)
    ? (now.getTime() - start) / 86400000
    : NaN;
  const enoughHistory =
    Number.isFinite(elapsedDays) && elapsedDays >= MIN_ELAPSED_DAYS && done >= MIN_SUBMITTED;
  const perDay = enoughHistory && elapsedDays > 0 ? done / elapsedDays : null;
  const perWeek = perDay === null ? null : Math.round(perDay * 7 * 10) / 10;

  // Days only mean something when he's behind AND we have a real rate.
  let daysBehind = null;
  let daysCapped = false;
  if (perDay !== null && perDay > 0 && behindExact > 0) {
    const d = behindExact / perDay;
    daysBehind = Math.min(MAX_DISPLAY_DAYS, Math.round(d));
    daysCapped = d > MAX_DISPLAY_DAYS;
  }

  if (done === 0 && expectedDone >= 1) {
    return {
      status: "notstarted", behind, behindExact, expectedDone,
      perWeek: null, daysBehind: null, daysCapped: false,
      label: "Not started",
      detail: `Nothing submitted yet · about ${Math.round(expectedDone)} expected by today.`,
    };
  }

  let status = "onpace";
  if (behind <= -AHEAD_ASSIGNMENTS) status = "ahead";
  else if (behind >= FAR_BEHIND_ASSIGNMENTS) status = "farbehind";
  else if (behind > ON_PACE_ASSIGNMENTS) status = "behind";

  return {
    status, behind, behindExact, expectedDone, perWeek, daysBehind, daysCapped,
    label: paceLabel(status, behind),
    detail: paceDetail({ status, behind, done, total, perWeek, daysBehind, daysCapped, expectedDone }),
  };
}

function plural(n, word) {
  return `${n} ${word}${Math.abs(n) === 1 ? "" : "s"}`;
}

function paceLabel(status, behind) {
  if (status === "ahead") return `${plural(Math.abs(behind), "assignment")} ahead`;
  if (status === "behind" || status === "farbehind") {
    return `${plural(behind, "assignment")} behind`;
  }
  return "On pace";
}

function paceDetail({ status, behind, done, total, perWeek, daysBehind, daysCapped, expectedDone }) {
  const base = `${done} of ${total} done · about ${Math.round(expectedDone)} expected by today.`;
  if (status === "ahead" || status === "onpace") {
    return perWeek ? `${base} Averaging ${perWeek}/week.` : base;
  }
  if (daysBehind === null) {
    return `${base} Too early to judge his rate.`;
  }
  const days = daysCapped ? `${MAX_DISPLAY_DAYS}+` : String(daysBehind);
  return `${base} At his current ${perWeek}/week, about ${days} ${
    daysBehind === 1 && !daysCapped ? "day" : "days"
  } of work to close the gap.`;
}
