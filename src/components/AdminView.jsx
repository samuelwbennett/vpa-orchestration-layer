import React, { useState } from "react";
import { RefreshCw, LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { useAdminOverview } from "../hooks/useAdminOverview.js";
import { summarize, priority, appStatusLabel } from "../utils/onTrack.js";
import RegistrationPanel from "./RegistrationPanel.jsx";

const QUEUE_DISPLAY_LIMIT = 10;

/**
 * AdminView — the admin experience for the VPA Learning OS.
 *
 * Org-scoped via RLS (see migrations/0009): an admin sees every
 * class, teacher, student, and profile in their organization. The
 * page is built to answer the only two questions an admin really
 * has on a given day:
 *
 *   1. Is the program working? — "Program at a glance" stats
 *   2. Who is falling behind? — the cross-org intervention queue
 *
 * Then a navigable list of classes, teachers, and a full org
 * roster with the same per-student drill-down as the teacher view.
 */
export default function AdminView({ profile, signOut }) {
  const { classes, teachers, students, loading, error, lastUpdated, refresh } =
    useAdminOverview();
  const [expandedKey, setExpandedKey] = useState(null);

  const adminName = (profile && profile.display_name) || "there";

  // The hook returns one row per (class, student). For admin counts +
  // the intervention queue + the All Students roster we want one row
  // PER STUDENT — with all the classes they're in folded together.
  // (The per-(class,student) shape is preserved in the raw `students`
  // array for any future view that wants it.)
  const uniqueStudents = (() => {
    const byId = new Map();
    for (const s of students) {
      const existing = byId.get(s.id);
      const classEntry = {
        classId: s.classId,
        className: s.className,
        teacherName: s.teacherName,
        rowKey: s.rowKey,
      };
      if (existing) {
        existing.classes.push(classEntry);
      } else {
        byId.set(s.id, {
          ...s,
          // Anchor rowKey is the first one we saw — used for expand state.
          rowKey: s.rowKey,
          classes: [classEntry],
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  })();

  const summaries = uniqueStudents.map((s) => ({
    student: s,
    summary: summarize(s.apps),
  }));

  const totalStudents = uniqueStudents.length;
  const totalClasses = classes.length;
  const totalTeachers = teachers.filter((t) => t.role === "teacher").length;
  const needsAttention = summaries.filter(
    (x) => priority(x.summary) < 3
  ).length;

  const queueAll = summaries
    .filter((x) => priority(x.summary) < 3)
    .sort(
      (a, b) =>
        priority(a.summary) - priority(b.summary) ||
        a.summary.onTrack.pct - b.summary.onTrack.pct
    );
  const queueShown = queueAll.slice(0, QUEUE_DISPLAY_LIMIT);
  const queueOverflow = Math.max(0, queueAll.length - QUEUE_DISPLAY_LIMIT);

  function openRow(rowKey) {
    setExpandedKey(rowKey);
    setTimeout(() => {
      const el = document.getElementById(`adminroster-${cssId(rowKey)}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  const emptyOrg =
    !loading && !error && classes.length === 0 && teachers.length === 0;

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-left">
          <div className="eyebrow">{todayLabel()} · Admin Dashboard</div>
          <h1>
            Good {greeting()}, {adminName}.
          </h1>
        </div>
        <div className="header-right">
          <button
            className="refresh-btn"
            onClick={refresh}
            disabled={loading}
            title="Refresh program data"
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
            Couldn't load program data.{" "}
            {error.message ? `(${error.message})` : ""}
          </div>
        </div>
      )}

      {loading && students.length === 0 && classes.length === 0 && (
        <div className="section">
          <div className="card" style={{ color: "var(--text-muted)" }}>
            Loading program overview…
          </div>
        </div>
      )}

      {emptyOrg && (
        <div className="section">
          <div className="card teacher-empty">
            <h3>No classes set up yet</h3>
            <p>
              Once teachers create classes and assign students, your program
              overview appears here.
            </p>
          </div>
        </div>
      )}

      {(classes.length > 0 || teachers.length > 0) && (
        <>
          {/* Program at a glance */}
          <section className="section">
            <h2 className="section-title">Program at a glance</h2>
            <div className="admin-stats">
              <div className="stat">
                <div className="label">Students</div>
                <div className="value">{totalStudents}</div>
              </div>
              <div className="stat">
                <div className="label">Classes</div>
                <div className="value">{totalClasses}</div>
              </div>
              <div className="stat">
                <div className="label">Teachers</div>
                <div className="value">{totalTeachers}</div>
              </div>
              <div
                className={`stat ${needsAttention > 0 ? "stat-warn" : ""}`}
              >
                <div className="label">Needs attention today</div>
                <div className="value">{needsAttention}</div>
              </div>
            </div>
          </section>

          {/* Intervention queue */}
          <section className="section">
            <h2 className="section-title">Who needs attention today</h2>
            <div className="card">
              {queueAll.length === 0 ? (
                <div className="teacher-allclear">
                  Everyone in the program is on pace today.
                </div>
              ) : (
                <>
                  <div className="queue-list">
                    {queueShown.map(({ student, summary }) => (
                      <button
                        key={student.rowKey}
                        className="queue-item"
                        onClick={() => openRow(student.rowKey)}
                      >
                        <span
                          className={`on-track ${summary.onTrack.status}`}
                        >
                          <span className="dot" />
                          {summary.onTrack.label}
                        </span>
                        <span className="queue-name">{student.name}</span>
                        <span className="queue-reason">
                          {classLabel(student.classes)} · {summary.reason}
                        </span>
                        {summary.lagging.length > 0 && (
                          <span className="queue-lagging">
                            {summary.lagging.map((a) => a.name).join(" · ")}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {queueOverflow > 0 && (
                    <div className="queue-overflow">
                      + {queueOverflow} more — scroll the roster below to see
                      everyone.
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Classes */}
          {classes.length > 0 && (
            <section className="section">
              <h2 className="section-title">Classes ({classes.length})</h2>
              <div className="card admin-list">
                {classes.map((c) => (
                  <div key={c.id} className="admin-row">
                    <span className="admin-row-name">{c.name}</span>
                    <span className="admin-row-meta">
                      {c.teacherName}
                      {c.gradeLevel ? ` · grade ${c.gradeLevel}` : ""}
                    </span>
                    <span className="admin-row-stat">
                      {c.studentCount}{" "}
                      {c.studentCount === 1 ? "student" : "students"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Staff — teachers + admins, since both appear in this list */}
          {teachers.length > 0 && (
            <section className="section">
              <h2 className="section-title">
                Staff ({teachers.length})
              </h2>
              <div className="card admin-list">
                {teachers.map((t) => (
                  <div key={t.authUserId} className="admin-row">
                    <span className="admin-row-name">{t.name}</span>
                    <span className="admin-row-meta">
                      {t.role === "admin" ? "Admin" : "Teacher"}
                    </span>
                    <span className="admin-row-stat">
                      {t.classCount}{" "}
                      {t.classCount === 1 ? "class" : "classes"} ·{" "}
                      {t.studentCount}{" "}
                      {t.studentCount === 1 ? "student" : "students"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* All students — count unique students, not (class × student) rows */}
          {students.length > 0 && (
            <section className="section">
              <h2 className="section-title">
                All students ({totalStudents})
              </h2>
              <div className="card teacher-roster">
                {summaries.map(({ student, summary }) => {
                  const open = expandedKey === student.rowKey;
                  return (
                    <div
                      key={student.rowKey}
                      className="roster-row"
                      id={`adminroster-${cssId(student.rowKey)}`}
                    >
                      <button
                        className="roster-row-main"
                        onClick={() =>
                          setExpandedKey(open ? null : student.rowKey)
                        }
                      >
                        {open ? (
                          <ChevronDown
                            size={15}
                            className="roster-chevron"
                          />
                        ) : (
                          <ChevronRight
                            size={15}
                            className="roster-chevron"
                          />
                        )}
                        <span className="roster-name">{student.name}</span>
                        <span className="roster-class">
                          {classLabel(student.classes)}
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
                        <span
                          className={`on-track ${summary.onTrack.status}`}
                        >
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
                                <span className="drill-app-name">
                                  {a.name}
                                </span>
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
          )}

          <RegistrationPanel
            classes={classes}
            teachers={teachers}
            onSuccess={refresh}
          />
        </>
      )}
    </div>
  );
}

// ---- helpers ----

// Render a single readable label for a student's class memberships:
//   1 class  → "Class · Teacher"
//   2 classes → "Class A · Class B"
//   3+ classes → "Class A · Class B · +N more"
function classLabel(classes) {
  if (!classes || classes.length === 0) return "Class";
  if (classes.length === 1) {
    const c = classes[0];
    return c.teacherName ? `${c.className} · ${c.teacherName}` : c.className;
  }
  const names = classes.map((c) => c.className);
  if (names.length <= 2) return names.join(" · ");
  return `${names[0]} · ${names[1]} · +${names.length - 2} more`;
}

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
