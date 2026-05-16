import React, { useState } from "react";
import { RefreshCw, LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { useParentChildren } from "../hooks/useParentChildren.js";
import { summarize } from "../utils/onTrack.js";

/**
 * ParentView — the family-facing experience for the VPA Learning OS.
 *
 * One card per child, scoped to whoever's linked via guardian_students:
 * name, today's pace (in warm/encouraging language), today's wins, and
 * an expandable per-app drill-down. Read-only by design.
 */
export default function ParentView({ profile, signOut }) {
  const { children, loading, error, lastUpdated, refresh } =
    useParentChildren();
  const [expandedId, setExpandedId] = useState(null);

  const parentName = (profile && profile.display_name) || "there";

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-left">
          <div className="eyebrow">{todayLabel()} · Family Dashboard</div>
          <h1>
            Good {greeting()}, {parentName}.
          </h1>
        </div>
        <div className="header-right">
          <button
            className="refresh-btn"
            onClick={refresh}
            disabled={loading}
            title="Refresh"
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
            Couldn't load your family overview.{" "}
            {error.message ? `(${error.message})` : ""}
          </div>
        </div>
      )}

      {loading && children.length === 0 && (
        <div className="section">
          <div className="card" style={{ color: "var(--text-muted)" }}>
            Loading your family overview…
          </div>
        </div>
      )}

      {!loading && !error && children.length === 0 && (
        <div className="section">
          <div className="card teacher-empty">
            <h3>No children linked yet</h3>
            <p>
              Once your child's account is linked to yours, their progress
              will appear here. Reach out to your school admin to get
              connected.
            </p>
          </div>
        </div>
      )}

      {children.map((child) => {
        const summary = summarize(child.apps);
        const active = (child.apps || []).filter(
          (a) => a.status !== "coming_soon" && a.dailyGoal > 0
        );
        const wins = active.filter((a) => a.todayXP >= a.dailyGoal);
        const open = expandedId === child.id;

        return (
          <section className="section" key={child.id}>
            <div className="card parent-child">
              <div className="parent-child-head">
                <h2 className="parent-child-name">{child.name}</h2>
                <span className={`on-track ${summary.onTrack.status}`}>
                  <span className="dot" />
                  {parentTone(summary.onTrack.status)}
                </span>
              </div>

              <div className="parent-child-pace">
                {parentPace(summary, active.length)}
              </div>

              {wins.length > 0 && (
                <div className="parent-wins">
                  <div className="parent-wins-label">Today's wins</div>
                  <ul className="parent-wins-list">
                    {wins.map((a) => (
                      <li key={a.id}>{a.name} — goal met</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                className="parent-toggle"
                onClick={() => setExpandedId(open ? null : child.id)}
              >
                {open ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                {open ? "Hide per-app details" : "See per-app details"}
              </button>

              {open && (
                <div className="parent-drill">
                  {(child.apps || []).length === 0 && (
                    <div className="drill-empty">
                      No app data available for {child.name} yet.
                    </div>
                  )}
                  {(child.apps || []).map((a) => (
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
                          {a.dailyGoal ? ` / ${a.dailyGoal}` : ""} XP today
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
          </section>
        );
      })}
    </div>
  );
}

// ---- helpers ----

// Warmer labels than the teacher/admin "Needs Attention" framing —
// kids are kids, parents don't need an alarm bell.
function parentTone(status) {
  if (status === "green") return "On Track";
  if (status === "yellow") return "Building up";
  return "Just getting started";
}

function parentPace(summary, activeCount) {
  if (activeCount === 0) return "Nothing scheduled today.";
  if (summary.noXp) return "Hasn't started today yet.";
  return `${summary.met} of ${activeCount} ${
    activeCount === 1 ? "goal" : "goals"
  } met today.`;
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
