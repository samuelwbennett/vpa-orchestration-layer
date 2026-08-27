import React from "react";
import { RefreshCw, LogOut, GraduationCap, Video, Bot, HeartPulse } from "lucide-react";
import { useParentChildren } from "../hooks/useParentChildren.js";
import { useTodayPriority } from "../hooks/useTodayPriority.js";
import { useXpRollup } from "../hooks/useXpRollup.js";
import { useAsuProgress } from "../hooks/useAsuProgress.js";
import { useStudentKnowledge } from "../hooks/useStudentKnowledge.js";
import { useLoadModel } from "../hooks/useLoadModel.js";
import { useSchedule } from "../hooks/useSchedule.js";
import { summarize } from "../utils/onTrack.js";
import { shouldShowSchedule, findToday, CHECKIN_MEET_URL } from "../services/schedule.js";
import { buildTalkPrompts } from "../services/talkPrompts.js";
import { formatDuration } from "../services/sessions.js";
import ParentLoad from "./ParentLoad.jsx";
import ParentCourses, { TalkPrompts } from "./ParentCourses.jsx";
import PaceProjector from "./PaceProjector.jsx";
import CollapsibleSection from "./CollapsibleSection.jsx";

/**
 * ParentView — the family dashboard for Dan and Skip.
 *
 * Read-only by design: parents watch, they don't drive. Nothing here
 * writes to Jackson's data — his effort ratings and his timer stay
 * his to enter.
 *
 * For the student whose external accounts are wired up (Jackson), this
 * renders the full picture: today's plan and schedule, load & recovery,
 * per-course grades and current work, data-grounded conversation
 * starters, and the pace projector. Any other child falls back to the
 * simple summary card, since the Canvas/schedule feeds are single-
 * student.
 */
export default function ParentView({ profile, signOut }) {
  const { children, loading, error, lastUpdated, refresh } = useParentChildren();
  const parentName = (profile && profile.display_name) || "there";

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-left">
          <div className="eyebrow">{todayLabel()} · Family Dashboard</div>
          <h1>Good {greeting()}, {trimName(parentName)}.</h1>
        </div>
        <div className="header-right">
          <button className="refresh-btn" onClick={refresh} disabled={loading} title="Refresh">
            <RefreshCw size={13} className={loading ? "spinning" : ""} />
            {lastUpdated ? `Updated ${formatAgo(lastUpdated)}` : "Refresh"}
          </button>
          <button className="refresh-btn" onClick={signOut} title="Sign out" aria-label="Sign out">
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {error && (
        <div className="section">
          <div className="card" style={{ color: "var(--red)" }}>
            Couldn't load your family overview.{" "}
            {error.message ? `(${error.message})` : ""}
          </div>
        </div>
      )}

      {loading && children.length === 0 && (
        <div className="section">
          <div className="card" style={{ color: "var(--text-muted)" }}>
            Loading your family overview…
          </div>
        </div>
      )}

      {!loading && !error && children.length === 0 && (
        <div className="section">
          <div className="card teacher-empty">
            <h3>No children linked yet</h3>
            <p>
              Once your child's account is linked to yours, their progress will
              appear here. Reach out to your school admin to get connected.
            </p>
          </div>
        </div>
      )}

      {children.map((child) => (
        <ChildSections key={child.id} child={child} />
      ))}
    </div>
  );
}

function ChildSections({ child }) {
  // Hooks must run unconditionally; `full` only gates rendering.
  const full = shouldShowSchedule({ id: child.id, display_name: child.name });

  const today = useTodayPriority({ studentId: child.id });
  const xp = useXpRollup({ studentId: child.id });
  const asu = useAsuProgress(full);
  const knowledgeState = useStudentKnowledge(full ? child.id : null);
  const load = useLoadModel(child.id, full);
  const { days: scheduleDays } = useSchedule(full);

  const summary = summarize(child.apps);
  const activeApps = (child.apps || []).filter(
    (a) => a.status !== "coming_soon" && a.dailyGoal > 0
  );
  const topRec =
    today.top && today.top.recommendation?.kind !== "none" ? today.top : null;
  const todayRow = full && scheduleDays ? findToday(scheduleDays) : null;
  const todayMin = load?.series?.length
    ? load.series[load.series.length - 1].learnMin
    : 0;

  const prompts = full
    ? buildTalkPrompts({
        courses: asu.courses || [],
        knowledge: knowledgeState.knowledge || [],
      })
    : [];

  return (
    <>
      {/* ---- Today at a glance ---- */}
      <section className="section">
        <div className="card parent-child">
          <div className="parent-child-head">
            <h2 className="parent-child-name">{child.name}</h2>
            <span className={`on-track ${summary.onTrack.status}`}>
              <span className="dot" />
              {parentTone(summary.onTrack.status)}
            </span>
          </div>

          <div className="parent-child-pace">
            {parentPace(summary, activeApps.length)}
          </div>

          {topRec && (
            <div className="parent-priority">
              <div className="parent-priority-label">What he should do next</div>
              <div className="parent-priority-line">
                <strong>{topRec.name}</strong> — {topRec.recommendation.headline}
              </div>
              <div className="parent-priority-sub">
                {topRec.recommendation.subtitle}
              </div>
            </div>
          )}

          <div className="parent-xp-rollup">
            <strong>{Math.round(xp.totals?.today || 0)} XP</strong> today ·{" "}
            <strong>{Math.round(xp.totals?.thisWeek || 0)} XP</strong> this week
            {full && (
              <>
                {" · "}
                <strong>{formatDuration(todayMin * 60)}</strong> focused work today
              </>
            )}
          </div>

          {todayRow && <TodayBlocks row={todayRow} />}
        </div>
      </section>

      {!full && null}

      {full && (
        <>
          <section className="section">
            <h2 className="section-title">Load &amp; Recovery</h2>
            <ParentLoad load={load} />
          </section>

          <section className="section">
            <h2 className="section-title">Talk with {firstName(child.name)} about</h2>
            <TalkPrompts prompts={prompts} />
          </section>

          <section className="section">
            <h2 className="section-title">Courses</h2>
            <ParentCourses
              courses={asu.courses}
              knowledge={knowledgeState.knowledge}
              loading={asu.courses === null}
              degraded={asu.degraded}
            />
          </section>

          <CollapsibleSection
            id="parent-pace"
            title="Pace projector"
            defaultOpen={false}
            summary="When will he finish? — drag the rates"
          >
            <PaceProjector
              courses={asu.courses || []}
              knowledge={knowledgeState.knowledge || []}
            />
          </CollapsibleSection>
        </>
      )}
    </>
  );
}

// Today's schedule blocks, compressed to a single readable line-up.
function TodayBlocks({ row }) {
  const items = [];
  if (row.school) items.push({ icon: <GraduationCap size={14} />, text: row.school });
  if (row.checkin)
    items.push({
      icon: <Video size={14} />,
      text: row.checkin,
      href: CHECKIN_MEET_URL,
    });
  if (row.robotics && !/^no robotics/i.test(row.robotics))
    items.push({ icon: <Bot size={14} />, text: row.robotics });
  if (row.cardio) items.push({ icon: <HeartPulse size={14} />, text: row.cardio });
  if (row.kula) items.push({ icon: <HeartPulse size={14} />, text: row.kula });
  if (row.ski) items.push({ icon: <HeartPulse size={14} />, text: row.ski });

  if (items.length === 0) return null;

  return (
    <div className="parent-today-blocks">
      <div className="parent-wins-label">His day</div>
      <div className="parent-blocks-row">
        {items.map((i, idx) => (
          <span key={idx} className="parent-block">
            {i.icon}
            {i.href ? (
              <a href={i.href} target="_blank" rel="noreferrer">
                {i.text}
              </a>
            ) : (
              i.text
            )}
          </span>
        ))}
      </div>
      {row.notes && <div className="parent-block-note">{row.notes}</div>}
    </div>
  );
}

// ---- helpers ----

function parentTone(status) {
  if (status === "green") return "On Track";
  if (status === "yellow") return "Building up";
  return "Just getting started";
}

function parentPace(summary, activeCount) {
  if (activeCount === 0) return "Nothing scheduled today.";
  if (summary.noXp) return "Hasn't started today yet.";
  return `${summary.met} of ${activeCount} ${activeCount === 1 ? "goal" : "goals"} met today.`;
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "them";
}

function trimName(name) {
  return String(name || "").replace(/\.\s*$/, "");
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function formatAgo(date) {
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}
