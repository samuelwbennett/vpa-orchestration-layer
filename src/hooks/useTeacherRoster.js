// =====================================================
// useTeacherRoster
// -----------------------------------------------------
// Owns the teacher view's data lifecycle:
//   1. Loads the signed-in teacher's roster — teacher_classes →
//      class_memberships → students — straight from Supabase. RLS
//      scopes every query to this teacher (see the role-schema
//      migrations in supabase/migrations/), so there's no server
//      round-trip beyond Supabase itself.
//   2. Fans out the same orchestrator the student dashboard uses to
//      get each student's status across all four apps, with a small
//      concurrency cap so a big roster doesn't open hundreds of
//      sockets at once.
//
// Returns { classes, students, loading, error, lastUpdated, refresh }.
// Each `students` entry: { id, rowKey, name, grade, avatar, classId,
// className, apps }. No polling — the teacher pulls fresh data with
// the refresh button.
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient.js";
import { fetchAllSnapshots } from "../services/orchestrator.js";

const SNAPSHOT_CONCURRENCY = 5;

// Run `fn` over `items` with at most `limit` in flight at once.
async function mapWithConcurrency(items, limit, fn) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      await fn(items[index], index);
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    worker
  );
  await Promise.all(workers);
}

function studentName(s) {
  if (s.display_name && s.display_name.trim()) return s.display_name.trim();
  const composed = [s.first_name, s.last_initial]
    .filter(Boolean)
    .join(" ")
    .trim();
  return composed || "Student";
}

export function useTeacherRoster() {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
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
      // 1. The teacher's classes (RLS → only classes they own).
      const { data: classRows, error: classErr } = await supabase
        .from("teacher_classes")
        .select("id, name, grade_level")
        .eq("archived", false)
        .order("name");
      if (classErr) throw classErr;
      const classList = classRows || [];

      if (classList.length === 0) {
        if (controller.signal.aborted) return;
        setClasses([]);
        setStudents([]);
        setLastUpdated(new Date());
        return;
      }

      // 2. Class memberships for those classes.
      const classIds = classList.map((c) => c.id);
      const { data: memRows, error: memErr } = await supabase
        .from("class_memberships")
        .select("class_id, student_id")
        .in("class_id", classIds);
      if (memErr) throw memErr;
      const memberships = memRows || [];

      // 3. The student records (RLS → only students this teacher can see).
      const studentIds = [...new Set(memberships.map((m) => m.student_id))];
      let studentRows = [];
      if (studentIds.length > 0) {
        const { data: sRows, error: sErr } = await supabase
          .from("students")
          .select(
            "id, display_name, first_name, last_initial, grade, grade_level, avatar_emoji"
          )
          .in("id", studentIds);
        if (sErr) throw sErr;
        studentRows = sRows || [];
      }

      // Assemble a flat roster. A student in multiple classes appears
      // once per class (rowKey keeps those rows distinct).
      const classById = Object.fromEntries(classList.map((c) => [c.id, c]));
      const studentById = Object.fromEntries(
        studentRows.map((s) => [s.id, s])
      );
      const roster = memberships
        .map((m) => {
          const s = studentById[m.student_id];
          if (!s) return null;
          const cls = classById[m.class_id];
          return {
            id: s.id,
            rowKey: `${m.class_id}:${s.id}`,
            name: studentName(s),
            grade:
              s.grade ||
              (s.grade_level != null ? String(s.grade_level) : ""),
            avatar: s.avatar_emoji || null,
            classId: m.class_id,
            className: cls ? cls.name : "Class",
            apps: [],
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));

      // 4. Fan out per-student app snapshots, concurrency-limited.
      await mapWithConcurrency(roster, SNAPSHOT_CONCURRENCY, async (st) => {
        try {
          st.apps = await fetchAllSnapshots({
            signal: controller.signal,
            studentId: st.id,
          });
        } catch {
          st.apps = [];
        }
      });

      if (controller.signal.aborted) return;
      setClasses(classList);
      setStudents(roster);
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

  return { classes, students, loading, error, lastUpdated, refresh };
}
