// =====================================================
// useStudentKnowledge
// -----------------------------------------------------
// React hook for per-topic knowledge profiles (Math Academy partner
// API Beta 9, getStudentKnowledge, via our proxy). Mirrors
// useStudentMastery: fetch on mount + on demand, slow poll —
// knowledge profiles change slowly and the query hits the MA partner
// API through the proxy on every refresh.
//
// Returns { knowledge, loading, error, lastUpdated, refresh } where
// `knowledge` is the fetchAllKnowledge() array: one entry per app
// that exposes a knowledge profile (today, only Math Academy), each
// { id, name, asOf, course, topics, summary }.
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAllKnowledge } from "../services/orchestrator.js";

// Same cadence as mastery: every 5 minutes.
const KNOWLEDGE_POLL_MS = 5 * 60 * 1000;

export function useStudentKnowledge(studentId) {
  const [knowledge, setKnowledge] = useState(null);
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
      const next = await fetchAllKnowledge({
        signal: controller.signal,
        studentId,
      });
      if (controller.signal.aborted) return;
      setKnowledge(next);
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
    const id = setInterval(refresh, KNOWLEDGE_POLL_MS);
    return () => {
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [studentId, refresh]);

  return { knowledge, loading, error, lastUpdated, refresh };
}
