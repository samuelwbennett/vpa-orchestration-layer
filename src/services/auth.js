// =====================================================
// Auth wrappers for the dashboard. Mirrors the same shape as
// reading-facts-app/src/auth.js so behaviors stay consistent.
// =====================================================

import { supabase } from "./supabaseClient.js";
import { config } from "./config.js";

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, newSession) => {
    callback(newSession);
  });
  return () => subscription.unsubscribe();
}

export async function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithMagicLink(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

// Resolve the student row tied to the currently-signed-in auth user.
// Returns the student record or null if the auth account isn't yet
// linked to a student. Used by the dashboard's auth gate.
export async function fetchLinkedStudent() {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return null;

  const { data: student, error } = await supabase
    .from("students")
    .select("id, display_name, grade_level, auth_user_id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (error) {
    console.warn("[auth] fetchLinkedStudent failed:", error.message);
    return null;
  }
  return student || null;
}

// Server-controlled provisioning. POSTs the current session's JWT to
// /api/provision-self, which idempotently creates the caller's
// user_profiles row if missing (role decided server-side) and returns
// { ok, isNew, roleChanged, profile, student, status }. This is how
// the orchestration layer learns a signed-in user's role. Returns null
// when there's no session; throws on a non-OK response so the caller
// can fall back.
export async function provisionSelf() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session) return null;

  const res = await fetch(config.provisionSelfUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: "{}",
  });
  if (!res.ok) {
    throw new Error(`provision-self responded ${res.status}`);
  }
  return res.json();
}
