import React from "react";
import { ExternalLink, Lock } from "lucide-react";
import { launchApp } from "../utils/launch.js";

/**
 * AppCard — one card per app.
 * Launch button calls the shared launchApp() helper so the same
 * deep-link behavior happens everywhere.
 */
export default function AppCard({ app }) {
  const locked = app.status === "coming_soon";

  return (
    <div className={`app-card ${locked ? "locked" : ""}`}>
      <div className="top">
        <h3>{app.name}</h3>
        <span className={`status-pill ${app.status}`}>
          {statusLabel(app.status)}
        </span>
      </div>

      {app.league ? (
        <div className="league-badge" title={leagueTitle(app.league)}>
          <span className={`league-dot league-${slug(app.league.name)}`} />
          {app.league.name} · Level {app.league.level}
          {typeof app.league.position === "number" &&
           typeof app.league.participants === "number" && (
            <span className="league-rank">
              · #{app.league.position}/{app.league.participants}
            </span>
          )}
        </div>
      ) : null}

      {!locked ? (
        <>
          <div className="xp-row">
            <div>
              <span className="num">{app.todayXP}</span>
              Today's XP
            </div>
            <div>
              <span className="num">{app.weeklyXP}</span>
              Weekly XP
            </div>
            <div>
              <span className="num">{app.dailyGoal}</span>
              Daily goal
            </div>
          </div>

          <div className="suggested">{suggestedAction(app)}</div>

          <div className="actions">
            <button
              className="btn-secondary"
              onClick={() => launchApp(app.link)}
            >
              {app.nextLesson ? `Open: ${truncate(app.nextLesson, 28)}` : "Launch"}
              <ExternalLink size={13} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="suggested">
            This app will be available in a future release.
          </div>
          <div className="actions">
            <button className="btn-secondary" disabled>
              <Lock size={13} /> Coming Soon
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function statusLabel(status) {
  switch (status) {
    case "ready": return "Ready";
    case "in_progress": return "In Progress";
    case "complete": return "Complete";
    case "coming_soon": return "Coming Soon";
    default: return status;
  }
}

function suggestedAction(app) {
  if (app.status === "complete") return "Daily goal complete. Optional bonus XP available.";
  if (app.todayXP === 0) return `Start your ${app.dailyGoal} XP daily goal.`;
  const remaining = app.dailyGoal - app.todayXP;
  return `${remaining} XP left to finish today.`;
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

// Lower-case, hyphenated slug for the league CSS class hook.
function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// Human-readable tooltip for the league badge.
function leagueTitle(league) {
  const parts = [`${league.name} League`, `Level ${league.level}`];
  if (typeof league.position === "number" &&
      typeof league.participants === "number") {
    parts.push(`Ranked ${league.position} of ${league.participants}`);
  }
  return parts.join(" • ");
}
