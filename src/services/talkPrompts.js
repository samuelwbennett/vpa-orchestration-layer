// =====================================================
// Talk prompts — "Talk with Jackson about ___" per class.
// -----------------------------------------------------
// Rule-based and strictly data-grounded: every prompt names the fact
// that produced it (a course behind pace, the assignment that's next
// up, the topic he's mid-way through). Nothing here infers how he
// feels or what he "should" do — a parent can always trace the line
// back to a number on the page.
//
// Pure functions, no fetching. Returns at most one prompt per class
// so the section stays a short list Dan and Skip can act on.
// =====================================================

import { assignmentPace } from "./pace.js";

// Raise a course once it is this many assignments short of where the
// calendar says it should be. Assignments, not days: "2 behind" is a
// thing a parent can check and Jackson can clear, and it no longer
// depends on the ideal-pace fiction the old days figure assumed.
const BEHIND_ASSIGNMENTS = 2;

// Strip ASU's course-code wrapper: "2627-English 12A-LC-1" → "English 12A".
export function courseLabel(name) {
  if (!name) return "Course";
  const m = String(name).match(/^\d{4}-(.+?)(?:-[A-Z]{2,3}-\d+)?$/);
  return m ? m[1] : name;
}

function dueSoonText(dueAt) {
  if (!dueAt) return null;
  const ms = Date.parse(dueAt);
  if (!Number.isFinite(ms)) return null;
  const days = Math.round((ms - Date.now()) / 86400000);
  if (days < 0) return "already past its due date";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days <= 7) return `due in ${days} days`;
  return null;
}

// One prompt per ASU course.
export function asuCoursePrompts(courses) {
  return (courses || []).map((c) => {
    const label = courseLabel(c.name);
    const grade = c.currentGrade ? ` (currently ${c.currentGrade})` : "";
    const next = (c.nextAssignments || [])[0] || null;

    // 1. Behind pace is the thing worth raising first.
    const pace = assignmentPace({
      assignmentsTotal: c.assignmentsTotal,
      assignmentsSubmitted: c.assignmentsSubmitted,
      expectedPct: c.expectedPct,
      startAt: c.startAt,
    });
    if (Number.isFinite(pace.behind) && pace.behind >= BEHIND_ASSIGNMENTS) {
      const gap =
        pace.behind === 1 ? "1 assignment behind" : `${pace.behind} assignments behind`;
      return {
        id: c.id,
        course: label,
        tone: pace.status === "farbehind" ? "red" : "yellow",
        prompt: next
          ? `${label} is ${gap} — ask what's blocking "${next.name}".`
          : `${label} is ${gap} — ask what's slowing it down.`,
        why: pace.detail || `${c.assignmentsSubmitted} of ${c.assignmentsTotal} assignments done${grade}.`,
      };
    }

    // 2. Course finished.
    if (c.assignmentsTotal > 0 && c.assignmentsSubmitted >= c.assignmentsTotal) {
      return {
        id: c.id,
        course: label,
        tone: "green",
        prompt: `${label} is finished — worth celebrating.`,
        why: `All ${c.assignmentsTotal} assignments submitted${grade}.`,
      };
    }

    // 3. Normal case: ask about the actual next piece of work.
    if (next) {
      const due = dueSoonText(next.dueAt);
      return {
        id: c.id,
        course: label,
        tone: "neutral",
        prompt: `Ask how "${next.name}" is going — it's next up in ${label}${due ? `, ${due}` : ""}.`,
        why: `${c.assignmentsSubmitted} of ${c.assignmentsTotal} done${grade}.`,
      };
    }

    // 4. Nothing specific to point at.
    return {
      id: c.id,
      course: label,
      tone: "neutral",
      prompt: `${label} is on pace — nothing needing a nudge today.`,
      why: `${c.assignmentsSubmitted} of ${c.assignmentsTotal} done${grade}.`,
    };
  });
}

// One prompt for Math Academy, built from the topics he's actively
// learning (state "learning" in the Beta 9 knowledge profile).
export function mathAcademyPrompt(knowledge) {
  const app = (knowledge || []).find((k) => k && Array.isArray(k.topics));
  if (!app) return null;

  const learning = app.topics
    .filter((t) => t.state === "learning" && t.name)
    .slice(0, 2)
    .map((t) => t.name);

  const courseName = app.course?.name || "Math Academy";
  const pct = Number.isFinite(app.course?.percentComplete)
    ? ` — ${app.course.percentComplete}% complete`
    : "";

  if (learning.length === 0) {
    return {
      id: "math-academy",
      course: "Math Academy",
      tone: "neutral",
      prompt: `Ask how ${courseName} is feeling right now.`,
      why: `${courseName}${pct}.`,
    };
  }

  const topics =
    learning.length === 1 ? learning[0] : `${learning[0]} and ${learning[1]}`;
  return {
    id: "math-academy",
    course: "Math Academy",
    tone: "neutral",
    prompt: `He's mid-way through ${topics} — ask which part is clicking and which isn't.`,
    why: `${courseName}${pct} · ${app.summary?.learning ?? 0} topics in progress.`,
  };
}

export function buildTalkPrompts({ courses, knowledge }) {
  const out = [];
  const ma = mathAcademyPrompt(knowledge);
  if (ma) out.push(ma);
  out.push(...asuCoursePrompts(courses));
  return out;
}
