import React from "react";
import { Trophy, TrendingUp, Flame, Star } from "lucide-react";

/**
 * Leaderboard — small, subtle, first names only.
 * Categories:
 *   - Weekly XP leaders
 *   - Most Improved (so all students can win)
 *   - Streak leaders
 *   - Personal Best highlight
 */
export default function Leaderboard({ leaderboard }) {
  const { weeklyLeaders, mostImproved, streakLeaders, personalBest } = leaderboard;

  return (
    <div className="card">
      <h3 className="section-title" style={{ marginTop: 0 }}>Leaderboard</h3>

      <div className="leaderboard">
        <Block
          title="Weekly XP"
          icon={<Trophy size={12} />}
          rows={weeklyLeaders.map((p) => ({
            name: p.name,
            meta: `${p.weeklyXP} XP`
          }))}
        />

        <Block
          title="Most Improved"
          icon={<TrendingUp size={12} />}
          rows={mostImproved.map((p) => ({
            name: p.name,
            meta: `+${p.improvement}%`
          }))}
        />

        <Block
          title="Streak Leaders"
          icon={<Flame size={12} />}
          rows={streakLeaders.map((p) => ({
            name: p.name,
            meta: `${p.streak} days`
          }))}
        />

        {personalBest && (
          <div className="lb-personal-best">
            <div className="pb-text">
              <div className="label">
                <Star size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />
                Personal Best
              </div>
              <div className="name">
                {personalBest.name} — {personalBest.label}
              </div>
            </div>
            <div className="pb-value">{personalBest.weeklyXP} XP</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Block({ title, icon, rows }) {
  return (
    <div className="lb-block">
      <h4>{icon}{title}</h4>
      {rows.map((r) => (
        <div className="lb-row" key={r.name + r.meta}>
          <span className="name">{r.name}</span>
          <span className="meta">{r.meta}</span>
        </div>
      ))}
    </div>
  );
}
