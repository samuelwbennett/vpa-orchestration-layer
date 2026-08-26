// =====================================================
// useSessionTimer — the dashboard focus timer's lifecycle.
// -----------------------------------------------------
// One active session at a time. start(appId) is called when the
// student launches a timed app (ring click / Start Now); stop()
// finalizes it: the completed session is inserted into Supabase and
// today's rollup refreshes.
//
// Honesty limits (deliberate):
//   - The active session is persisted in localStorage, so a page
//     refresh resumes the clock instead of losing it.
//   - SESSION_CAP_SECONDS (3h) is a hard ceiling: on resume or tick,
//     anything past the cap auto-stops AT the cap — a tab left open
//     overnight records 3h, not 14h.
//   - Sessions under 60s aren't recorded (misclicks).
//   - This measures time *near* the work, not proof of focus — pair
//     it with the assignment/XP numbers, never read it alone.
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TIMED_APPS,
  SESSION_CAP_SECONDS,
  recordSession,
  fetchSessionsSince,
  sumSecondsByApp,
  todayStartIso,
} from "../services/sessions.js";

const STORAGE_KEY = "vpa.activeSession.v1";

function loadStored(studentId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A stored session for a different student (shared computer,
    // account switch) is finalized against ITS student, not resumed.
    if (!parsed || !parsed.appId || !parsed.startedAt) return null;
    return parsed.studentId === studentId ? parsed : { ...parsed, _foreign: true };
  } catch {
    return null;
  }
}

function saveStored(session) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode — timer still works, just won't survive refresh */
  }
}

export function useSessionTimer(studentId) {
  const [active, setActive] = useState(null); // { appId, startedAt }
  const [elapsed, setElapsed] = useState(0); // seconds, ticking
  const [today, setToday] = useState({ byApp: {}, total: 0 });
  const [historyDegraded, setHistoryDegraded] = useState(false);
  const activeRef = useRef(null);
  activeRef.current = active;

  const refreshToday = useCallback(async () => {
    if (!studentId) return;
    const { sessions, _degraded } = await fetchSessionsSince({
      studentId,
      sinceIso: todayStartIso(),
    });
    setToday(sumSecondsByApp(sessions));
    setHistoryDegraded(!!_degraded);
  }, [studentId]);

  // Finalize a session object (write + clear + refresh rollup).
  const finalize = useCallback(
    async (session, endedAtMs) => {
      const startMs = Date.parse(session.startedAt);
      const cappedEnd = Math.min(
        endedAtMs,
        startMs + SESSION_CAP_SECONDS * 1000
      );
      saveStored(null);
      setActive(null);
      setElapsed(0);
      await recordSession({
        studentId: session.studentId || studentId,
        appId: session.appId,
        startedAt: session.startedAt,
        endedAt: new Date(cappedEnd).toISOString(),
      });
      await refreshToday();
    },
    [studentId, refreshToday]
  );

  // Mount: resume (or finalize) any stored session, load today.
  useEffect(() => {
    if (!studentId) return;
    const stored = loadStored(studentId);
    if (stored) {
      const age = (Date.now() - Date.parse(stored.startedAt)) / 1000;
      if (stored._foreign || age >= SESSION_CAP_SECONDS) {
        // Different student, or past the cap — close it out.
        finalize(stored, Date.now());
      } else {
        setActive({ appId: stored.appId, startedAt: stored.startedAt });
        setElapsed(Math.round(age));
      }
    }
    refreshToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Tick once a second while active; auto-stop at the cap.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const secs = Math.round(
        (Date.now() - Date.parse(active.startedAt)) / 1000
      );
      if (secs >= SESSION_CAP_SECONDS) {
        finalize({ ...active, studentId }, Date.now());
      } else {
        setElapsed(secs);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [active, finalize, studentId]);

  // Launch handler: starts the clock for timed apps. If a session for
  // ANOTHER app is running, it's finalized first (switching apps ends
  // the old session); relaunching the same app keeps the clock going.
  const onLaunch = useCallback(
    (app) => {
      const appId = app?.id;
      if (!appId || !TIMED_APPS[appId] || !studentId) return;
      const current = activeRef.current;
      if (current) {
        if (current.appId === appId) return; // same app — keep running
        finalize({ ...current, studentId }, Date.now());
      }
      const session = {
        studentId,
        appId,
        startedAt: new Date().toISOString(),
      };
      saveStored(session);
      setActive({ appId, startedAt: session.startedAt });
      setElapsed(0);
    },
    [studentId, finalize]
  );

  const stop = useCallback(() => {
    const current = activeRef.current;
    if (!current) return;
    finalize({ ...current, studentId }, Date.now());
  }, [finalize, studentId]);

  return { active, elapsed, today, historyDegraded, onLaunch, stop, refreshToday };
}
