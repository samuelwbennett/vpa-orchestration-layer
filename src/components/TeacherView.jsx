import React, { useState } from "react";
import { RefreshCw, LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { useTeacherRoster } from "../hooks/useTeacherRoster.js";
import { summarize, priority, appStatusLabel } from "../utils/onTrack.js";

/**
 * TeacherView — the teacher experience for the VPA Learning OS.
 *
 * Three things, in priority order:
 *   1. "Who needs you today" — the intervention queue.
 *   2. "Your students" — the full roster; each row expands to a
 *      per-app drill-down.
 *   3. A header with refresh + sign out.
 *
 * Runs live: the roster is RLS-scoped to this teacher, and each
 * student's status is fanned out through the same orchestrator the
 * student dashboard uses — so a student's pace reads the same to
 * them and to their teacher.
 */
export default function TeacherView({ profile, signOut }) {
  const { classes, students, loading, error, lastUpdated, refresh } =
    useTeacherRoster();
  const [expandedKey, setExpandedKey] = useState(null);

  const teacherName = (profile && profile.display_name) || "there";

  const summaries = students.map((s) => ({
    student: s,
    summary: summarize(s.apps),
  }));

  const queue = summaries
    .filter((x) => priority(x.summary) < 3)
    .sort(
      (a, b) =>
        priority(a.summary) - priority(b.summary) ||
        a.summary.onTrack.pct - b.summary.onTrack.pct
    );

  function openRow(rowKey) {
    setExpandedKey(rowKey);
    setTimeout(() => {
      const el = document.getElementById(`roster-${cssId(rowKey)}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-left">
          <div className="eyebrow">{todayLabel()} · Teacher Dashboard</div>
          <h1>
            Good {greeting()}, {teacherName}.
          </h1>
        </div>
        <div className="header-right">
          <button
            className="refresh-btn"
            onClick={refresh}
            disabled={loading}
            title="Refresh roster data"
          >
            <RefreshCw size={13} className={loading ? "spinning" : ""} />
            {lastUpdated ? `Updated ${formatAgo(lastUpdated)}` : "Refresh"}
          </button>
          <button
            className="refresh-btn"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {error && (
        <div className="section">
          <div className="card" style={{ color: "var(--red)" }}>
            Couldn't load your roster.{" "}
            {error.message ? `(${error.message})` : ""}
          </div>
        </div>
      )}

      {loading && students.length === 0 && (
        <div className="section">
          <div className="card" style={{ color: "var(--text-muted)" }}>
            Loading your roster…
          </div>
        </div>
      )}

      {!loading && !error && classes.length === 0 && (
        <div className="section">
          <div className="card teacher-empty">
            <h3>No classes assigned yet</h3>
            <p>
              Once your classes are set up, your roster and the students who
              need you today will appear here.
            </p>
          </div>
        </div>
      )}

      {classes.length > 0 && (
        <>
          {/* 1. Who needs you today */}
          <section className="section">
            <h2 className="section-title">Who needs you today</h2>
            <div className="card">
              {queue.length === 0 ? (
                <div className="teacher-allclear">
                  Everyone's on pace today. Nice.
                </div>
              ) : (
                <div className="queue-list">
                  {queue.map(({ student, summary }) => (
                    <button
                      key={student.rowKey}
                      className="queue-item"
                      onClick={() => openRow(student.rowKey)}
                    >
                      <span className={`on-track ${summary.onTrack.status}`}>
                        <span className="dot" />
                        {summary.onTrack.label}
                      </span>
                      <span className="queue-name">{student.name}</span>
                      <span className="queue-reason">{summary.reason}</span>
                      {summary.lagging.length > 0 && (
                        <span className="queue-lagging">
                          {summary.lagging.map((a) => a.name).join(" · ")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 2. Your students */}
          <section className="section">
            <h2 className="section-title">
              Your students ({summaries.length})
            </h2>
            <div className="card teacher-roster">
              {summaries.map(({ student, summary }) => {
                const open = expandedKey === student.rowKey;
                return (
                  <div
                    key={student.rowKey}
                    className="roster-row"
                    id={`roster-${cssId(student.rowKey)}`}
                  >
                    <button
                      className="roster-row-main"
                      onClick={() =>
                        setExpandedKey(open ? null : student.rowKey)
                      }
                    >
                      {open ? (
                        <ChevronDown size={15} className="roster-chevron" />
                      ) : (
                        <ChevronRight size={15} className="roster-chevron" />
                      )}
                      <span className="roster-name">{student.name}</span>
                      <span className="roster-class">
                        {student.className}
                      </span>
                      <span className="app-dots">
                        {(student.apps || []).map((a) => (
                          <span
                            key={a.id}
                            className={`app-dot ${a.status}`}
                            title={`${a.name}: ${appStatusLabel(a)}`}
                          />
                        ))}
                      </span>
                      <span className={`on-track ${summary.onTrack.status}`}>
                        <span className="dot" />
                        {summary.onTrack.label}
                      </span>
                    </button>

                    {open && (
                      <div className="roster-drill">
                        {(student.apps || []).length === 0 && (
                          <div className="drill-empty">
                            No app data available for this student yet.
                          </div>
                        )}
                        {(student.apps || []).map((a) => (
                          <div key={a.id} className="drill-app">
                            <div className="drill-app-top">
                              <span className="drill-app-name">{a.name}</span>
                              <span className={`status-pill ${a.status}`}>
                                {a.status.replace("_", " ")}
                              </span>
                            </div>
                            <div className="drill-app-xp">
                              <span>
                                <strong>{a.todayXP}</strong>
                                {a.dailyGoal ? ` / ${a.dailyGoal}` : ""} XP
                                today
                              </span>
                              <span className="muted">
                                {a.weeklyXP} XP this week
                              </span>
                            </div>
                            {a.nextLesson && (
                              <div className="drill-app-next">
                                Next: {a.nextLesson}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ---- helpers ----

// Make a rowKey ("classId:studentId") safe for a DOM id.
function cssId(rowKey) {
  return rowKey.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function formatAgo(date) {
  const seconds = Math.max(
    0,
    Math.round((Date.now() - date.getTime()) / 1000)
  );
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}
