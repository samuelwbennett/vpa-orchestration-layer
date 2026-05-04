// =====================================================
// useStudentMastery
// -----------------------------------------------------
// React hook for the skill-garden view. Fetches per-app strand
// rollups on mount and on demand. Polls less often than the
// snapshot hook (mastery changes slowly, polling-heavy queries
// hit Supabase + the MA partner API harder).
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAllMastery } from "../services/orchestrator.js";

// Mastery refreshes every 5 minutes by default. The dashboard's
// snapshot hook continues to poll at config.pollIntervalMs.
const MASTERY_POLL_MS = 5 * 60 * 1000;

export function useStudentMastery() {
  const [mastery, setMastery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const next = await fetchAllMastery({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setMastery(next);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      if (e.name !== "AbortError") setError(e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, MASTERY_POLL_MS);
    return () => {
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [refresh]);

  return { mastery, loading, error, lastUpdated, refresh };
}
