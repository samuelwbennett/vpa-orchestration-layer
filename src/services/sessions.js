// =====================================================
// Learning-session service — the dashboard focus timer's storage.
// -----------------------------------------------------
// Sessions are written DIRECTLY to Supabase under RLS (the same
// trust model as auth's students lookup): a signed-in student can
// only insert/read rows for their own linked student record. See
// supabase/2026-08-26-learning-sessions.sql for the table + policies.
//
// Design choice: a session is inserted COMPLETE when it ends — the
// running timer lives in the browser (localStorage, survives
// refresh) until then. That keeps the table free of orphaned open
// rows; the cost is that a session abandoned in a closed tab is
// finalized the next time the dashboard loads (capped, see hook).
// =====================================================

import { supabase } from "./supabaseClient.js";

// Apps whose ring/Start-Now launches run the focus timer.
export const TIMED_APPS = {
  "asu-prep": "ASU Prep",
  "math-academy": "Math Academy",
};

// Hard safety cap: a "session" longer than this is a walked-away
// tab, not learning. Anything over is recorded AT the cap.
export const SESSION_CAP_SECONDS = 3 * 60 * 60;

// Insert one completed session. Returns the row, or null when the
// write fails (table not created yet, offline) — callers treat that
// as "history lost, timer itself unaffected".
export async function recordSession({ studentId, appId, startedAt, endedAt }) {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const seconds = Math.min(
    SESSION_CAP_SECONDS,
    Math.max(0, Math.round((end - start) / 1000))
  );
  // Sub-minute sessions are misclicks, not work — don't record them.
  if (seconds < 60) return null;

  const { data, error } = await supabase
    .from("learning_sessions")
    .insert({
      student_id: studentId,
      app_id: appId,
      started_at: start.toISOString(),
      ended_at: end.toISOString(),
      seconds,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.warn("[sessions] recordSession failed:", error.message);
    return null;
  }
  return data;
}

// Sessions since a given ISO timestamp (today's rollup, weekly view).
export async function fetchSessionsSince({ studentId, sinceIso }) {
  const { data, error } = await supabase
    .from("learning_sessions")
    .select("id, app_id, started_at, ended_at, seconds")
    .eq("student_id", studentId)
    .gte("started_at", sinceIso)
    .order("started_at", { ascending: false })
    .limit(200);

  if (error) {
    console.warn("[sessions] fetchSessionsSince failed:", error.message);
    return { sessions: [], _degraded: true };
  }
  return { sessions: data || [] };
}

// ---- rollup helpers (pure; exported for tests) ----

export function sumSecondsByApp(sessions) {
  const byApp = {};
  let total = 0;
  for (const s of sessions || []) {
    const secs = Number(s.seconds) || 0;
    byApp[s.app_id] = (byApp[s.app_id] || 0) + secs;
    total += secs;
  }
  return { byApp, total };
}

// Local midnight of today as ISO — sessions are "today's" by the
// student's own clock, matching the rest of the dashboard.
export function todayStartIso(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.toISOString();
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  const sec = s % 60;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

// mm:ss / h:mm:ss for the live ticking readout.
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
