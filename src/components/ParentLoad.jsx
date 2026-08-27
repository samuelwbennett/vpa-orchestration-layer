import React from "react";
import { Brain, HeartPulse } from "lucide-react";
import { formatDuration } from "../services/sessions.js";
import { displayRatio } from "../services/loadModel.js";

/**
 * ParentLoad — the read-only load view for Dan and Skip.
 *
 * Same numbers Jackson sees, minus the check-in taps: rating his own
 * effort stays his job. Adds a 7-day strip so "how was this week"
 * is answerable at a glance, which is the question a parent actually
 * has.
 *
 * Framing stays descriptive ("1.4× his normal month") — never a
 * burnout or injury claim, because the evidence behind this kind of
 * ratio doesn't support one.
 */
export default function ParentLoad({ load }) {
  if (!load || load.loading) {
    return (
      <div className="card" style={{ color: "var(--text-muted)" }}>
        Loading load & recovery…
      </div>
    );
  }

  const { series, readiness, copy } = load;
  const today = series[series.length - 1] || null;
  const week = series.slice(-7);

  const weekLearn = week.reduce((s, d) => s + d.learnMin, 0);
  const weekPhys = week.reduce((s, d) => s + d.physMin, 0);
  const rated = week.filter((d) => d.mindRpe != null).length;

  return (
    <div className="card load-card">
      <div className="load-head">
        <span className={`load-chip load-chip-${copy?.tone || "muted"}`}>
          {copy?.label}
        </span>
        <span className="load-why">{parentDetail(copy, readiness)}</span>
      </div>

      {today && (
        <div className="load-meters">
          <Meter
            icon={<Brain size={15} />}
            label="Learning"
            todayMin={today.learnMin}
            weekMin={weekLearn}
            ratio={displayRatio(today.learnLoad, readiness.learnChronic, readiness.learnEstablished)}
          />
          <Meter
            icon={<HeartPulse size={15} />}
            label="Physical"
            todayMin={today.physMin}
            weekMin={weekPhys}
            ratio={displayRatio(today.physLoad, readiness.physChronic, readiness.physEstablished)}
          />
        </div>
      )}

      <WeekStrip week={week} />

      <div className="pload-foot">
        {rated === 0
          ? "No effort ratings logged this week — the dials lean on measured minutes alone until Jackson taps his daily check-in."
          : `Effort rated on ${rated} of the last 7 days.`}
      </div>
    </div>
  );
}

function parentDetail(copy, readiness) {
  if (!copy) return "";
  if (readiness?.status === "baseline") return copy.detail;
  // Re-voice the student-facing copy for a parent reading about someone else.
  return copy.detail
    .replace("your normal month", "his normal month")
    .replace(/ — shorter blocks.*$/, " — a lighter day would be reasonable.")
    .replace(/ — minimum day.*$/, " — worth easing off today.")
    .replace(/ — a good week to get ahead\./, " — room to get ahead if he wants it.");
}

function Meter({ icon, label, todayMin, weekMin, ratio }) {
  const pct = ratio === null ? 0 : Math.max(4, Math.min(100, (ratio.value / 2) * 100));
  return (
    <div className="load-meter">
      <span className="load-meter-icon">{icon}</span>
      <span className="load-meter-label">{label}</span>
      <span className="load-meter-track" aria-hidden="true">
        <span className="load-meter-fill" style={{ width: `${pct}%` }} />
        <span className="load-meter-norm" style={{ left: "50%" }} />
      </span>
      <span className="load-meter-value">
        {formatDuration(todayMin * 60)} today
        <span className="load-meter-ratio">
          {" · "}
          {formatDuration(weekMin * 60)} this week
          {ratio !== null ? ` · ${ratio.capped ? "3×+" : `${ratio.value}×`} normal` : ""}
        </span>
      </span>
    </div>
  );
}

// Seven paired bars — learning above, physical below — so a heavy or
// empty stretch is visible without reading a single number.
function WeekStrip({ week }) {
  const maxLearn = Math.max(60, ...week.map((d) => d.learnMin));
  const maxPhys = Math.max(60, ...week.map((d) => d.physMin));

  return (
    <div className="pweek">
      <div className="pweek-title">Last 7 days</div>
      <div className="pweek-row">
        {week.map((d) => (
          <div key={d.day} className="pweek-day">
            <div className="pweek-bars">
              <span
                className="pweek-bar learn"
                style={{ height: `${(d.learnMin / maxLearn) * 100}%` }}
                title={`${d.day}: ${formatDuration(d.learnMin * 60)} learning`}
              />
              <span
                className="pweek-bar phys"
                style={{ height: `${(d.physMin / maxPhys) * 100}%` }}
                title={`${d.day}: ${formatDuration(d.physMin * 60)} training`}
              />
            </div>
            <div className="pweek-label">{dayInitial(d.day)}</div>
          </div>
        ))}
      </div>
      <div className="pweek-legend">
        <span className="pweek-key learn" /> Learning
        <span className="pweek-key phys" /> Physical
      </div>
    </div>
  );
}

function dayInitial(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return ["S", "M", "T", "W", "T", "F", "S"][date.getDay()];
}
