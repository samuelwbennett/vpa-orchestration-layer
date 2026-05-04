import React from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { launchApp } from "../utils/launch.js";

/**
 * TodayPlan — decision engine answer to "What should I do RIGHT NOW?".
 *
 * Logic (priority order):
 *   1. Math Academy < goal       → Math Academy
 *   2. Math Facts < goal         → Math Facts
 *   3. Reading Facts < goal      → Reading Facts
 *   4. otherwise                 → "All goals complete today"
 *
 * Reading Academy is excluded (coming soon).
 */
export default function TodayPlan({ apps }) {
  const recommended = pickRecommendation(apps);

  if (!recommended) {
    return (
      <div className="card today-plan">
        <div className="row">
          <div>
            <div className="recommend-label" style={{ color: "#1f7a37" }}>
              All Done
            </div>
            <h2>All goals complete today.</h2>
            <p className="reason">
              Nice work — every active goal is done. Take a break, or get a head
              start on tomorrow.
            </p>
          </div>
          <CheckCircle2 size={48} color="var(--green)" strokeWidth={1.5} />
        </div>
      </div>
    );
  }

  const remaining = recommended.dailyGoal - recommended.todayXP;
  const pctBehind = Math.round(
    100 * (1 - recommended.todayXP / recommended.dailyGoal)
  );

  const headline = recommended.nextLesson
    ? `${recommended.name} — ${recommended.nextLesson}`
    : recommended.name;

  return (
    <div className="card today-plan">
      <div className="row">
        <div>
          <div className="recommend-label">Start here</div>
          <h2>{headline}</h2>
          <p className="reason">
            {reasoningCopy(recommended, remaining, pctBehind)}
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={() => launchApp(recommended.link)}
        >
          Start Now <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

// --- helpers (exported for testability / future swap-in) ---

export function pickRecommendation(apps) {
  const order = ["math-academy", "math-facts", "reading-facts"];
  for (const id of order) {
    const app = apps.find((a) => a.id === id);
    if (!app) continue;
    if (app.status === "coming_soon") continue;
    if (app.todayXP < app.dailyGoal) return app;
  }
  return null;
}

function reasoningCopy(app, remaining, pctBehind) {
  if (app.todayXP === 0) {
    return `You haven't started ${app.name} today. ${remaining} XP to hit your daily goal.`;
  }
  if (pctBehind >= 50) {
    return `You're ${pctBehind}% behind on ${app.name}. ${remaining} XP left to finish.`;
  }
  return `You're close — just ${remaining} XP left to complete your ${app.name} goal.`;
}
