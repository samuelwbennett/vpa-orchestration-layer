// =====================================================
// useAuth — role-aware auth lifecycle for the VPA Learning OS.
// -----------------------------------------------------
// Returns:
//   - session:  Supabase session or null
//   - role:     "student" | "teacher" | "admin" | "parent" | null
//   - profile:  the user_profiles row, or null (bridge / fallback)
//   - student:  the linked students row (populated when role === "student")
//   - status:   "loading" | "anonymous" | "unlinked" | "ready"
//   - signOut:  helper to sign out
//   - refresh:  re-resolve the signed-in user (e.g. after provisioning)
//
// Role resolution goes through the server-controlled /api/provision-self
// endpoint: it's idempotent, creates the user_profiles row on first
// sign-in (the bridge backfill, done lazily per user), and decides the
// role server-side. If that call fails, useAuth falls back to the
// legacy student-only path so the dashboard never hard-breaks.
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSession,
  onAuthChange,
  signOut as authSignOut,
  provisionSelf,
  fetchLinkedStudent,
} from "../services/auth.js";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [student, setStudent] = useState(null);
  const [status, setStatus] = useState("loading");
  const mountedRef = useRef(true);

  const resolve = useCallback(async (sess) => {
    if (!sess) {
      if (!mountedRef.current) return;
      setProfile(null);
      setRole(null);
      setStudent(null);
      setStatus("anonymous");
      return;
    }

    // Primary path: server-controlled provisioning. Idempotent — it
    // creates the user_profiles row if missing and returns the role.
    try {
      const result = await provisionSelf();
      if (!mountedRef.current) return;
      if (result && result.profile) {
        setProfile(result.profile);
        setRole(result.profile.role);
        setStudent(result.student || null);
        // A student with no roster assignment yet is treated as
        // "unlinked"; every other resolved role is "ready".
        const ready = !(
          result.profile.role === "student" && !result.student
        );
        setStatus(ready ? "ready" : "unlinked");
        return;
      }
    } catch (err) {
      console.warn(
        "[useAuth] provision-self failed, using fallback:",
        err?.message || err
      );
    }

    // Fallback (bridge safety net): legacy student-only resolution,
    // so the student dashboard keeps working if provision-self is
    // unreachable.
    const linked = await fetchLinkedStudent();
    if (!mountedRef.current) return;
    setProfile(null);
    if (linked) {
      setRole("student");
      setStudent(linked);
      setStatus("ready");
    } else {
      setRole(null);
      setStudent(null);
      setStatus("unlinked");
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let unsubscribe = () => {};

    (async () => {
      const sess = await getSession();
      if (!mountedRef.current) return;
      setSession(sess);
      await resolve(sess);
    })();

    unsubscribe = onAuthChange(async (newSession) => {
      if (!mountedRef.current) return;
      setSession(newSession);
      await resolve(newSession);
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [resolve]);

  const signOut = useCallback(async () => {
    await authSignOut();
    // onAuthChange will fire and update state.
  }, []);

  const refresh = useCallback(async () => {
    await resolve(session);
  }, [resolve, session]);

  return { session, profile, role, student, status, signOut, refresh };
}
