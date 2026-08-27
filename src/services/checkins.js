// =====================================================
// Daily check-ins — the two-tap CR-10 effort ratings.
// -----------------------------------------------------
// Direct Supabase under RLS, same trust model as learning_sessions.
// One row per (student, local day); saving again the same day
// upserts, so re-rating in the evening just replaces the numbers.
// =====================================================

import { supabase } from "./supabaseClient.js";

// Local calendar day as YYYY-MM-DD (the student's own clock, matching
// the rest of the dashboard's "today" semantics).
export function localDay(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function saveCheckin({ studentId, day, mindRpe, bodyRpe }) {
  const { data, error } = await supabase
    .from("daily_checkins")
    .upsert(
      {
        student_id: studentId,
        day: day || localDay(),
        mind_rpe: mindRpe ?? null,
        body_rpe: bodyRpe ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,day" }
    )
    .select()
    .maybeSingle();

  if (error) {
    console.warn("[checkins] save failed:", error.message);
    return null;
  }
  return data;
}

// Check-ins for the trailing window (default 28 days incl. today).
export async function fetchCheckins({ studentId, days = 28 }) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const { data, error } = await supabase
    .from("daily_checkins")
    .select("day, mind_rpe, body_rpe")
    .eq("student_id", studentId)
    .gte("day", localDay(since))
    .order("day", { ascending: true });

  if (error) {
    console.warn("[checkins] fetch failed:", error.message);
    return { checkins: [], _degraded: true };
  }
  return { checkins: data || [] };
}
