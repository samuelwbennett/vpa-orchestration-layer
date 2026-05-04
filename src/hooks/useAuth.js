// =====================================================
// useAuth
// -----------------------------------------------------
// Owns the dashboard's auth lifecycle. Returns:
//   - session:  Supabase session or null
//   - student:  the linked student row (via students.auth_user_id) or null
//   - status:   "loading" | "anonymous" | "unlinked" | "ready"
//   - signOut:  helper to sign out (clears local state + Supabase session)
//   - refresh:  re-resolve the linked student (useful after admin link)
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSession,
  onAuthChange,
  signOut as authSignOut,
  fetchLinkedStudent,
} from "../services/auth.js";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [student, setStudent] = useState(null);
  const [status, setStatus] = useState("loading");
  const mountedRef = useRef(true);

  const resolveLinked = useCallback(async (sess) => {
    if (!sess) {
      if (!mountedRef.current) return;
      setStudent(null);
      setStatus("anonymous");
      return;
    }
    const linked = await fetchLinkedStudent();
    if (!mountedRef.current) return;
    setStudent(linked);
    setStatus(linked ? "ready" : "unlinked");
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let unsubscribe = () => {};

    (async () => {
      const sess = await getSession();
      if (!mountedRef.current) return;
      setSession(sess);
      await resolveLinked(sess);
    })();

    unsubscribe = onAuthChange(async (newSession) => {
      if (!mountedRef.current) return;
      setSession(newSession);
      await resolveLinked(newSession);
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [resolveLinked]);

  const signOut = useCallback(async () => {
    await authSignOut();
    // onAuthChange will fire and update state.
  }, []);

  const refresh = useCallback(async () => {
    await resolveLinked(session);
  }, [resolveLinked, session]);

  return { session, student, status, signOut, refresh };
}
