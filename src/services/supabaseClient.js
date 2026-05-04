// =====================================================
// Supabase browser client (anon key — safe to expose).
//
// The dashboard's data reads still go through serverless proxies on
// math-facts-trainer.vercel.app and reading-facts-app.vercel.app —
// those run server-side with the service-role key. The browser only
// uses Supabase directly for AUTH (sign-in/out + reading the current
// student's own row via RLS).
//
// Anon key is safe to ship in the bundle: RLS policies decide what a
// signed-in user can see. The "real" service-role secret is server-
// side only and never reaches the browser.
// =====================================================

import { createClient } from "@supabase/supabase-js";

const env = import.meta.env || {};

// Default to the same Supabase project the rest of VPA uses.
const SUPABASE_URL =
  env.VITE_SUPABASE_URL || "https://dtkrnyberbpfdmikpdnw.supabase.co";

// Anon key for that project (matches the value in
// reading-facts-app/src/supabase.js — they share an auth surface).
const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0a3JueWJlcmJwZmRtaWtwZG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MDE0MzIsImV4cCI6MjA5MzM3NzQzMn0.oElhVtcEbq8nDBBFzpsTdfDcSGO1b6TLBclKFxBAUC8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
