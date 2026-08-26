import React from "react";
import { Timer, Square } from "lucide-react";
import {
  TIMED_APPS,
  formatClock,
  formatDuration,
} from "../services/sessions.js";

/**
 * SessionTimer — the focus-timer strip.
 *
 * Two states:
 *   ACTIVE — a timed app was launched from the dashboard: shows the
 *   app name, a live clock, and an End button. The clock survives
 *   refresh (localStorage) and auto-stops at the 3h safety cap.
 *
 *   IDLE — shows today's recorded learning time per app, so "how
 *   long has he actually worked today" is answerable at a glance.
 *
 * Honesty note (also in the hook): this measures time near the
 * work. The completion/XP numbers next to it are what keep it real.
 */
export default function SessionTimer({ timer }) {
  const { active, elapsed, today, stop } = timer;

  if (active) {
    return (
      <div className="card timer-card active">
        <div className="timer-live">
          <span className="timer-pulse" aria-hidden="true" />
          <div className="timer-live-text">
            <div className="timer-app">
              {TIMED_APPS[active.appId] || active.appId} session
            </div>
            <div className="timer-clock" aria-live="off">
              {formatClock(elapsed)}
            </div>
          </div>
          <button type="button" className="btn-secondary timer-stop" onClick={stop}>
            <Square size={13} /> End session
          </button>
        </div>
        <div className="timer-hint">
          Clock keeps running through refreshes — end it when you're done.
        </div>
      </div>
    );
  }

  const apps = Object.keys(TIMED_APPS).filter((id) => today.byApp[id] > 0);

  return (
    <div className="card timer-card">
      <div className="timer-idle">
        <span className="timer-idle-icon">
          <Timer size={16} />
        </span>
        {today.total > 0 ? (
          <div className="timer-idle-text">
            <strong>{formatDuration(today.total)}</strong> of focused work
            today
            {apps.length > 0 && (
              <span className="timer-breakdown">
                {" — "}
                {apps
                  .map(
                    (id) =>
                      `${TIMED_APPS[id]} ${formatDuration(today.byApp[id])}`
                  )
                  .join(" · ")}
              </span>
            )}
          </div>
        ) : (
          <div className="timer-idle-text muted">
            No sessions yet today — launching ASU Prep or Math Academy
            starts the clock.
          </div>
        )}
      </div>
    </div>
  );
}
