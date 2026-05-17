import React from "react";
import { studentDemoData } from "./data/studentDemoData.js";
import { useAuth } from "./hooks/useAuth.js";
import { useStudentSnapshot } from "./hooks/useStudentSnapshot.js";

import Header from "./components/Header.jsx";
import DailyRings from "./components/DailyRings.jsx";
import TodayPlan from "./components/TodayPlan.jsx";
import Insights from "./components/Insights.jsx";
import Login from "./components/Login.jsx";
import AccountUnlinked from "./components/AccountUnlinked.jsx";
import RolePlaceholder from "./components/RolePlaceholder.jsx";
import TeacherView from "./components/TeacherView.jsx";
import AdminView from "./components/AdminView.jsx";
import ParentView from "./components/ParentView.jsx";
import Earnings from "./components/Earnings.jsx";
import { useIncentives } from "./hooks/useIncentives.js";
import { computeOnTrack } from "./utils/onTrack.js";

// Parked but kept in the repo — re-enable when ready:
//   import StrandGarden from "./components/StrandGarden.jsx";
//   import { useStudentMastery } from "./hooks/useStudentMastery.js";
//   import Pomodoro from "./components/Pomodoro.jsx";
//   import AppCard from "./components/AppCard.jsx";
//   import Leaderboard from "./components/Leaderboard.jsx";
// Pulled to keep the dashboard simple — the rings themselves now
// double as launch buttons (click any ring to open the app), so
// AppCard is redundant. Leaderboard was demo-only data.

export default function App() {
  const { session, profile, role, student, status, signOut, refresh: refreshAuth } =
    useAuth();

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

  // ---- Role routing (status === "ready") ----
  // Student gets the existing dashboard; teacher / admin / parent get
  // a clean placeholder until their views ship in later blueprint
  // steps. A role we don't recognize is treated like an unlinked
  // account rather than crashing.
  if (role === "student") {
    return <SignedInDashboard student={student} signOut={signOut} />;
  }
  if (role === "teacher") {
    return <TeacherView profile={profile} signOut={signOut} />;
  }
  if (role === "admin") {
    return <AdminView profile={profile} signOut={signOut} />;
  }
  if (role === "parent") {
    return <ParentView profile={profile} signOut={signOut} />;
  }
  return (
    <AccountUnlinked email={session?.user?.email} onRefresh={refreshAuth} />
  );
}

// The actual dashboard, only rendered after we have a linked student.
// Pulling this out lets the data hooks (which take student.id) live
// inside a component that's guaranteed to have a student in hand.
function SignedInDashboard({ student, signOut }) {
  const { weeklyHistory } = studentDemoData;
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
        <TodayPlan apps={apps} studentId={student.id} />
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
              studentId={student.id}
            />
          </div>
        </div>
      </section>

      {/* Insights — behavioral warnings and "you're behind" copy */}
      <section className="section">
        <Insights apps={apps} weeklyHistory={weeklyHistory} />
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
