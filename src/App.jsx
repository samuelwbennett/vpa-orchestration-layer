import React from "react";
import { studentDemoData } from "./data/studentDemoData.js";
import { useStudentSnapshot } from "./hooks/useStudentSnapshot.js";
import { useStudentMastery } from "./hooks/useStudentMastery.js";

import Header from "./components/Header.jsx";
import DailyRings from "./components/DailyRings.jsx";
import TodayPlan from "./components/TodayPlan.jsx";
import AppCard from "./components/AppCard.jsx";
import WeeklySummary from "./components/WeeklySummary.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import Insights from "./components/Insights.jsx";
import StrandGarden from "./components/StrandGarden.jsx";

export default function App() {
  const { studentName, weeklyHistory, leaderboard } = studentDemoData;
  const { apps, loading, error, lastUpdated, refresh } = useStudentSnapshot();
  const { mastery } = useStudentMastery();

  // Until the first fetch lands, render a calm loading state.
  if (!apps) {
    return (
      <div className="app-shell">
        <Header
          studentName={studentName}
          onTrackStatus="yellow"
          onTrackLabel="Loading…"
          lastUpdated={null}
          onRefresh={refresh}
          refreshing={loading}
        />
        <div className="section">
          <div className="card" style={{ color: "var(--text-muted)" }}>
            Connecting to your learning apps…
          </div>
        </div>
      </div>
    );
  }

  const { status, label } = computeOnTrack(apps);

  return (
    <div className="app-shell">
      <Header
        studentName={studentName}
        onTrackStatus={status}
        onTrackLabel={label}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        refreshing={loading}
      />

      {error && (
        <div className="section">
          <div className="card" style={{ color: "var(--red)" }}>
            Some apps couldn't be reached. Showing the most recent data we have.
          </div>
        </div>
      )}

      {/* Decision engine: what to do RIGHT NOW */}
      <section className="section">
        <TodayPlan apps={apps} />
      </section>

      {/* Am I on track today? */}
      <section className="section">
        <h2 className="section-title">Today's Goals</h2>
        <div className="card">
          <DailyRings apps={apps} />
        </div>
      </section>

      {/* App cards */}
      <section className="section">
        <h2 className="section-title">Your Apps</h2>
        <div className="grid-apps">
          {apps.map((a) => (
            <AppCard key={a.id} app={a} />
          ))}
        </div>
      </section>

      {/* Mastery garden — cumulative progress across subjects */}
      <section className="section">
        <h2 className="section-title">Skill Garden</h2>
        <p className="section-sub">
          What you've mastered over time, beyond today's goals.
        </p>
        <StrandGarden mastery={mastery} />
      </section>

      {/* How am I doing this week? + Insights */}
      <section className="section">
        <div className="grid-2">
          <WeeklySummary apps={apps} weeklyHistory={weeklyHistory} />
          <Insights apps={apps} weeklyHistory={weeklyHistory} />
        </div>
      </section>

      {/* Subtle leaderboard, last */}
      <section className="section">
        <Leaderboard leaderboard={leaderboard} />
      </section>
    </div>
  );
}

/**
 * On-Track logic — % of daily XP goal completion across active apps.
 *   >= 80%  → green   "On Track"
 *   >= 40%  → yellow  "Slightly Behind"
 *   <  40%  → red     "Needs Attention"
 *
 * Reading Academy (coming_soon) is excluded.
 */
function computeOnTrack(apps) {
  const active = apps.filter((a) => a.status !== "coming_soon" && a.dailyGoal > 0);
  if (active.length === 0) return { status: "green", label: "On Track" };

  const totalGoal = active.reduce((s, a) => s + a.dailyGoal, 0);
  const totalXP = active.reduce(
    (s, a) => s + Math.min(a.todayXP, a.dailyGoal),
    0
  );
  const pct = totalGoal === 0 ? 0 : totalXP / totalGoal;

  if (pct >= 0.8) return { status: "green", label: "On Track" };
  if (pct >= 0.4) return { status: "yellow", label: "Slightly Behind" };
  return { status: "red", label: "Needs Attention" };
}
