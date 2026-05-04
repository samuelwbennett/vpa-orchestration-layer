import React from "react";
import { Lock } from "lucide-react";

/**
 * DailyRings — 4 SVG progress rings, one per app.
 * Reading Academy is shown locked / "Coming Soon".
 *
 * Props:
 *   apps: array of { id, name, dailyGoal, todayXP, status }
 */

const RING_COLORS = {
  "math-academy": "var(--ring-math-academy)",
  "math-facts": "var(--ring-math-facts)",
  "reading-facts": "var(--ring-reading-facts)",
  "reading-academy": "var(--ring-reading-academy)"
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
  const size = 116;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const pct = locked
    ? 0
    : Math.min(1, app.dailyGoal === 0 ? 0 : app.todayXP / app.dailyGoal);
  const offset = circumference * (1 - pct);

  return (
    <div className={`ring-tile ${locked ? "locked" : ""}`}>
      <svg
        className="ring-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="ring-track-circle"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
        />
        {!locked && (
          <circle
            className="ring-progress-circle"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            stroke={RING_COLORS[app.id] || "var(--blue)"}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        )}
        <g transform={`rotate(90 ${size / 2} ${size / 2})`}>
          {locked ? (
            <text
              className="ring-locked-text"
              x="50%"
              y="50%"
              dominantBaseline="middle"
              textAnchor="middle"
            >
              LOCKED
            </text>
          ) : (
            <text
              className="ring-percent"
              x="50%"
              y="50%"
              dominantBaseline="middle"
              textAnchor="middle"
            >
              {Math.round(pct * 100)}%
            </text>
          )}
        </g>
      </svg>

      <div className="label">
        {locked && (
          <Lock size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
        )}
        {app.name}
      </div>
      <div className="value">
        {locked
          ? "Coming Soon"
          : `${app.todayXP} / ${app.dailyGoal} XP`}
      </div>
    </div>
  );
}
