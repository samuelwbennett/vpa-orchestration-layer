// =====================================================
// useStudentSnapshot
// -----------------------------------------------------
// React hook that owns the live data lifecycle:
//   - fetches on mount
//   - polls every config.pollIntervalMs (default 60s)
//   - cancels in-flight requests on unmount or refresh
//   - exposes loading / error / lastUpdated / refresh()
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAllSnapshots } from "../services/orchestrator.js";
import { config } from "../services/config.js";

export function useStudentSnapshot() {
  const [apps, setApps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const abortRef = useRef(null);
  const mountedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const next = await fetchAllSnapshots({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setApps(next);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      if (e.name !== "AbortError") setError(e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const id = setInterval(refresh, config.pollIntervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [refresh]);

  return { apps, loading, error, lastUpdated, refresh };
}
