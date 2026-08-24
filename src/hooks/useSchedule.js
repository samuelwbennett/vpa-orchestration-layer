// =====================================================
// useSchedule
// -----------------------------------------------------
// Owns the live Google Sheet schedule lifecycle: fetch on mount,
// re-fetch every 10 minutes (the sheet changes at most a few times a
// week — no need for the 60s app-data cadence), abort on unmount.
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSchedule } from "../services/schedule.js";

const REFRESH_MS = 10 * 60 * 1000;

export function useSchedule(enabled = true) {
  const [days, setDays] = useState(null); // null = loading
  const [degraded, setDegraded] = useState(false);
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await fetchSchedule({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setDays(result.days);
      setDegraded(!!result._degraded);
    } catch (e) {
      if (e.name !== "AbortError") {
        setDays([]);
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

  return { days, degraded, refresh };
}
