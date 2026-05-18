// =====================================================
// useAdminOverview
// -----------------------------------------------------
// Owns the admin view's data lifecycle:
//   1. Loads org-scoped classes, teachers, students, and user
//      profiles straight from Supabase. RLS (see
//      supabase/migrations/0009) scopes every query to the admin's
//      organization, so the orchestration layer doesn't need a
//      privileged server endpoint.
//   2. Fans out the same orchestrator used by the student and
//      teacher views to fetch each student's status across all
//      four apps, concurrency-capped.
//
// Returns { classes, teachers, students, loading, error,
// lastUpdated, refresh }. Each `students` entry is one row per
// (class, student) — a student in multiple classes appears once
// per class — to match how the teacher view renders rosters.
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient.js";
import { fetchAllSnapshots } from "../services/orchestrator.js";

const SNAPSHOT_CONCURRENCY = 5;

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

export function useAdminOverview() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
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
      // 1. All classes in the admin's org (RLS).
      const { data: classRows, error: classErr } = await supabase
        .from("teacher_classes")
        .select("id, name, grade_level, teacher_user_id")
        .eq("archived", false)
        .order("name");
      if (classErr) throw classErr;
      const classList = classRows || [];

      // 2. All profiles in the admin's org (RLS).
      const { data: profileRows, error: profileErr } = await supabase
        .from("user_profiles")
        .select("auth_user_id, role, display_name")
        .order("display_name");
      if (profileErr) throw profileErr;
      const profiles = profileRows || [];

      // 3. Memberships for those classes.
      const classIds = classList.map((c) => c.id);
      let memberships = [];
      if (classIds.length > 0) {
        const { data: memRows, error: memErr } = await supabase
          .from("class_memberships")
          .select("class_id, student_id")
          .in("class_id", classIds);
        if (memErr) throw memErr;
        memberships = memRows || [];
      }

      // 4. Students referenced by those memberships.
      const studentIds = [...new Set(memberships.map((m) => m.student_id))];
      let studentRows = [];
      let mathAcademyLinks = {};
      if (studentIds.length > 0) {
        const { data: sRows, error: sErr } = await supabase
          .from("students")
          .select(
            "id, display_name, first_name, last_initial, grade, grade_level, avatar_emoji"
          )
          .in("id", studentIds);
        if (sErr) throw sErr;
        studentRows = sRows || [];

        // 4b. Existing Math Academy linkages (slug=math_academy).
        //     Used by the admin's per-student MA-id inline editor so
        //     it can preload the current value.
        const { data: maApp } = await supabase
          .from("learning_apps")
          .select("id")
          .eq("slug", "math_academy")
          .maybeSingle();
        if (maApp?.id) {
          const { data: saaRows } = await supabase
            .from("student_app_accounts")
            .select("student_id, external_id, enabled")
            .eq("app_id", maApp.id)
            .in("student_id", studentIds);
          mathAcademyLinks = Object.fromEntries(
            (saaRows || []).map((r) => [
              r.student_id,
              { externalId: r.external_id, enabled: !!r.enabled },
            ]),
          );
        }
      }

      // ---- Assemble views ----
      const profileByAuthId = Object.fromEntries(
        profiles.map((p) => [p.auth_user_id, p])
      );
      const studentById = Object.fromEntries(
        studentRows.map((s) => [s.id, s])
      );
      const classById = Object.fromEntries(classList.map((c) => [c.id, c]));

      const studentsByClass = {};
      memberships.forEach((m) => {
        if (!studentsByClass[m.class_id]) studentsByClass[m.class_id] = [];
        studentsByClass[m.class_id].push(m.student_id);
      });
      const classesByTeacher = {};
      classList.forEach((c) => {
        if (!classesByTeacher[c.teacher_user_id]) {
          classesByTeacher[c.teacher_user_id] = [];
        }
        classesByTeacher[c.teacher_user_id].push(c.id);
      });

      // Class summaries — teacher name + student count.
      const classSummaries = classList.map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevel: c.grade_level,
        teacherName:
          (profileByAuthId[c.teacher_user_id] || {}).display_name ||
          "Unassigned",
        studentCount: (studentsByClass[c.id] || []).length,
      }));

      // Teacher summaries — only role=teacher and role=admin profiles.
      const teacherSummaries = profiles
        .filter((p) => p.role === "teacher" || p.role === "admin")
        .map((p) => {
          const theirClassIds = classesByTeacher[p.auth_user_id] || [];
          const studentSet = new Set();
          theirClassIds.forEach((cid) =>
            (studentsByClass[cid] || []).forEach((sid) =>
              studentSet.add(sid)
            )
          );
          return {
            authUserId: p.auth_user_id,
            name: p.display_name || "Unnamed",
            role: p.role,
            classCount: theirClassIds.length,
            studentCount: studentSet.size,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      // Flat roster — one row per (class, student).
      const roster = memberships
        .map((m) => {
          const s = studentById[m.student_id];
          if (!s) return null;
          const cls = classById[m.class_id];
          const teacherProfile = cls
            ? profileByAuthId[cls.teacher_user_id]
            : null;
          return {
            id: s.id,
            rowKey: `${m.class_id}:${s.id}`,
            name: studentName(s),
            grade:
              s.grade ||
              (s.grade_level != null ? String(s.grade_level) : ""),
            classId: m.class_id,
            className: cls ? cls.name : "Class",
            teacherName: teacherProfile ? teacherProfile.display_name : null,
            // Existing Math Academy link, if any. `externalId === null`
            // means unlinked. The admin's inline editor reads + writes
            // this through /api/link-student-app-account.
            mathAcademyLink: mathAcademyLinks[s.id] || {
              externalId: null,
              enabled: false,
            },
            apps: [],
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));

      // 5. Fan out per-student snapshots, deduplicating on studentId
      //    so a student in multiple classes only fetches once.
      const uniqueStudentIds = [...new Set(roster.map((r) => r.id))];
      const appsById = {};
      await mapWithConcurrency(
        uniqueStudentIds,
        SNAPSHOT_CONCURRENCY,
        async (sid) => {
          try {
            appsById[sid] = await fetchAllSnapshots({
              signal: controller.signal,
              studentId: sid,
            });
          } catch {
            appsById[sid] = [];
          }
        }
      );
      roster.forEach((r) => {
        r.apps = appsById[r.id] || [];
      });

      if (controller.signal.aborted) return;
      setClasses(classSummaries);
      setTeachers(teacherSummaries);
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

  return {
    classes,
    teachers,
    students,
    loading,
    error,
    lastUpdated,
    refresh,
  };
}
