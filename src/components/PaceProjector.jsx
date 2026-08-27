import React, { useState } from "react";
import { CalendarClock } from "lucide-react";
import {
  projectCourse,
  projectMathAcademy,
  verdictVsSemester,
  observedPerWeek,
  formatDate,
  SEMESTER_END,
} from "../services/pace.js";
import { courseLabel } from "../services/talkPrompts.js";

/**
 * PaceProjector — "at this rate, when is he done?"
 *
 * One row per ASU course (assignments/week) plus Math Academy
 * (XP/day). Each slider starts at the rate he has ACTUALLY averaged
 * this semester, so the opening number is a fact, not a guess — then
 * Dan and Skip can drag it to see what a different pace would buy.
 *
 * Straight-line math on purpose: it says "if he keeps doing N a week",
 * which is a claim anyone can check, rather than a prediction that
 * quietly models days off.
 */
export default function PaceProjector({ courses, knowledge }) {
  const maCourse = (knowledge || []).find((k) => k && k.course)?.course || null;
  const xpRemaining = Number.isFinite(maCourse?.xpRemaining)
    ? maCourse.xpRemaining
    : null;

  const usable = (courses || []).filter((c) => c.assignmentsTotal > 0);

  if (usable.length === 0 && xpRemaining === null) {
    return (
      <div className="card" style={{ color: "var(--text-muted)" }}>
        Pace projections need course data — they'll appear once Canvas and
        Math Academy report in.
      </div>
    );
  }

  return (
    <div className="card pace-card">
      <p className="pace-intro">
        Drag a rate to see when he'd finish. Each slider starts where he's
        actually been averaging. Semester 1 ends{" "}
        <strong>{formatDate(new Date(`${SEMESTER_END}T12:00:00`))}</strong>.
      </p>

      {usable.map((c) => (
        <CourseRow key={c.id} course={c} />
      ))}

      {xpRemaining !== null && (
        <MathAcademyRow course={maCourse} xpRemaining={xpRemaining} />
      )}
    </div>
  );
}

function CourseRow({ course }) {
  const observed = Math.max(
    0.5,
    observedPerWeek({ assignmentsSubmitted: course.assignmentsSubmitted })
  );
  const [perWeek, setPerWeek] = useState(Math.round(observed * 2) / 2);

  const p = projectCourse({
    assignmentsTotal: course.assignmentsTotal,
    assignmentsSubmitted: course.assignmentsSubmitted,
    perWeek,
  });
  const verdict = p.complete
    ? { tone: "green", label: "Finished" }
    : verdictVsSemester(p.finishDate);

  return (
    <div className="pace-row">
      <div className="pace-row-head">
        <span className="pace-course">{courseLabel(course.name)}</span>
        <span className="pace-remaining">
          {p.remaining} assignment{p.remaining === 1 ? "" : "s"} left
        </span>
      </div>

      <div className="pace-controls">
        <input
          className="pace-slider"
          type="range"
          min="0.5"
          max="12"
          step="0.5"
          value={perWeek}
          onChange={(e) => setPerWeek(Number(e.target.value))}
          aria-label={`${courseLabel(course.name)} assignments per week`}
        />
        <span className="pace-rate">
          {perWeek}/wk
          {Math.abs(perWeek - observed) < 0.26 && (
            <span className="pace-actual"> · his current pace</span>
          )}
        </span>
      </div>

      <div className="pace-result">
        <CalendarClock size={13} />
        <span className="pace-finish">
          {p.complete ? "Already complete" : `Finishes ${formatDate(p.finishDate)}`}
        </span>
        <span className={`pace-verdict pace-verdict-${verdict.tone}`}>
          {verdict.label}
        </span>
      </div>
    </div>
  );
}

function MathAcademyRow({ course, xpRemaining }) {
  const [xpPerDay, setXpPerDay] = useState(120);
  const p = projectMathAcademy({ xpRemaining, xpPerDay });
  const verdict = p.complete
    ? { tone: "green", label: "Finished" }
    : verdictVsSemester(p.finishDate);

  return (
    <div className="pace-row">
      <div className="pace-row-head">
        <span className="pace-course">
          Math Academy{course?.name ? ` — ${course.name}` : ""}
        </span>
        <span className="pace-remaining">
          {xpRemaining.toLocaleString()} XP left
        </span>
      </div>

      <div className="pace-controls">
        <input
          className="pace-slider"
          type="range"
          min="20"
          max="300"
          step="10"
          value={xpPerDay}
          onChange={(e) => setXpPerDay(Number(e.target.value))}
          aria-label="Math Academy XP per day"
        />
        <span className="pace-rate">
          {xpPerDay} XP/day
          {xpPerDay === 120 && <span className="pace-actual"> · his daily goal</span>}
        </span>
      </div>

      <div className="pace-result">
        <CalendarClock size={13} />
        <span className="pace-finish">
          {p.complete ? "Already complete" : `Finishes ${formatDate(p.finishDate)}`}
        </span>
        <span className={`pace-verdict pace-verdict-${verdict.tone}`}>
          {verdict.label}
        </span>
      </div>
      <div className="pace-note">
        Assumes he works every day — skipping weekends stretches this by
        roughly a third.
      </div>
    </div>
  );
}
