import React from "react";
import { Lock } from "lucide-react";

/**
 * StrandGarden — cumulative-mastery view sectioned by app.
 *
 * Each strand renders as a "plant": a pot at the bottom and a stem
 * that grows in height with mastery percent, with leaves appearing
 * at growth thresholds. Color of each plant matches the app's ring
 * color, so the garden and the rings tell a consistent story.
 *
 * Hover any plant for atom counts and a recently-improved badge.
 *
 * Props:
 *   mastery: array of { id, name, strands: [...], _comingSoon? } from
 *            orchestrator.fetchAllMastery()
 */

const APP_COLOR = {
  "math-facts":      "#fa3e3e",
  "math-academy":    "#3bc1f3",
  "reading-facts":   "#9aff00",
  "reading-academy": "#9c6cff",
};

const APP_GROUP = {
  "math-facts":      "Math",
  "math-academy":    "Math",
  "reading-facts":   "Reading",
  "reading-academy": "Reading",
};

export default function StrandGarden({ mastery }) {
  if (!mastery) {
    return (
      <div className="card" style={{ color: "var(--text-muted)" }}>
        Loading mastery…
      </div>
    );
  }

  // Group apps into Math / Reading sections, preserving display order.
  const sections = { Math: [], Reading: [] };
  for (const app of mastery) {
    const group = APP_GROUP[app.id] || "Other";
    if (!sections[group]) sections[group] = [];
    sections[group].push(app);
  }

  return (
    <div className="garden">
      {Object.entries(sections).map(([groupName, apps]) =>
        apps.length === 0 ? null : (
          <div key={groupName} className="garden-section">
            <h3 className="garden-section-title">{groupName}</h3>
            {apps.map((app) => (
              <AppPlot key={app.id} app={app} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function AppPlot({ app }) {
  const color = APP_COLOR[app.id] || "#3bc1f3";
  const locked = app._comingSoon;

  return (
    <div className={`garden-plot ${locked ? "locked" : ""}`}>
      <div className="garden-plot-header">
        <span className="garden-plot-name">
          {locked && <Lock size={12} className="garden-name-lock" />}
          {app.name}
        </span>
        {!locked && app.strands.length > 0 && (
          <span className="garden-plot-summary">
            {totalMastered(app)} / {totalAvailable(app)} mastered
          </span>
        )}
      </div>
      {locked ? (
        <div className="garden-locked">Coming soon</div>
      ) : app.strands.length === 0 ? (
        <div className="garden-empty">
          {app._notLinked
            ? "Link a Math Academy account to see progress here."
            : "No mastery data yet — start practicing to grow your garden."}
        </div>
      ) : (
        <div className="garden-row">
          {app.strands.map((s) => (
            <Plant key={s.id} strand={s} color={color} appName={app.name} />
          ))}
        </div>
      )}
    </div>
  );
}

function Plant({ strand, color, appName }) {
  const total = strand.total > 0
    ? strand.total
    : Math.max(strand.attempted || 0, strand.mastered || 0);
  const pct = total > 0 ? Math.min(1, (strand.mastered || 0) / total) : 0;
  const tooLittleData = total === 0;
  const unlocked = strand.unlocked !== false;

  return (
    <div
      className={`plant ${!unlocked ? "plant-locked" : ""}`}
      tabIndex={0}
      aria-label={ariaSummary(strand, appName, pct)}
    >
      <PlantSvg pct={pct} color={color} unlocked={unlocked} />
      <div className="plant-symbol">{strand.symbol}</div>
      <div className="plant-label">{strand.label}</div>
      <div className="plant-meta">
        {!unlocked
          ? "Locked"
          : tooLittleData
          ? "—"
          : `${strand.mastered}/${total}`}
      </div>

      <div className="plant-tooltip" role="tooltip">
        <div className="plant-tooltip-title">{strand.label}</div>
        <div className="plant-tooltip-row">
          <span className="muted">Mastered</span>
          <span>{strand.mastered}{total > 0 ? ` / ${total}` : ""}</span>
        </div>
        {strand.attempted != null && total > 0 && (
          <div className="plant-tooltip-row">
            <span className="muted">Attempted</span>
            <span>{strand.attempted}</span>
          </div>
        )}
        <div className="plant-tooltip-row">
          <span className="muted">Mastery</span>
          <span>{Math.round(pct * 100)}%</span>
        </div>
        {typeof strand.recentlyImproved === "number" && strand.recentlyImproved > 0 && (
          <div className="plant-tooltip-row">
            <span className="muted">Past 7 days</span>
            <span>+{strand.recentlyImproved}</span>
          </div>
        )}
        {strand.letterGrade && (
          <div className="plant-tooltip-row">
            <span className="muted">Grade</span>
            <span>{strand.letterGrade}</span>
          </div>
        )}
        {!unlocked && (
          <div className="plant-tooltip-next">
            Master 5 multiplication facts to unlock division.
          </div>
        )}
      </div>
    </div>
  );
}

// SVG plant. A pot at the bottom, a stem that grows upward with pct,
// and three leaf pairs that appear at 25% / 60% / 90%. Stem and
// leaves use the strand's color; pot and soil are fixed.
function PlantSvg({ pct, color, unlocked }) {
  const W = 80;
  const H = 110;
  const POT_TOP_Y = 92;
  const POT_BOTTOM_Y = 106;
  const stemMaxHeight = 78;     // stem from POT_TOP_Y up to ~14
  const stemHeight = unlocked ? Math.round(stemMaxHeight * pct) : 0;
  const stemTopY = POT_TOP_Y - stemHeight;

  const showLeaves1 = unlocked && pct >= 0.25;
  const showLeaves2 = unlocked && pct >= 0.60;
  const showLeaves3 = unlocked && pct >= 0.90;

  return (
    <svg
      className="plant-svg"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
    >
      {/* Soft ground glow */}
      <ellipse cx={W / 2} cy={POT_BOTTOM_Y - 1} rx="22" ry="3"
               fill={hexToRgba(color, 0.18)} />

      {/* Pot — terracotta */}
      <path
        d={`M ${W / 2 - 18} ${POT_TOP_Y}
            L ${W / 2 + 18} ${POT_TOP_Y}
            L ${W / 2 + 14} ${POT_BOTTOM_Y}
            L ${W / 2 - 14} ${POT_BOTTOM_Y} Z`}
        fill="#d6a07a"
        stroke="#a67353"
        strokeWidth="1"
      />
      <rect
        x={W / 2 - 19} y={POT_TOP_Y - 3}
        width="38" height="4"
        fill="#c8916c" stroke="#a67353" strokeWidth="1" rx="1"
      />

      {/* Stem */}
      {stemHeight > 0 && (
        <line
          x1={W / 2} y1={POT_TOP_Y - 1}
          x2={W / 2} y2={stemTopY}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}

      {/* Leaves: each pair offset upward along the stem. */}
      {showLeaves1 && (
        <Leaves cx={W / 2} cy={POT_TOP_Y - Math.min(stemHeight, 18)} color={color} />
      )}
      {showLeaves2 && (
        <Leaves cx={W / 2} cy={POT_TOP_Y - Math.min(stemHeight, 42)} color={color} />
      )}
      {showLeaves3 && (
        <Leaves cx={W / 2} cy={POT_TOP_Y - Math.min(stemHeight, 64)} color={color} flower />
      )}
    </svg>
  );
}

function Leaves({ cx, cy, color, flower }) {
  if (flower) {
    // Top "bloom" — a small ring of dots in the strand color.
    return (
      <g>
        <circle cx={cx}     cy={cy - 4} r="3.5" fill={color} />
        <circle cx={cx - 4} cy={cy}     r="3"   fill={color} />
        <circle cx={cx + 4} cy={cy}     r="3"   fill={color} />
        <circle cx={cx}     cy={cy + 3} r="2.5" fill="#fff8" />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx={cx - 7} cy={cy} rx="6" ry="3.5"
               fill={color} transform={`rotate(-22 ${cx - 7} ${cy})`} />
      <ellipse cx={cx + 7} cy={cy} rx="6" ry="3.5"
               fill={color} transform={`rotate(22 ${cx + 7} ${cy})`} />
    </g>
  );
}

function totalMastered(app) {
  return app.strands.reduce((s, x) => s + (x.mastered || 0), 0);
}

function totalAvailable(app) {
  return app.strands.reduce((s, x) => {
    const t = x.total > 0 ? x.total : Math.max(x.attempted || 0, x.mastered || 0);
    return s + t;
  }, 0);
}

function ariaSummary(strand, appName, pct) {
  return `${appName} ${strand.label}: ${Math.round(pct * 100)} percent mastered, ${strand.mastered} of ${strand.total || strand.attempted}`;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
