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
  // mastery is null when the provider gave no usable number — render
  // the state chip as the primary signal instead of faking 0%.
  const hasPct = topic.mastery != null && Number.isFinite(Number(topic.mastery));
  const pct = hasPct ? Math.min(100, Math.max(0, Number(topic.mastery))) : null;
  return (
    <div
      className="kg-row"
      role="listitem"
      aria-label={`${topic.name}: ${
        hasPct ? `${pct} percent mastered` : "mastery not reported"
      }, ${stateLabel(topic).toLowerCase()}`}
      title={tooltipText(topic, pct)}
    >
      <span className="kg-topic-name">{topic.name}</span>
      <span
        className={`kg-bar-track ${hasPct ? "" : "kg-bar-track-empty"}`}
        aria-hidden="true"
      >
        {hasPct && (
          <span
            className="kg-bar-fill"
            style={{ width: `${pct}%`, background: BAR_COLOR }}
          />
        )}
      </span>
      <span className="kg-pct">{hasPct ? `${pct}%` : "—"}</span>
      <StateChip topic={topic} />
    </div>
  );
}

function SummaryStrip({ summary }) {
  if (!summary) return null;
  const items = [
    { label: "Mastered", value: summary.mastered },
    { label: "Learning", value: summary.learning },
    { label: "Review", value: summary.review },
    { label: "Not started", value: summary.notStarted },
    // Topics whose provider state we haven't mapped yet — only shown
    // when present so the strip stays calm in the common case.
    ...(summary.unknown > 0
      ? [{ label: "Other", value: summary.unknown }]
      : []),
  ];
  return (
    <div className="kg-summary">
      {items.map((i) => (
        <span key={i.label} className="kg-summary-item">
          <strong>{i.value}</strong> {i.label}
        </span>
      ))}
    </div>
  );
}

function StateChip({ topic }) {
  const state = topic.state || "unknown";
  return (
    <span className={`kg-state kg-state-${state}`}>{stateLabel(topic)}</span>
  );
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
    const unit = t.unitName || t.unit || "Course topics";
    if (!map.has(unit)) map.set(unit, []);
    map.get(unit).push(t);
  }
  return Array.from(map.entries()).map(([unit, list]) => ({
    unit,
    topics: list,
  }));
}

function stateLabel(topic) {
  switch (topic.state) {
    case "mastered":
      return "Mastered";
    case "learning":
      return "Learning";
    case "review":
      return "Review";
    case "not_started":
      return "Not started";
    default:
      // Unmapped provider state: show the provider's own word rather
      // than mislabeling it, e.g. "Conditionally completed".
      return topic.providerState
        ? prettifyState(topic.providerState)
        : "In progress";
  }
}

function prettifyState(s) {
  const words = String(s).replace(/[_-]+/g, " ").trim().toLowerCase();
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  return label.length > 22 ? `${label.slice(0, 21)}…` : label;
}

function tooltipText(topic, pct) {
  const parts = [
    pct != null ? `${topic.name} — ${pct}% mastered` : topic.name,
    stateLabel(topic),
  ];
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
