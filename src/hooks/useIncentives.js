// =====================================================
// useIncentives
// -----------------------------------------------------
// Owns the incentives data lifecycle for the signed-in student.
//   - fetches on mount + when studentId changes
//   - polls every 5 minutes (earnings change with daily_progress,
//     which itself updates whenever a session completes)
//   - exposes `redeem()` that posts to the proxy and refreshes
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchIncentives, postRedemption } from "../services/incentives.js";

const POLL_MS = 5 * 60 * 1000;

export function useIncentives(studentId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!studentId) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const next = await fetchIncentives({ signal: controller.signal, studentId });
      if (controller.signal.aborted) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (e.name !== "AbortError") setError(e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [studentId, refresh]);

  const redeem = useCallback(async ({ totalDollars, storeAmount, scholarshipAmount, note }) => {
    const result = await postRedemption({
      studentId,
      totalDollars,
      storeAmount,
      scholarshipAmount,
      note,
    });
    await refresh();
    return result;
  }, [studentId, refresh]);

  return { data, loading, error, refresh, redeem };
}
