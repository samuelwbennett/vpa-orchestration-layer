// =====================================================
// useLoadModel — assembles the load dials' data.
// -----------------------------------------------------
// Pulls 28 days of learning sessions + check-ins (Supabase) and the
// semester schedule (Google Sheet, already cached by its own hook
// path), runs the pure load model, and exposes:
//   series      — per-day rows (learn/phys minutes + loads)
//   readiness   — { status, ratio, ... } + display copy
//   todayCheckin— today's saved ratings (null until rated)
//   saveToday   — upsert today's two taps
//   hint        — schedule-lookahead banking hint (or null)
// Refreshes when a check-in is saved; otherwise loads once per mount
// (the underlying numbers move daily, not by the minute).
// =====================================================

import { useCallback, useEffect, useState } from "react";
import { fetchSessionsSince } from "../services/sessions.js";
import { fetchCheckins, saveCheckin, localDay } from "../services/checkins.js";
import { fetchSchedule } from "../services/schedule.js";
import {
  buildDailySeries,
  computeReadiness,
  readinessCopy,
  planningHint,
} from "../services/loadModel.js";

export function useLoadModel(studentId, enabled = true) {
  const [state, setState] = useState({
    loading: true,
    series: [],
    readiness: { status: "baseline", ratio: null, daysOfData: 0 },
    copy: null,
    hint: null,
    todayCheckin: null,
  });

  const refresh = useCallback(async () => {
    if (!studentId || !enabled) return;
    const since = new Date();
    since.setDate(since.getDate() - 27);

    const [sessionsRes, checkinsRes, scheduleRes] = await Promise.all([
      fetchSessionsSince({ studentId, sinceIso: since.toISOString() }),
      fetchCheckins({ studentId, days: 28 }),
      fetchSchedule({}).catch(() => ({ days: [] })),
    ]);

    const series = buildDailySeries({
      sessions: sessionsRes.sessions,
      checkins: checkinsRes.checkins,
      scheduleDays: scheduleRes.days,
    });
    const readiness = computeReadiness(series);
    const today = localDay();
    const todayCheckin =
      (checkinsRes.checkins || []).find((c) => c.day === today) || null;

    setState({
      loading: false,
      series,
      readiness,
      copy: readinessCopy(readiness),
      hint: planningHint(scheduleRes.days),
      todayCheckin,
    });
  }, [studentId, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveToday = useCallback(
    async ({ mindRpe, bodyRpe }) => {
      if (!studentId) return null;
      const row = await saveCheckin({ studentId, mindRpe, bodyRpe });
      await refresh();
      return row;
    },
    [studentId, refresh]
  );

  return { ...state, refresh, saveToday };
}
