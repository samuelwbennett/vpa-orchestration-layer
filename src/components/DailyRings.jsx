import React from "react";
import { Lock } from "lucide-react";

/**
 * DailyRings — one ring per app showing today's XP progress, in the
 * visual style of the math-facts / reading-facts apps:
 *   - bright stroke color
 *   - soft-tinted track underneath the progress arc
 *   - rounded stroke ends
 *
 * Hover any ring for a detail tooltip with today XP / goal, weekly XP,
 * status, and the "next lesson" copy from each app's adapter. The
 * tooltip is also exposed via focus-within for keyboard users.
 *
 * Props:
 *   apps: array of { id, name, dailyGoal, todayXP, weeklyXP, status,
 *                    nextLesson, league?, _notLinked? }
 */

// Per-app colors — see also --ring-math-* CSS variables. We read
// the variables here so theme changes only require touching CSS.
const APP_COLOR_VARS = {
  "math-facts":      "var(--ring-math-facts)",
  "math-academy":    "var(--ring-math-academy)",
  "reading-facts":   "var(--ring-reading-facts)",
  "reading-academy": "var(--ring-reading-academy)",
};

// Inline hex equivalents for the SVG track tint (we can't `rgba()`
// a CSS var directly without color-mix support). Keep in sync with
// the variable definitions above.
const APP_COLOR_HEX = {
  "math-facts":      "#fa3e3e",
  "math-academy":    "#3bc1f3",
  "reading-facts":   "#9aff00",
  "reading-academy": "#9c6cff",
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

  // Rest day: dailyGoal === 0 means there's nothing to fill toward
  // (e.g. Math Academy on a Sunday). Render an empty-track ring with
  // an em-dash inside; the tooltip explains via `nextLesson`.
  const restDay = !locked && app.dailyGoal === 0;

  const pct = locked || restDay
    ? 0
    : Math.max(0, Math.min(1, app.todayXP / app.dailyGoal));
  const offset = circumference * (1 - pct);

  const stroke1 = APP_COLOR_VARS[app.id] || "var(--blue)";
  const trackColor = locked
    ? "var(--ring-track)"
    : hexToRgba(APP_COLOR_HEX[app.id] || "#3bc1f3", 0.18);

  // Center label: percent for normal apps, em-dash on rest days,
  // "LOCKED" for coming_soon.
  let centerEl;
  if (locked) {
    centerEl = (
      <text
        className="ring-locked-text"
        x="50%" y="50%"
        dominantBaseline="middle" textAnchor="middle"
      >
        LOCKED
      </text>
    );
  } else if (restDay) {
    centerEl = (
      <text
        className="ring-rest-text"
        x="50%" y="50%"
        dominantBaseline="middle" textAnchor="middle"
      >
        —
      </text>
    );
  } else {
    centerEl = (
      <text
        className="ring-percent"
        x="50%" y="50%"
        dominantBaseline="middle" textAnchor="middle"
      >
        {Math.round(pct * 100)}%
      </text>
    );
  }

  return (
    <div
      className={`ring-tile ${locked ? "locked" : ""}`}
      tabIndex={locked ? -1 : 0}
      aria-label={ariaSummary(app, pct, restDay)}
    >
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
              fill="none" stroke={stroke1} strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          )}
        </g>
        {centerEl}
      </svg>

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
          {app.todayXP} {app.dailyGoal > 0 ? `/ ${app.dailyGoal}` : ""} XP
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
  return `${app.name}: ${Math.round(pct * 100)} percent of today's goal, ${app.todayXP} of ${app.dailyGoal} XP`;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
