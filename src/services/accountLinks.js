// =====================================================
// Account-links service — admin-side calls to reading-academy's
// link-student-app-account endpoint. Used by AdminView's per-student
// "Math Academy ID" inline editor.
//
// The server enforces admin role + org scope; this layer just
// forwards the JWT.
// =====================================================

import { supabase } from "./supabaseClient.js";
import { config } from "./config.js";

const baseUrl = () => config.readingAcademy.baseUrl;

async function authedPost(url, body) {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session) throw new Error("not signed in");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body || {}),
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

/**
 * Link a VPA student to their external account id (today only used
 * for math_academy). Pass `externalId: null` (or empty string) to
 * unlink — the row stays but enabled flips to false so the proxy
 * + cron skip the student.
 */
export function linkStudentAppAccount({ studentId, slug, externalId, enabled }) {
  return authedPost(`${baseUrl()}/api/link-student-app-account`, {
    studentId,
    slug,
    externalId: externalId === "" ? null : externalId,
    enabled,
  });
}
