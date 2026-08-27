import React, { useState } from "react";
import { Brain, HeartPulse } from "lucide-react";
import { formatDuration } from "../services/sessions.js";
import { displayRatio } from "../services/loadModel.js";

/**
 * LoadDials — the load & recovery card:
 *   two effort meters (learning / physical, today vs 28-day normal),
 *   a readiness chip with a one-sentence WHY,
 *   today's two-tap CR-10 check-in,
 *   and the schedule-lookahead banking hint.
 *
 * Everything shown is descriptive ("1.4× your normal month"), never
 * a burnout/injury prediction — that framing is deliberate; the
 * evidence only supports spike *description*.
 */
export default function LoadDials({ load }) {
  const { loading, series, readiness, copy, hint, todayCheckin, saveToday } =
    load;

  if (loading) {
    return (
      <div className="card" style={{ color: "var(--text-muted)" }}>
        Loading load model…
      </div>
    );
  }

  const today = series[series.length - 1] || null;

  return (
    <div className="card load-card">
      <div className="load-head">
        <span className={`load-chip load-chip-${copy?.tone || "muted"}`}>
          {copy?.label}
        </span>
        <span className="load-why">{copy?.detail}</span>
      </div>

      {today && (
        <div className="load-meters">
          <Meter
            icon={<Brain size={15} />}
            label="Learning"
            minutes={today.learnMin}
            ratio={displayRatio(today.learnLoad, readiness.learnChronic, readiness.learnEstablished)}
          />
          <Meter
            icon={<HeartPulse size={15} />}
            label="Physical"
            minutes={today.physMin}
            ratio={displayRatio(today.physLoad, readiness.physChronic, readiness.physEstablished)}
          />
        </div>
      )}

      {/* key: remount when the stored ratings arrive/change so the
          local tap state reflects what's actually saved */}
      <Checkin
        key={
          todayCheckin
            ? `${todayCheckin.mind_rpe}-${todayCheckin.body_rpe}`
            : "unset"
        }
        todayCheckin={todayCheckin}
        saveToday={saveToday}
      />

      {copy?.blockMin && (
        <div className="load-block-hint">
          Today's focus blocks: {copy.blockMin} min work · 8 min movement.
        </div>
      )}

      {hint && <div className="load-plan-hint">{hint.detail}</div>}
    </div>
  );
}

function Meter({ icon, label, minutes, ratio }) {
  // vs-normal only once that series has earned a real baseline.
  const pct =
    ratio === null ? 0 : Math.max(4, Math.min(100, (ratio.value / 2) * 100));

  return (
    <div className="load-meter">
      <span className="load-meter-icon">{icon}</span>
      <span className="load-meter-label">{label}</span>
      <span className="load-meter-track" aria-hidden="true">
        <span className="load-meter-fill" style={{ width: `${pct}%` }} />
        <span className="load-meter-norm" style={{ left: "50%" }} />
      </span>
      <span className="load-meter-value">
        {formatDuration(minutes * 60)}
        {ratio !== null && (
          <span className="load-meter-ratio">
            {" · "}
            {ratio.capped ? "3×+" : `${ratio.value}×`} normal
          </span>
        )}
      </span>
    </div>
  );
}

// The two-tap CR-10 check-in. Both rows always visible; tapping a
// number saves immediately once both are set (and re-saves on edit).
function Checkin({ todayCheckin, saveToday }) {
  const [mind, setMind] = useState(todayCheckin?.mind_rpe ?? null);
  const [body, setBody] = useState(todayCheckin?.body_rpe ?? null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(todayCheckin ? "stored" : null);

  const commit = async (nextMind, nextBody) => {
    if (nextMind === null || nextBody === null) return;
    setSaving(true);
    await saveToday({ mindRpe: nextMind, bodyRpe: nextBody });
    setSaving(false);
    setSavedAt("now");
  };

  const pick = (which, value) => {
    if (which === "mind") {
      setMind(value);
      commit(value, body);
    } else {
      setBody(value);
      commit(mind, value);
    }
  };

  return (
    <div className="checkin">
      <div className="checkin-title">
        Today's check-in{" "}
        {saving ? (
          <span className="checkin-status">saving…</span>
        ) : savedAt ? (
          <span className="checkin-status done">saved ✓</span>
        ) : (
          <span className="checkin-status">two taps, 1 = easy · 10 = maxed</span>
        )}
      </div>
      <RpeRow
        label="School-brain"
        value={mind}
        onPick={(v) => pick("mind", v)}
      />
      <RpeRow
        label="Training-body"
        value={body}
        onPick={(v) => pick("body", v)}
      />
    </div>
  );
}

function RpeRow({ label, value, onPick }) {
  return (
    <div className="checkin-row">
      <span className="checkin-label">{label}</span>
      <div className="checkin-scale" role="radiogroup" aria-label={label}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className={`checkin-dot${value === n ? " picked" : ""}`}
            onClick={() => onPick(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
