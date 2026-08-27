import React from "react";
import { studentDemoData } from "./data/studentDemoData.js";
import { useAuth } from "./hooks/useAuth.js";
import { useStudentSnapshot } from "./hooks/useStudentSnapshot.js";

import Header from "./components/Header.jsx";
import DailyRings from "./components/DailyRings.jsx";
import TodayPlan from "./components/TodayPlan.jsx";
import Insights from "./components/Insights.jsx";
import KnowledgeGraph from "./components/KnowledgeGraph.jsx";
import { useStudentKnowledge } from "./hooks/useStudentKnowledge.js";
import Login from "./components/Login.jsx";
import ResetPassword from "./components/ResetPassword.jsx";
import AccountUnlinked from "./components/AccountUnlinked.jsx";
import RolePlaceholder from "./components/RolePlaceholder.jsx";
import TeacherView from "./components/TeacherView.jsx";
import AdminView from "./components/AdminView.jsx";
import ParentView from "./components/ParentView.jsx";
// Earnings + useIncentives parked 2026-08-27 (removed from the student
// dashboard at Samuel's request) — files kept in the repo, and the
// admin/parent redemption views are unaffected.
import { computeOnTrack } from "./utils/onTrack.js";
import CollapsibleSection from "./components/CollapsibleSection.jsx";
import LoadDials from "./components/LoadDials.jsx";
import { useLoadModel } from "./hooks/useLoadModel.js";
import ScheduleToday from "./components/ScheduleToday.jsx";
import AsuCourses from "./components/AsuCourses.jsx";
import SessionTimer from "./components/SessionTimer.jsx";
import { useSessionTimer } from "./hooks/useSessionTimer.js";
import { shouldShowSchedule } from "./services/schedule.js";

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
  const {
    session,
    profile,
    role,
    student,
    status,
    recovery,
    clearRecovery,
    signOut,
    refresh: refreshAuth,
  } = useAuth();

  // ---- Auth gates ----
  if (status === "loading") {
    return <FullScreenMessage>Loading…</FullScreenMessage>;
  }
  // A password-reset link takes priority over normal routing: show the
  // set-a-new-password screen before anything else.
  if (recovery) {
    return (
      <ResetPassword
        email={session?.user?.email}
        onDone={clearRecovery}
        onCancel={clearRecovery}
      />
    );
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
  // Each role gets its own full view: student dashboard, teacher
  // roster, admin overview, parent family view. A role we don't
  // recognize is treated like an unlinked account rather than
  // crashing.
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
  const knowledgeState = useStudentKnowledge(student.id);
  // Focus timer: launching ASU Prep / Math Academy from any launch
  // surface (rings, Start Now) starts the clock; sessions land in
  // Supabase learning_sessions when ended.
  const timer = useSessionTimer(student.id);
  // Load model (check-ins, readiness, planner). Physical minutes come
  // from Jackson's schedule sheet, so the section is gated like the
  // schedule panel; the hook stays dormant for other students.
  const showJackson = shouldShowSchedule(student);
  const load = useLoadModel(student.id, showJackson);

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

  // Apps whose adapter fell back to a degraded (offline) snapshot.
  // Surfacing this matters: without it, a down learning-app backend
  // shows up on the dashboard as silent zeros that look identical to
  // a real "haven't started yet" — the student/parent can't tell the
  // difference between "do your work" and "the app is broken".
  const degradedApps = apps.filter((a) => a && a._degraded);

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

      {!error && degradedApps.length > 0 && (
        <div className="section">
          <div className="card" style={{ color: "var(--text-muted)" }}>
            We couldn't reach{" "}
            {degradedApps.map((a) => a.name).join(", ")} just now — today's
            numbers for {degradedApps.length === 1 ? "it" : "those"} may be
            out of date. Try Refresh in a minute.
          </div>
        </div>
      )}

      {/* Decision engine: what to do RIGHT NOW */}
      <section className="section">
        <TodayPlan apps={apps} studentId={student.id} onLaunch={timer.onLaunch} />
      </section>

      {/* Focus timer strip: live session clock, or today's time rollup.
          Block length adapts to readiness (heavy weeks → shorter blocks). */}
      <section className="section timer-section">
        <SessionTimer timer={timer} blockMin={load.copy?.blockMin} />
      </section>

      {/* Load & Recovery — effort meters, readiness, two-tap check-in,
          and schedule-aware banking hints (Jackson only: physical
          minutes come from his schedule sheet). */}
      {showJackson && (
        <section className="section">
          <h2 className="section-title">Load &amp; Recovery</h2>
          <LoadDials load={load} />
        </section>
      )}

      {/* Day structure — live from the shared Google Sheet (Jackson only).
          School block, 9 AM check-in, robotics, cardio, and whatever
          Skip enters (Kula / ski / rehab) flow in without a deploy. */}
      {showJackson && (
        <section className="section">
          <h2 className="section-title">Today's Schedule</h2>
          <ScheduleToday />
        </section>
      )}

      {/* ASU Prep per-course progress (Canvas). Gated to Jackson like
          the schedule: the Canvas token identifies one student, so
          this data must not render on anyone else's dashboard. */}
      {showJackson && (
        <section className="section">
          <h2 className="section-title">ASU Prep Courses</h2>
          <AsuCourses />
        </section>
      )}

      {/* Today's Goals (Earnings card removed 2026-08-27) */}
      <section className="section">
        <h2 className="section-title">Today's Goals</h2>
        <div className="card">
          <DailyRings apps={apps} onLaunch={timer.onLaunch} />
        </div>
      </section>

      {/* Insights — behavioral warnings and "you're behind" copy */}
      <section className="section">
        <Insights apps={apps} weeklyHistory={weeklyHistory} />
      </section>

      {/* Knowledge Graph — per-topic mastery from Math Academy Beta 9.
          Collapsible (collapsed by default) — it's long, and most days
          the summary is enough. State persists per browser. */}
      <CollapsibleSection
        id="knowledge-graph"
        title="Knowledge Graph"
        summary={knowledgeSummaryText(knowledgeState.knowledge)}
      >
        <KnowledgeGraph
          knowledge={knowledgeState.knowledge}
          loading={knowledgeState.loading}
        />
      </CollapsibleSection>
    </div>
  );
}

// One-line summary for the collapsed Knowledge Graph header, e.g.
// "Mathematical Foundations II — 62 mastered · 11 learning".
function knowledgeSummaryText(knowledge) {
  const app = Array.isArray(knowledge)
    ? knowledge.find((k) => k && k.summary)
    : null;
  if (!app) return null;
  const parts = [];
  if (app.course?.name) parts.push(app.course.name);
  const s = app.summary;
  const counts = [];
  if (Number.isFinite(s.mastered)) counts.push(`${s.mastered} mastered`);
  if (Number.isFinite(s.learning)) counts.push(`${s.learning} learning`);
  if (counts.length) parts.push(counts.join(" · "));
  return parts.join(" — ") || null;
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
