import React, { useState } from "react";

/**
 * KnowledgeGraph — student-facing per-topic knowledge profile.
 *
 * Renders the Math Academy Beta 9 knowledge profile (via
 * useStudentKnowledge → orchestrator.fetchAllKnowledge) as horizontal
 * mastery bars grouped by unit, with a summary strip of state counts.
 *
 * Design notes (matches the dashboard's Apple-like system):
 *   - Single measure (mastery 0–100) → single hue: the Math Academy
 *     ring blue. No legend needed for one series; the title names it.
 *   - Topic state (mastered / learning / review / not started) is a
 *     labeled chip, never color alone.
 *   - Degraded / not-linked states are surfaced honestly — no
 *     fabricated data (see QA convention from 8d7716c).
 *
 * Props:
 *   knowledge: array from fetchAllKnowledge() — entries of
 *              { id, name, asOf, course, topics, summary, _degraded?, _notLinked? }
 *   loading:   bool
 */

const BAR_COLOR = "var(--ring-math-academy)";

export default function KnowledgeGraph({ knowledge, loading }) {
  if (loading && !knowledge) {
    return (
      <div className="card" style={{ color: "var(--text-muted)" }}>
        Loading knowledge profile…
      </div>
    );
  }

  const apps = Array.isArray(knowledge) ? knowledge : [];
  if (apps.length === 0) {
    return <UnavailableCard />;
  }

  return (
    <div className="kg">
      {apps.map((app) => (
        <AppKnowledge key={app.id} app={app} />
      ))}
    </div>
  );
}

function AppKnowledge({ app }) {
  if (app._notLinked) {
    return (
      <div className="card" style={{ color: "var(--text-muted)" }}>
        Link a {app.name} account to see your knowledge profile here.
      </div>
    );
  }
  if (app._degraded || !app.topics || app.topics.length === 0) {
    return <UnavailableCard appName={app.name} />;
  }

  const units = groupByUnit(app.topics);

  return (
    <div className="card kg-card">
      <div className="kg-header">
        <div>
          <div className="kg-app-name">{app.name}</div>
          {app.course?.name && (
            <div className="kg-course">
              {app.course.name}
              {Number.isFinite(app.course.percentComplete)
                ? ` — ${app.course.percentComplete}% complete`
                : ""}
            </div>
          )}
        </div>
        <SummaryStrip summary={app.summary} />
      </div>

      {units.map(({ unit, topics }) => (
        <UnitGroup key={unit} unit={unit} topics={topics} />
      ))}

      {app.asOf && (
        <div className="kg-asof">
          Updated {formatAsOf(app.asOf)}
        </div>
      )}
    </div>
  );
}

function UnitGroup({ unit, topics }) {
  // Long courses have many units — collapse each unit past the first
  // few topics so the section stays calm.
  const COLLAPSED_COUNT = 6;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? topics : topics.slice(0, COLLAPSED_COUNT);
  const hidden = topics.length - visible.length;

  return (
    <div className="kg-unit">
      <div className="kg-unit-title">{unit}</div>
      <div className="kg-rows" role="list">
        {visible.map((t) => (
          <TopicRow key={t.id || t.name} topic={t} />
        ))}
      </div>
      {hidden > 0 && (
        <button
          type="button"
          className="kg-more"
          onClick={() => setExpanded(true)}
        >
          Show {hidden} more
        </button>
      )}
      {expanded && topics.length > COLLAPSED_COUNT && (
        <button
          type="button"
          className="kg-more"
          onClick={() => setExpanded(false)}
        >
          Show fewer
        </button>
      )}
    </div>
  );
}

function TopicRow({ topic }) {
  const pct = Math.min(100, Math.max(0, Number(topic.mastery) || 0));
  return (
    <div
      className="kg-row"
      role="listitem"
      aria-label={`${topic.name}: ${pct} percent mastered, ${stateLabel(
        topic.state
      ).toLowerCase()}`}
      title={tooltipText(topic, pct)}
    >
      <span className="kg-topic-name">{topic.name}</span>
      <span className="kg-bar-track" aria-hidden="true">
        <span
          className="kg-bar-fill"
          style={{ width: `${pct}%`, background: BAR_COLOR }}
        />
      </span>
      <span className="kg-pct">{pct}%</span>
      <StateChip state={topic.state} />
    </div>
  );
}

function SummaryStrip({ summary }) {
  if (!summary) return null;
  const items = [
    { label: "Mastered", value: summary.mastered, cls: "kg-chip-mastered" },
    { label: "Learning", value: summary.learning, cls: "kg-chip-learning" },
    { label: "Review", value: summary.review, cls: "kg-chip-review" },
    { label: "Not started", value: summary.notStarted, cls: "kg-chip-notstarted" },
  ];
  return (
    <div className="kg-summary">
      {items.map((i) => (
        <span key={i.label} className={`kg-summary-item ${i.cls}`}>
          <strong>{i.value}</strong> {i.label}
        </span>
      ))}
    </div>
  );
}

function StateChip({ state }) {
  const label = stateLabel(state);
  return <span className={`kg-state kg-state-${state}`}>{label}</span>;
}

function UnavailableCard({ appName }) {
  return (
    <div className="card" style={{ color: "var(--text-muted)" }}>
      {appName ? `${appName}'s knowledge profile` : "Your knowledge profile"}{" "}
      isn't available yet. It arrives with the Math Academy Beta 9
      knowledge upgrade — your XP and goals above are unaffected.
    </div>
  );
}

// ---- helpers ----

function groupByUnit(topics) {
  const map = new Map();
  for (const t of topics) {
    const unit = t.unit || "Course topics";
    if (!map.has(unit)) map.set(unit, []);
    map.get(unit).push(t);
  }
  return Array.from(map.entries()).map(([unit, list]) => ({
    unit,
    topics: list,
  }));
}

function stateLabel(state) {
  switch (state) {
    case "mastered":
      return "Mastered";
    case "learning":
      return "Learning";
    case "review":
      return "Review";
    default:
      return "Not started";
  }
}

function tooltipText(topic, pct) {
  const parts = [`${topic.name} — ${pct}% mastered`, stateLabel(topic.state)];
  if (topic.lastPracticedAt) {
    parts.push(`Last practiced ${formatAsOf(topic.lastPracticedAt)}`);
  }
  return parts.join(" · ");
}

function formatAsOf(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
