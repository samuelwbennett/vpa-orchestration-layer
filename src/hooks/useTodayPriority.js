// =====================================================
// useTodayPriority
// -----------------------------------------------------
// Thin wrapper around orchestrator.fetchAllToday().
//
// Returns the single highest-priority recommendation for the
// student across every app (and the full per-app list so the UI
// can render a secondary list if it wants). Contract v1.0
// `/api/today` endpoint per app — adapters that don't implement
// it simply don't contribute.
//
// Designed to be optional/additive: any role view can drop it in
// without affecting the existing snapshot data path.
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAllToday } from "../services/orchestrator.js";

export function useTodayPriority({ studentId } = {}) {
  const [data, setData] = useState({ perApp: [], top: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!studentId) {
      setData({ perApp: [], top: null });
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const next = await fetchAllToday({
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
