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
