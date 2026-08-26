// =====================================================
// ASU Prep adapter (Canvas LMS)
// -----------------------------------------------------
// ASU Prep runs its own student dashboard which links through to
// Canvas (asuprep.instructure.com). We do NOT have API access yet, so
// this adapter ships in "link-only" mode: the ring is a launcher into
// ASU Prep's dashboard, contributes no XP, and never affects the
// on-track calculation (dailyGoal 0 + status "link_only" are both
// excluded everywhere).
//
// === Future proxy contract (when ASU Prep / Canvas access lands) ===
//
// Canvas has a full REST API. The plan mirrors the Math Academy proxy:
// a Canvas access token lives server-side on math-facts-trainer
// (env CANVAS_API_TOKEN + CANVAS_BASE_URL), and the proxy exposes:
//
//   GET {apiBaseUrl}/api/asu-prep/snapshot?student=<vpa-uuid>
//
//   Response 200 (application/json):
//   {
//     "coursesActive":   number,   // enrolled, currently running
//     "assignmentsDue":  number,   // due in the next 7 days
//     "missing":         number,   // Canvas missing_submissions count
//     "nextUp": {
//       "label":  string,          // e.g. "ELA — Essay draft due Thu"
//       "url":    string           // absolute Canvas deep link
//     }
//   }
//
// Useful Canvas endpoints for the proxy side:
//   /api/v1/users/self/courses?enrollment_state=active
//   /api/v1/users/self/upcoming_events
//   /api/v1/users/self/missing_submissions
//   /api/v1/users/self/planner/items
//
// The proxy translates the VPA student UUID → Canvas user the same way
// the MA proxy does (student_app_accounts, learning_apps slug
// "asu_prep"). Until the endpoint exists, the fetch 404s and we fall
// through to link-only — no code change needed on launch day, the real
// numbers just start appearing in the tooltip.
// =====================================================

import { config } from "./config.js";
import { getJSON } from "./apiClient.js";

const APP_ID = "asu-prep";
const APP_NAME = "ASU Prep";

export async function fetchSnapshot({ signal, studentId } = {}) {
  const { apiBaseUrl, snapshotPath, deepLinkBaseUrl } = config.asuPrep;
  const sid = studentId || config.asuPrep.studentId;
  const url = `${apiBaseUrl}${snapshotPath}?student=${encodeURIComponent(sid)}`;

  try {
    const data = await getJSON(url, { signal });
    // Proxy is live — surface Canvas info in the tooltip. Still no
    // XP/goal semantics (Canvas work isn't XP), so the ring stays a
    // link-only launcher; the tooltip line carries the substance.
    const parts = [];
    if (Number(data.assignmentsDue) > 0) {
      parts.push(`${data.assignmentsDue} due this week`);
    }
    if (Number(data.missing) > 0) {
      parts.push(`${data.missing} missing`);
    }
    return {
      id: APP_ID,
      name: APP_NAME,
      dailyGoal: 0,
      todayXP: 0,
      weeklyXP: 0,
      status: "link_only",
      link: data.nextUp?.url || deepLinkBaseUrl,
      nextLesson:
        data.nextUp?.label ||
        (parts.length ? parts.join(" · ") : null)
    };
  } catch (err) {
    // Expected until the Canvas proxy exists — quiet, not _degraded
    // (degraded implies "normally live but unreachable right now",
    // which would put a scary banner on every load).
    return {
      id: APP_ID,
      name: APP_NAME,
      dailyGoal: 0,
      todayXP: 0,
      weeklyXP: 0,
      status: "link_only",
      link: deepLinkBaseUrl,
      nextLesson: "School block 8:00–12:00 on school days"
    };
  }
}

// Per-course completion + pacing for the ASU Courses section.
// Same combined proxy function, ?view=progress. Shape (per course):
//   { id, name, htmlUrl,
//     completionPct,                  // assignments submitted / total
//     assignmentsTotal, assignmentsSubmitted,
//     currentScore, currentGrade,
//     startAt, endAt,
//     expectedPct, paceDeltaPct, paceDeltaDays }
//
// Degraded (proxy down / token revoked) → { courses: [], _degraded }
// so the section renders a quiet notice, never fabricated progress.
export async function fetchProgress({ signal, studentId } = {}) {
  const { apiBaseUrl, snapshotPath } = config.asuPrep;
  const sid = studentId || config.asuPrep.studentId;
  const url =
    `${apiBaseUrl}${snapshotPath}?view=progress` +
    `&student=${encodeURIComponent(sid)}`;
  try {
    const data = await getJSON(url, { signal });
    return {
      courses: Array.isArray(data?.courses) ? data.courses : [],
      asOf: data?.asOf || null
    };
  } catch (err) {
    console.warn("[asuPrep] progress endpoint unavailable:", err);
    return { courses: [], asOf: null, _degraded: true };
  }
}
