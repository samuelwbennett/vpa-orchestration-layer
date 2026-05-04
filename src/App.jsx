import React from "react";
import { studentDemoData } from "./data/studentDemoData.js";
import { useAuth } from "./hooks/useAuth.js";
import { useStudentSnapshot } from "./hooks/useStudentSnapshot.js";

import Header from "./components/Header.jsx";
import DailyRings from "./components/DailyRings.jsx";
import TodayPlan from "./components/TodayPlan.jsx";
import AppCard from "./components/AppCard.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import Insights from "./components/Insights.jsx";
import Login from "./components/Login.jsx";
import AccountUnlinked from "./components/AccountUnlinked.jsx";
import Earnings from "./components/Earnings.jsx";
import { useIncentives } from "./hooks/useIncentives.js";

// Parked but kept in the repo — re-enable when ready:
//   import StrandGarden from "./components/StrandGarden.jsx";
//   import { useStudentMastery } from "./hooks/useStudentMastery.js";
//   import Pomodoro from "./components/Pomodoro.jsx";
// The Skill Garden section + Pomodoro card were pulled while the
// daily-rings + earnings layout stabilized. The mastery endpoints
// (in math-facts-trainer-react) keep working in the meantime.

export default function App() {
  const { session, student, status, signOut, refresh: refreshAuth } = useAuth();

  // ---- Auth gates ----
  if (status === "loading") {
    return <FullScreenMessage>Loading…</FullScreenMessage>;
  }
  if (status === "anonymous") {
    return <Login />;
  }
  if (status === "unlinked") {
    return (
      <AccountUnlinked
        email={session?.user?.email}
        onRefresh={refreshAuth}
      />
    );
  }

  return <SignedInDashboard student={student} signOut={signOut} />;
}

// The actual dashboard, only rendered after we have a linked student.
// Pulling this out lets the data hooks (which take student.id) live
// inside a component that's guaranteed to have a student in hand.
function SignedInDashboard({ student, signOut }) {
  const { weeklyHistory, leaderboard } = studentDemoData;
  const { apps, loading, error, lastUpdated, refresh } = useStudentSnapshot(student.id);
  const incentives = useIncentives(student.id);

  if (!apps) {
    return (
      <div className="app-shell">
        <Header
          studentName={student.display_name}
          onTrackStatus="yellow"
          onTrackLabel="Loading…"
          lastUpdated={null}
          onRefresh={refresh}
          onSignOut={signOut}
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

  const { status: trackStatus, label: trackLabel } = computeOnTrack(apps);

  return (
    <div className="app-shell">
      <Header
        studentName={student.display_name}
        onTrackStatus={trackStatus}
        onTrackLabel={trackLabel}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        onSignOut={signOut}
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

      {/* Today's Goals + Earnings side by side */}
      <section className="section">
        <div className="grid-rings-earnings">
          <div>
            <h2 className="section-title">Today's Goals</h2>
            <div className="card">
              <DailyRings apps={apps} />
            </div>
          </div>
          <div>
            <h2 className="section-title">Earnings</h2>
            <Earnings
              data={incentives.data}
              loading={incentives.loading}
              error={incentives.error}
              redeem={incentives.redeem}
            />
          </div>
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

      {/* Insights — behavioral warnings and "you're behind" copy */}
      <section className="section">
        <Insights apps={apps} weeklyHistory={weeklyHistory} />
      </section>

      {/* Subtle leaderboard, last */}
      <section className="section">
        <Leaderboard leaderboard={leaderboard} />
      </section>
    </div>
  );
}

function FullScreenMessage({ children }) {
  return (
    <div className="login-shell">
      <div className="login-card" style={{ textAlign: "center" }}>
        <div className="brand-mark">VPA</div>
        <p className="login-sub">{children}</p>
      </div>
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
