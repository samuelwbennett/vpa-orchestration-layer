// =====================================================
// useAsuProgress
// -----------------------------------------------------
// ASU Prep per-course progress lifecycle: fetch on mount, refresh
// every 10 minutes (mirrors useSchedule — Canvas progress moves
// slowly and the proxy caches for 10 minutes anyway).
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProgress } from "../services/asuPrep.js";

const REFRESH_MS = 10 * 60 * 1000;

export function useAsuProgress(enabled = true) {
  const [courses, setCourses] = useState(null); // null = loading
  const [asOf, setAsOf] = useState(null);
  const [degraded, setDegraded] = useState(false);
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await fetchProgress({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setCourses(result.courses);
      setAsOf(result.asOf);
      setDegraded(!!result._degraded);
    } catch (e) {
      if (e.name !== "AbortError") {
        setCourses([]);
        setDegraded(true);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [enabled, refresh]);

  return { courses, asOf, degraded, refresh };
}
