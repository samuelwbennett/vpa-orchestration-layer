import React from "react";

/**
 * WeeklySummary
 * - Total XP this week
 * - Days active
 * - Apps completed today
 * - Simple bar chart (CSS only) of last 7 days of XP
 *
 * Props:
 *   apps: full apps array
 *   weeklyHistory: [{ day: "Mon", xp: 110 }, ... ]   (today is last entry)
 */
export default function WeeklySummary({ apps, weeklyHistory }) {
  const totalWeeklyXP = weeklyHistory.reduce((sum, d) => sum + d.xp, 0);
  const daysActive = weeklyHistory.filter((d) => d.xp > 0).length;
  const completedToday = apps.filter((a) => a.status === "complete").length;
  const totalActiveApps = apps.filter((a) => a.status !== "coming_soon").length;

  const max = Math.max(...weeklyHistory.map((d) => d.xp), 1);

  return (
    <div className="card">
      <h3 className="section-title" style={{ marginTop: 0 }}>This Week</h3>

      <div className="weekly-stats">
        <div className="stat">
          <div className="label">Total XP</div>
          <div className="value">{totalWeeklyXP}</div>
        </div>
        <div className="stat">
          <div className="label">Days active</div>
          <div className="value">{daysActive} / 7</div>
        </div>
        <div className="stat">
          <div className="label">Apps complete today</div>
          <div className="value">{completedToday} / {totalActiveApps}</div>
        </div>
      </div>

      <div className="bar-chart" aria-label="Weekly XP trend">
        {weeklyHistory.map((d, i) => {
          const isToday = i === weeklyHistory.length - 1;
          const heightPct = (d.xp / max) * 100;
          return (
            <div className="bar-col" key={d.day}>
              <div
                className={`bar ${isToday ? "today" : ""}`}
                style={{ height: `${heightPct}%` }}
                title={`${d.day}: ${d.xp} XP`}
              />
              <div className="bar-label">{d.day}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
