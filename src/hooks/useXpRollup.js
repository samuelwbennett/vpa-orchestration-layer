// =====================================================
// useXpRollup
// -----------------------------------------------------
// Thin wrapper around orchestrator.fetchAllXp().
//
// Returns multi-window XP totals (today / yesterday / thisWeek /
// lastWeek / thisMonth / allTime) summed across every app via the
// contract v1.0 /api/xp endpoint. Apps without an /api/xp
// implementation simply don't contribute.
//
// Use this when a view wants a unified XP ring or trend line
// across the whole ecosystem rather than per-app rings.
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAllXp } from "../services/orchestrator.js";

const ZERO_TOTALS = Object.freeze({
  today: 0, yesterday: 0, thisWeek: 0,
  lastWeek: 0, thisMonth: 0, allTime: 0,
});

export function useXpRollup({ studentId } = {}) {
  const [data, setData] = useState({
    perApp: [],
    totals: ZERO_TOTALS,
    lastEarnedAt: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!studentId) {
      setData({ perApp: [], totals: ZERO_TOTALS, lastEarnedAt: null });
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const next = await fetchAllXp({
        signal: controller.signal,
        studentId,
      });
      if (!controller.signal.aborted) setData(next);
    } catch (e) {
      if (e.name !== "AbortError" && !controller.signal.aborted) setError(e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    refresh();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [refresh]);

  return { ...data, loading, error, refresh };
}
