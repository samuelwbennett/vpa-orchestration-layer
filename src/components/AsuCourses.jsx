import React from "react";
import { ExternalLink } from "lucide-react";
import { useAsuProgress } from "../hooks/useAsuProgress.js";
import { launchApp } from "../utils/launch.js";
import { assignmentPace } from "../services/pace.js";

/**
 * AsuCourses — per-course progress for Jackson's ASU Prep (Canvas)
 * courses, in the Knowledge Graph's visual language: one horizontal
 * bar per course, single hue (ASU maroon), labeled chips (never
 * color alone).
 *
 * Completion = assignments submitted / total published assignments —
 * the honest number (Canvas's own module-requirement "progress" only
 * tracks a handful of checkpoints and reads absurdly high).
 *
 * The pace tick on each bar marks where he SHOULD be today (linear
 * between course start/end dates); the chip states the gap in
 * ASSIGNMENTS, which is countable against Canvas. Days appear only in
 * the tooltip, and are derived from his own observed rate rather than
 * the ideal one — see services/pace.js for why that distinction
 * matters.
 *
 * NOTE: the Canvas token identifies one student (Jackson), so this
 * section must only render on his dashboard — App.jsx gates it with
 * shouldShowSchedule(student), same as the schedule panel.
 */
export default function AsuCourses() {
  const { courses, asOf, degraded } = useAsuProgress(true);

  if (courses === null) {
    return (
      <div className="card" style={{ color: "var(--text-muted)" }}>
        Loading ASU Prep courses…
      </div>
    );
  }

  if (degraded || courses.length === 0) {
    return (
      <div className="card" style={{ color: "var(--text-muted)" }}>
        Couldn't reach Canvas just now — it'll retry on its own. Course
        progress will reappear once the connection is back.
      </div>
    );
  }

  return (
    <div className="card asu-card">
      <div className="asu-rows" role="list">
        {courses.map((c) => (
          <CourseRow key={c.id} course={c} />
        ))}
      </div>
      {asOf && (
        <div className="kg-asof">Updated {formatAsOf(asOf)} · from Canvas</div>
      )}
    </div>
  );
}

function CourseRow({ course }) {
  const pct = clampPct(course.completionPct);
  const expected = clampPct(course.expectedPct);
  const hasBar = pct !== null;
  const pace = assignmentPace({
    assignmentsTotal: course.assignmentsTotal,
    assignmentsSubmitted: course.assignmentsSubmitted,
    expectedPct: course.expectedPct,
    startAt: course.startAt,
  });

  return (
    <div
      className="asu-row"
      role="listitem"
      aria-label={ariaLabel(course, pct, pace)}
    >
      <div className="asu-row-head">
        <button
          type="button"
          className="asu-course-name"
          onClick={() => course.htmlUrl && launchApp(course.htmlUrl)}
          title="Open this course in Canvas"
        >
          {cleanName(course.name)} <ExternalLink size={12} />
        </button>
        <div className="asu-row-meta">
          {course.assignmentsTotal > 0 && (
            <span className="asu-assignments">
              {course.assignmentsSubmitted} of {course.assignmentsTotal}{" "}
              assignments
            </span>
          )}
          {course.currentGrade != null && (
            <span className="asu-grade" title={gradeTitle(course)}>
              {course.currentGrade}
            </span>
          )}
          <PaceChip pace={pace} />
        </div>
      </div>

      {hasBar ? (
        <div className="asu-bar-line">
          <span className="asu-bar-track" aria-hidden="true">
            <span className="asu-bar-fill" style={{ width: `${pct}%` }} />
            {expected !== null && (
              <span
                className="asu-bar-expected"
                style={{ left: `${expected}%` }}
                title={`Expected pace today: ${expected}%`}
              />
            )}
          </span>
          <span className="asu-pct">{Math.round(pct)}%</span>
        </div>
      ) : (
        <div className="asu-nobar">No assignments published yet</div>
      )}
    </div>
  );
}

// Pace chip: labeled, calm, and honest. The headline is a COUNT of
// assignments, because that is the thing Jackson can actually go and
// do; the days figure lives in the tooltip and comes from his own
// average pace, not the ideal one.
function PaceChip({ pace }) {
  if (!pace || !pace.label) return null;
  return (
    <span
      className={`asu-pace asu-pace-${pace.status}`}
      title={pace.detail || undefined}
    >
      {pace.label}
    </span>
  );
}

// ---- helpers ----

// "2627-English 12A-LC-1" → "English 12A". Strips the leading school
// year code and trailing section suffix ASU puts on course names;
// falls back to the raw name when the pattern doesn't match.
export function cleanName(name) {
  if (!name) return "Course";
  const m = String(name).match(/^\d{4}-(.+?)(?:-[A-Z]{2,3}-\d+)?$/);
  return m ? m[1] : name;
}

function clampPct(v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return null;
  return Math.max(0, Math.min(100, Number(v)));
}

function gradeTitle(course) {
  return course.currentScore != null
    ? `Current grade: ${course.currentGrade} (${course.currentScore}%)`
    : `Current grade: ${course.currentGrade}`;
}

function ariaLabel(course, pct, pace) {
  const bits = [cleanName(course.name)];
  if (pct !== null) bits.push(`${Math.round(pct)} percent of assignments done`);
  if (pace && pace.label) bits.push(pace.label);
  if (course.currentGrade) bits.push(`current grade ${course.currentGrade}`);
  return bits.join(", ");
}

function formatAsOf(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
