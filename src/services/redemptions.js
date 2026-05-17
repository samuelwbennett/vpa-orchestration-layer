// =====================================================
// Redemptions service — admin-side calls to reading-academy's
// fulfillment endpoints.
//
// Both endpoints validate the caller's role server-side (admin
// required), so this layer just forwards the JWT.
// =====================================================

import { supabase } from "./supabaseClient.js";
import { config } from "./config.js";

const baseUrl = () => config.readingAcademy.baseUrl;

async function authedFetch(url, options = {}) {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session) throw new Error("not signed in");

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers || {}),
    },
  });

  let payload = null;
  try { payload = await res.json(); } catch { /* no body */ }

  if (!res.ok) {
    const msg =
      (payload && (payload.error || payload.details)) ||
      `request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

// Admin-only: every pending redemption in the admin's org, newest
// first. Returns `[{ id, total_dollars, store_amount,
// scholarship_amount, note, redeemed_at, status, student: {id,
// display_name} }]`.
export async function listPendingRedemptions() {
  const out = await authedFetch(`${baseUrl()}/api/list-pending-redemptions`, {
    method: "GET",
  });
  return Array.isArray(out?.redemptions) ? out.redemptions : [];
}

// Admin-only: mark a pending redemption fulfilled (admin paid out
// the cash) or cancelled (student backed out, balance refunds).
// `action` is "fulfill" or "cancel".
export async function fulfillRedemption({ redemptionId, action }) {
  return authedFetch(`${baseUrl()}/api/fulfill-redemption`, {
    method: "POST",
    body: JSON.stringify({ redemptionId, action }),
  });
}
