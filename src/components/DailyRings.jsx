import React from "react";
import { Lock } from "lucide-react";

/**
 * DailyRings — one ring per app showing today's XP toward the daily
 * goal. Apple-aesthetic: iOS system colors, soft-tinted tracks behind
 * the progress arc, rounded stroke ends, calm typography.
 *
 * Center of each ring shows TODAY'S XP as the headline number, with
 * "of N XP" beneath it. Hover/focus reveals a tooltip with weekly XP,
 * status, league info, and the next-lesson copy from each adapter.
 *
 * Props:
 *   apps: array of { id, name, dailyGoal, todayXP, weeklyXP, status,
 *                    nextLesson, league?, _notLinked? }
 */

// Ring stroke color is read from the CSS variable so theme changes
// only require touching CSS. Track tint is computed from a hex copy
// of the same hue (we can't `rgba()` a CSS var without color-mix).
const APP_COLOR_VAR = {
  "math-facts":      "var(--ring-math-facts)",
  "math-academy":    "var(--ring-math-academy)",
  "reading-facts":   "var(--ring-reading-facts)",
  "reading-academy": "var(--ring-reading-academy)",
};

const APP_COLOR_HEX = {
  "math-facts":      "#ff453a",
  "math-academy":    "#0a84ff",
  "reading-facts":   "#30d158",
  "reading-academy": "#bf5af2",
};

export default function DailyRings({ apps }) {
  return (
    <div className="rings-row">
      {apps.map((app) => (
        <Ring key={app.id} app={app} />
      ))}
    </div>
  );
}

function Ring({ app }) {
  const locked = app.status === "coming_soon";
  const size = 132;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Rest day: dailyGoal === 0 (e.g. Math Academy on a configured rest
  // day if that case ever sneaks through). Render a dash, no progress.
  const restDay = !locked && app.dailyGoal === 0;

  const pct = locked || restDay
    ? 0
    : Math.max(0, Math.min(1, app.todayXP / app.dailyGoal));
  const offset = circumference * (1 - pct);

  const strokeColor = APP_COLOR_VAR[app.id] || "var(--blue)";
  const trackColor = locked
    ? "var(--ring-track)"
    : hexToRgba(APP_COLOR_HEX[app.id] || "#0a84ff", 0.18);

  return (
    <div
      className={`ring-tile ${locked ? "locked" : ""}`}
      tabIndex={locked ? -1 : 0}
      aria-label={ariaSummary(app, pct, restDay)}
    >
      <div className="ring-svg-wrap" style={{ width: size, height: size }}>
        <svg
          className="ring-svg"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={trackColor} strokeWidth={stroke}
            />
            {!locked && !restDay && (
              <circle
                cx={size / 2} cy={size / 2} r={radius}
                fill="none" stroke={strokeColor} strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            )}
          </g>
        </svg>

        <div className="ring-center">
          {locked ? (
            <div className="ring-center-locked">LOCKED</div>
          ) : restDay ? (
            <>
              <div className="ring-xp">—</div>
              <div className="ring-xp-sub">Rest day</div>
            </>
          ) : (
            <>
              <div className="ring-xp">{app.todayXP}</div>
              <div className="ring-xp-sub">of {app.dailyGoal} XP</div>
            </>
          )}
        </div>
      </div>

      <div className="ring-name">
        {locked && <Lock size={12} className="ring-name-lock" />}
        {app.name}
      </div>

      {!locked && <RingTooltip app={app} pct={pct} restDay={restDay} />}
    </div>
  );
}

function RingTooltip({ app, pct, restDay }) {
  return (
    <div className="ring-tooltip" role="tooltip">
      <div className="ring-tooltip-row main">
        {restDay
          ? <span>Rest day</span>
          : <span>{Math.round(pct * 100)}% of today's goal</span>}
      </div>
      <div className="ring-tooltip-row">
        <span className="muted">Today</span>
        <span>
          {app.todayXP}{app.dailyGoal > 0 ? ` / ${app.dailyGoal}` : ""} XP
        </span>
      </div>
      <div className="ring-tooltip-row">
        <span className="muted">This week</span>
        <span>{app.weeklyXP} XP</span>
      </div>
      <div className="ring-tooltip-row">
        <span className="muted">Status</span>
        <span>{statusText(app.status)}</span>
      </div>
      {app.league ? (
        <div className="ring-tooltip-row">
          <span className="muted">League</span>
          <span>{app.league.name} · L{app.league.level}</span>
        </div>
      ) : null}
      {app.nextLesson && (
        <div className="ring-tooltip-next">{app.nextLesson}</div>
      )}
    </div>
  );
}

function statusText(s) {
  if (s === "complete") return "Complete";
  if (s === "in_progress") return "In progress";
  if (s === "ready") return "Ready";
  return s;
}

function ariaSummary(app, pct, restDay) {
  if (restDay) return `${app.name}: rest day`;
  return `${app.name}: ${app.todayXP} of ${app.dailyGoal} XP, ${Math.round(pct * 100)} percent`;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
