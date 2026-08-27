import React from "react";
import { ExternalLink, MessageCircle } from "lucide-react";
import { courseLabel } from "../services/talkPrompts.js";

/**
 * ParentCourses — grades, pace and what he's actually working on,
 * one row per ASU Prep course, plus the Math Academy course line.
 *
 * Deliberately shows the assignment NAMES he has coming up rather
 * than only counts: "Argument Essay Draft" is something a parent can
 * ask about at dinner; "8% complete" isn't.
 */
export default function ParentCourses({ courses, knowledge, loading, degraded }) {
  if (loading) {
    return (
      <div className="card" style={{ color: "var(--text-muted)" }}>
        Loading courses…
      </div>
    );
  }
  if (degraded || (courses || []).length === 0) {
    return (
      <div className="card" style={{ color: "var(--text-muted)" }}>
        Couldn't reach Canvas just now — course details will reappear on the
        next refresh.
      </div>
    );
  }

  const ma = (knowledge || []).find((k) => k && k.course) || null;

  return (
    <div className="card pcourse-card">
      {ma && <MathAcademyRow app={ma} />}
      {courses.map((c) => (
        <CourseRow key={c.id} course={c} />
      ))}
    </div>
  );
}

function MathAcademyRow({ app }) {
  const pct = Number.isFinite(app.course?.percentComplete)
    ? app.course.percentComplete
    : null;
  const learning = (app.topics || [])
    .filter((t) => t.state === "learning" && t.name)
    .slice(0, 3);

  return (
    <div className="pcourse-row">
      <div className="pcourse-head">
        <span className="pcourse-name">
          Math Academy — {app.course?.name || "Course"}
        </span>
        <div className="pcourse-meta">
          {app.course?.letterGrade && (
            <span className="pcourse-grade">{app.course.letterGrade}</span>
          )}
          {Number.isFinite(app.course?.xpRemaining) && (
            <span className="pcourse-sub">
              {app.course.xpRemaining.toLocaleString()} XP left
            </span>
          )}
        </div>
      </div>

      {pct !== null && (
        <div className="pcourse-bar-line">
          <span className="pcourse-track" aria-hidden="true">
            <span
              className="pcourse-fill ma"
              style={{ width: `${Math.max(1, Math.min(100, pct))}%` }}
            />
          </span>
          <span className="pcourse-pct">{Math.round(pct)}%</span>
        </div>
      )}

      {learning.length > 0 && (
        <div className="pcourse-topics">
          <span className="pcourse-topics-label">Working on now</span>
          {learning.map((t) => (
            <span key={t.name} className="pcourse-topic">
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CourseRow({ course }) {
  const pct = Number.isFinite(course.completionPct) ? course.completionPct : null;
  const next = course.nextAssignments || [];

  return (
    <div className="pcourse-row">
      <div className="pcourse-head">
        {course.htmlUrl ? (
          <a
            className="pcourse-name link"
            href={course.htmlUrl}
            target="_blank"
            rel="noreferrer"
          >
            {courseLabel(course.name)} <ExternalLink size={11} />
          </a>
        ) : (
          <span className="pcourse-name">{courseLabel(course.name)}</span>
        )}
        <div className="pcourse-meta">
          <span className="pcourse-sub">
            {course.assignmentsSubmitted} of {course.assignmentsTotal} assignments
          </span>
          {course.currentGrade && (
            <span
              className="pcourse-grade"
              title={
                course.currentScore != null
                  ? `${course.currentGrade} · ${course.currentScore}%`
                  : course.currentGrade
              }
            >
              {course.currentGrade}
            </span>
          )}
          <PaceChip days={course.paceDeltaDays} />
        </div>
      </div>

      {pct !== null && (
        <div className="pcourse-bar-line">
          <span className="pcourse-track" aria-hidden="true">
            <span
              className="pcourse-fill"
              style={{ width: `${Math.max(1, Math.min(100, pct))}%` }}
            />
            {Number.isFinite(course.expectedPct) && (
              <span
                className="pcourse-expected"
                style={{ left: `${Math.max(0, Math.min(100, course.expectedPct))}%` }}
                title={`Expected by today: ${Math.round(course.expectedPct)}%`}
              />
            )}
          </span>
          <span className="pcourse-pct">{Math.round(pct)}%</span>
        </div>
      )}

      {next.length > 0 && (
        <div className="pcourse-topics">
          <span className="pcourse-topics-label">Next up</span>
          {next.map((a) => (
            <span key={a.id} className="pcourse-topic">
              {a.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PaceChip({ days }) {
  if (!Number.isFinite(days)) return null;
  let cls = "onpace";
  let label = "On pace";
  if (days > 3) {
    cls = "ahead";
    label = `${days}d ahead`;
  } else if (days < -3) {
    cls = days <= -7 ? "farbehind" : "behind";
    label = `${Math.abs(days)}d behind`;
  }
  return <span className={`asu-pace asu-pace-${cls}`}>{label}</span>;
}

/** The "Talk with Jackson about ___" list. */
export function TalkPrompts({ prompts }) {
  if (!prompts || prompts.length === 0) return null;
  return (
    <div className="card talk-card">
      {prompts.map((p) => (
        <div key={p.id} className={`talk-row talk-${p.tone}`}>
          <MessageCircle size={15} className="talk-icon" />
          <div>
            <div className="talk-prompt">{p.prompt}</div>
            <div className="talk-why">{p.why}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
