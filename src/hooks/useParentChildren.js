// =====================================================
// useParentChildren
// -----------------------------------------------------
// Owns the parent view's data lifecycle:
//   1. Loads the signed-in guardian's children via guardian_students
//      (RLS-scoped to own guardian rows; see migration 001).
//   2. Fetches each child's `students` row (RLS allows via the
//      is_guardian_of helper).
//   3. Fans out the orchestrator per child to get cross-app status,
//      concurrency-capped (parents typically have few children).
//
// Returns { children, loading, error, lastUpdated, refresh }.
// Each `children` entry: { id, name, grade, avatar, apps }.
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient.js";
import { fetchAllSnapshots } from "../services/orchestrator.js";

const SNAPSHOT_CONCURRENCY = 4;

async function mapWithConcurrency(items, limit, fn) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      await fn(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
}

function studentName(s) {
  if (s.display_name && s.display_name.trim()) return s.display_name.trim();
  const composed = [s.first_name, s.last_initial]
    .filter(Boolean)
    .join(" ")
    .trim();
  return composed || "Student";
}

export function useParentChildren() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      // 1. Guardian → students links (RLS scopes to own).
      const { data: links, error: linksErr } = await supabase
        .from("guardian_students")
        .select("student_id, relationship");
      if (linksErr) throw linksErr;
      const studentIds = [...new Set((links || []).map((l) => l.student_id))];

      if (studentIds.length === 0) {
        if (controller.signal.aborted) return;
        setChildren([]);
        setLastUpdated(new Date());
        return;
      }

      // 2. Student rows (RLS allows via is_guardian_of helper).
      const { data: studentRows, error: stErr } = await supabase
        .from("students")
        .select(
          "id, display_name, first_name, last_initial, grade, grade_level, avatar_emoji"
        )
        .in("id", studentIds);
      if (stErr) throw stErr;

      const roster = (studentRows || [])
        .map((s) => ({
          id: s.id,
          name: studentName(s),
          grade:
            s.grade ||
            (s.grade_level != null ? String(s.grade_level) : ""),
          avatar: s.avatar_emoji || null,
          apps: [],
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // 3. Fan out snapshots per child.
      await mapWithConcurrency(roster, SNAPSHOT_CONCURRENCY, async (child) => {
        try {
          child.apps = await fetchAllSnapshots({
            signal: controller.signal,
            studentId: child.id,
          });
        } catch {
          child.apps = [];
        }
      });

      if (controller.signal.aborted) return;
      setChildren(roster);
      setLastUpdated(new Date());
    } catch (e) {
      if (e.name !== "AbortError" && !controller.signal.aborted) {
        setError(e);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [refresh]);

  return { children, loading, error, lastUpdated, refresh };
}
