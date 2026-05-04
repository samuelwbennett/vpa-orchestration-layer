import React from "react";

/**
 * DailyRings — composite three-ring view of today's progress.
 *
 * Matches the look of the rings inside math-facts and reading-facts:
 *   Outer  ring — Effort   (red)   — XP earned today / today's combined goal
 *   Middle ring — Accuracy (green) — % of active apps at-or-above goal today
 *   Inner  ring — Weekly   (blue)  — XP earned this week / 7× daily goal
 *
 * Rings show a soft-tinted track behind the progress arc (matches the
 * apps' look). coming_soon apps and apps with dailyGoal === 0 (e.g.
 * Math Academy on a rest day) are excluded from the aggregation.
 */

// Colors lifted verbatim from reading-facts-app/src/app.js so the
// dashboard and the apps share an identity.
const COLORS = {
  effort:   "#fa3e3e",
  accuracy: "#9aff00",
  weekly:   "#3bc1f3",
};

export default function DailyRings({ apps }) {
  const active = apps.filter(
    (a) => a.status !== "coming_soon" && a.dailyGoal > 0
  );

  // Effort: today's XP toward goal, capped per-app so over-achievement
  // on one app doesn't mask a zero on another.
  const todayXP = active.reduce(
    (s, a) => s + Math.min(a.todayXP, a.dailyGoal), 0
  );
  const todayGoal = active.reduce((s, a) => s + a.dailyGoal, 0);

  // Accuracy proxy: how many active apps reached their daily goal today.
  // It's not "answer accuracy" (which the dashboard doesn't have access
  // to) — but it answers "how completely did you cover your plan?".
  const onTarget = active.filter((a) => a.todayXP >= a.dailyGoal).length;

  // Weekly: rolling 7-day XP vs. 7× the active daily goals.
  const weekXP   = active.reduce((s, a) => s + (a.weeklyXP || 0), 0);
  const weekGoal = active.reduce((s, a) => s + 7 * a.dailyGoal, 0);

  const effort   = todayGoal > 0 ? todayXP   / todayGoal : 0;
  const accuracy = active.length > 0 ? onTarget / active.length : 0;
  const weekly   = weekGoal > 0 ? weekXP / weekGoal : 0;

  // Big number in the center: actual XP earned today (uncapped, so the
  // student can see when they over-shot).
  const totalToday = active.reduce((s, a) => s + a.todayXP, 0);

  return (
    <div className="daily-rings-wrap">
      <div className="daily-rings-svg-wrap">
        <RingsSvg effort={effort} accuracy={accuracy} weekly={weekly} />
        <div className="daily-rings-center">
          <div className="daily-rings-xp">{totalToday}</div>
          <div className="daily-rings-sub">of {todayGoal} XP</div>
        </div>
      </div>

      <div className="daily-rings-legend">
        <span className="legend-item">
          <span className="dot" style={{ background: COLORS.effort }} />
          Effort
        </span>
        <span className="legend-item">
          <span className="dot" style={{ background: COLORS.accuracy }} />
          Accuracy
        </span>
        <span className="legend-item">
          <span className="dot" style={{ background: COLORS.weekly }} />
          Weekly XP
        </span>
      </div>
    </div>
  );
}

// Three concentric arcs at decreasing radii, each with a soft-tinted
// track behind it. Direct port of ringsSvg() from reading-facts-app
// so the visual identity matches.
function RingsSvg({ effort, accuracy, weekly, size = 200, stroke = 16, gap = 6 }) {
  const cx = size / 2;
  const cy = size / 2;
  const rings = [
    { v: effort,   c: COLORS.effort },
    { v: accuracy, c: COLORS.accuracy },
    { v: weekly,   c: COLORS.weekly },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + gap);
        if (radius <= 0) return null;
        const circumference = 2 * Math.PI * radius;
        const value = Math.min(1, Math.max(0, r.v));
        const dash = circumference * value;
        const trackColor = hexToRgba(r.c, 0.18);
        return (
          <g key={i} transform={`rotate(-90 ${cx} ${cy})`}>
            <circle
              cx={cx} cy={cy} r={radius} fill="none"
              stroke={trackColor} strokeWidth={stroke}
            />
            <circle
              cx={cx} cy={cy} r={radius} fill="none"
              stroke={r.c} strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
            />
          </g>
        );
      })}
    </svg>
  );
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
