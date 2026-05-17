// =====================================================
// Registration service — admin-side calls to reading-academy's
// provisioning endpoints. Used by the AdminView's RegistrationPanel.
//
// All calls validate the caller's role server-side (admin / teacher)
// before doing anything, so this layer just forwards the JWT.
// =====================================================

import { supabase } from "./supabaseClient.js";
import { config } from "./config.js";

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
  try {
    payload = await res.json();
  } catch {
    /* response had no JSON body */
  }

  // 207 = partial success (bulk endpoints). Treat as resolved so the
  // UI can surface the per-row results.
  if (!res.ok && res.status !== 207) {
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

const baseUrl = () => config.readingAcademy.baseUrl;

// Admin-only: create a teacher_classes row owned by a specific teacher.
export function createClass({ name, gradeLevel, teacherUserId }) {
  return authedPost(`${baseUrl()}/api/create-class`, {
    name,
    gradeLevel,
    teacherUserId,
  });
}

// Bulk-create students and enroll them into a class. Per-row failures
// don't abort the batch — the response has a `results[]` with the
// invite URL (or error) for each.
export function bulkAddStudents({ classId, students, expiresInHours }) {
  return authedPost(`${baseUrl()}/api/bulk-provision-students`, {
    classId,
    students,
    expiresInHours,
  });
}
