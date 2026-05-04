import React, { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";

/**
 * Pomodoro — focus + break timer using the classic 25/5 cadence with
 * a 15-minute long break after every 4 focus blocks.
 *
 * Lives entirely in component state — no backend yet. Plays an
 * audible chime when each phase ends; the chime is generated on the
 * fly via the WebAudio API so we don't ship an mp3 asset.
 *
 * Phases:
 *   - "focus":      25 min
 *   - "short_break": 5 min
 *   - "long_break": 15 min (every 4th break)
 */

const FOCUS_MIN = 25;
const SHORT_BREAK_MIN = 5;
const LONG_BREAK_MIN = 15;
const CYCLES_BEFORE_LONG_BREAK = 4;

const PHASES = {
  focus:       { label: "Focus",       lengthMin: FOCUS_MIN,        ringColor: "#ff453a" },
  short_break: { label: "Short break", lengthMin: SHORT_BREAK_MIN,  ringColor: "#30d158" },
  long_break:  { label: "Long break",  lengthMin: LONG_BREAK_MIN,   ringColor: "#0a84ff" },
};

export default function Pomodoro() {
  // Number of completed focus cycles in the current set (0..3).
  const [completedFocusCycles, setCompletedFocusCycles] = useState(0);
  const [phase, setPhase] = useState("focus");
  const [remainingSec, setRemainingSec] = useState(FOCUS_MIN * 60);
  const [running, setRunning] = useState(false);

  // Tick driver — interval recomputes once a second when running.
  const tickRef = useRef(null);
  useEffect(() => {
    if (!running) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = setInterval(() => {
      setRemainingSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [running]);

  // Phase transition: when remainingSec hits 0, advance.
  useEffect(() => {
    if (remainingSec > 0) return;
    chime();
    advancePhase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec]);

  const advancePhase = useCallback(() => {
    if (phase === "focus") {
      const nextCycles = completedFocusCycles + 1;
      const isLong = nextCycles % CYCLES_BEFORE_LONG_BREAK === 0;
      setCompletedFocusCycles(nextCycles);
      const nextPhase = isLong ? "long_break" : "short_break";
      setPhase(nextPhase);
      setRemainingSec(PHASES[nextPhase].lengthMin * 60);
    } else {
      setPhase("focus");
      setRemainingSec(PHASES.focus.lengthMin * 60);
    }
    // Auto-pause on phase boundary so the student is never surprised
    // by a timer that just kept running into a break or vice versa.
    setRunning(false);
  }, [phase, completedFocusCycles]);

  const reset = useCallback(() => {
    setRunning(false);
    setPhase("focus");
    setRemainingSec(FOCUS_MIN * 60);
    setCompletedFocusCycles(0);
  }, []);

  const skip = useCallback(() => {
    chime();
    advancePhase();
  }, [advancePhase]);

  const phaseDef = PHASES[phase];
  const totalSec = phaseDef.lengthMin * 60;
  const pct = Math.max(0, Math.min(1, 1 - remainingSec / totalSec));

  return (
    <div className="pomodoro-card">
      <div className="pomodoro-header">
        <span className="pomodoro-phase" style={{ color: phaseDef.ringColor }}>
          {phaseDef.label}
        </span>
        <span className="pomodoro-cycles">
          {completedFocusCycles}/{CYCLES_BEFORE_LONG_BREAK} focus blocks
        </span>
      </div>

      <PomodoroRing pct={pct} color={phaseDef.ringColor}>
        <div className="pomodoro-time">{formatMMSS(remainingSec)}</div>
        <div className="pomodoro-time-sub">
          {phase === "focus" ? "stay on task" : "take a breather"}
        </div>
      </PomodoroRing>

      <div className="pomodoro-controls">
        <button
          type="button"
          className="pomodoro-btn pomodoro-btn-primary"
          onClick={() => setRunning((r) => !r)}
          aria-label={running ? "Pause" : "Start"}
        >
          {running ? <Pause size={18} /> : <Play size={18} />}
          {running ? "Pause" : "Start"}
        </button>
        <button
          type="button"
          className="pomodoro-btn"
          onClick={skip}
          title="Skip to next phase"
          aria-label="Skip phase"
        >
          <SkipForward size={16} />
        </button>
        <button
          type="button"
          className="pomodoro-btn"
          onClick={reset}
          title="Reset"
          aria-label="Reset timer"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}

function PomodoroRing({ pct, color, children }) {
  const size = 180;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const trackColor = hexToRgba(color, 0.18);

  return (
    <div className="pomodoro-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={trackColor} strokeWidth={stroke}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </g>
      </svg>
      <div className="pomodoro-ring-center">{children}</div>
    </div>
  );
}

function formatMMSS(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Simple two-tone chime via WebAudio. No asset to ship; if the
// browser blocks it (e.g. before any user gesture), it just silently
// no-ops — the visual phase change still happens.
function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    const tone = (freq, startOffset, durSec, gain = 0.18) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      g.gain.setValueAtTime(0, now + startOffset);
      g.gain.linearRampToValueAtTime(gain, now + startOffset + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + durSec);
      osc.connect(g).connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + durSec + 0.05);
    };

    // C5 then E5 — clean, friendly, not jarring.
    tone(523.25, 0,    0.35);
    tone(659.25, 0.32, 0.45);

    // Auto-close the context shortly after the last tone.
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* no-op */
  }
}
