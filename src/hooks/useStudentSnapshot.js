// =====================================================
// useStudentSnapshot
// -----------------------------------------------------
// React hook that owns the live data lifecycle for a given student:
//   - fetches on mount + whenever studentId changes
//   - polls every config.pollIntervalMs (default 60s)
//   - cancels in-flight requests on unmount or refresh
//   - exposes loading / error / lastUpdated / refresh()
//
// `studentId` is the VPA student UUID. Pass null to disable fetching
// (useful when auth hasn't resolved yet).
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAllSnapshots } from "../services/orchestrator.js";
import { config } from "../services/config.js";

export function useStudentSnapshot(studentId) {
  const [apps, setApps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!studentId) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const next = await fetchAllSnapshots({ signal: controller.signal, studentId });
      if (controller.signal.aborted) return;
      setApps(next);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      if (e.name !== "AbortError") setError(e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    refresh();
    const id = setInterval(refresh, config.pollIntervalMs);
    return () => {
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [studentId, refresh]);

  return { apps, loading, error, lastUpdated, refresh };
}
