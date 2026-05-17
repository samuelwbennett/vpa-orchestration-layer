import React from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { launchApp } from "../utils/launch.js";
import { useTodayPriority } from "../hooks/useTodayPriority.js";
import { useXpRollup } from "../hooks/useXpRollup.js";

/**
 * TodayPlan — "what should I do RIGHT NOW?" card.
 *
 * Decision logic (in this order):
 *   1. /api/today contract endpoint (cross-app priority pick) — preferred.
 *      Every app has its own opinion (Math Academy = "rest day" vs "goal
 *      met" vs "continue course"; Math Facts = least-mastered operation;
 *      etc.) — fetchAllToday picks the single highest-priority block.
 *   2. If the contract data isn't ready yet OR every app returned a
 *      "none" block (no priority), fall back to the legacy snapshot
 *      logic — recommend the first app under its daily goal.
 *   3. If neither yields anything actionable → "All goals complete".
 *
 * Also renders a unified XP rollup line below the headline, summed
 * across every app via /api/xp.
 */
export default function TodayPlan({ apps, studentId }) {
  const today = useTodayPriority({ studentId });
  const xp = useXpRollup({ studentId });

  // 1. Try the contract pick first.
  if (today.top && today.top.recommendation?.kind !== "none") {
    return (
      <ContractPriorityCard
        top={today.top}
        otherCount={countOtherActionable(today.perApp)}
        xpTotals={xp.totals}
      />
    );
  }

  // 2. Fall back to legacy snapshot-based pick.
  const legacy = pickRecommendation(apps);
  if (legacy) {
    return (
      <LegacyPriorityCard recommended={legacy} xpTotals={xp.totals} />
    );
  }

  // 3. Nothing to recommend — caught up.
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
          <XpRollupLine totals={xp.totals} />
        </div>
        <CheckCircle2 size={48} color="var(--green)" strokeWidth={1.5} />
      </div>
    </div>
  );
}

// --- contract-driven card (uses /api/today + /api/xp) ---

function ContractPriorityCard({ top, otherCount, xpTotals }) {
  const rec = top.recommendation;
  const priorityClass =
    rec.priority === "high" ? "" : rec.priority === "low" ? " low" : " medium";

  return (
    <div className={`card today-plan${priorityClass}`}>
      <div className="row">
        <div>
          <div className="recommend-label">
            {rec.priority === "high" ? "Start here" : "Up next"}
          </div>
          <h2>{top.name} — {rec.headline}</h2>
          <p className="reason">{rec.subtitle}</p>
          {otherCount > 0 && (
            <p className="reason-meta">
              {otherCount === 1
                ? "+ 1 more app has a recommendation today."
                : `+ ${otherCount} more apps have recommendations today.`}
            </p>
          )}
          <XpRollupLine totals={xpTotals} />
        </div>
        <button
          className="btn-primary"
          onClick={() => launchApp(top.link)}
        >
          Start Now <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

// --- legacy snapshot-driven card (kept as fallback) ---

function LegacyPriorityCard({ recommended, xpTotals }) {
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
          <XpRollupLine totals={xpTotals} />
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

// --- shared subcomponent: unified XP rollup line ---

function XpRollupLine({ totals }) {
  if (!totals) return null;
  const t = Math.round(totals.today);
  const w = Math.round(totals.thisWeek);
  if (t === 0 && w === 0) return null;
  return (
    <p className="xp-rollup-line">
      <strong>{t} XP</strong> earned today · <strong>{w} XP</strong> this week
      <span className="xp-rollup-source"> · across all apps</span>
    </p>
  );
}

// --- helpers (exported for testability / future swap-in) ---

// Count apps whose /api/today returned an actionable block, excluding
// the one we're already promoting.
function countOtherActionable(perApp) {
  if (!Array.isArray(perApp)) return 0;
  let n = 0;
  let topSeen = false;
  for (const a of perApp) {
    if (!a?.recommendation || a.recommendation.kind === "none") continue;
    if (!topSeen) { topSeen = true; continue; }
    n += 1;
  }
  return n;
}

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
