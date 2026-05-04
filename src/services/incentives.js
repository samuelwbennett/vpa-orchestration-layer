// =====================================================
// Incentives service — fetches earnings + posts redemptions.
// Talks to math-facts-trainer.vercel.app/api/incentives.
// =====================================================

import { config } from "./config.js";
import { getJSON } from "./apiClient.js";

const PATH = "/api/incentives";

export async function fetchIncentives({ signal, studentId }) {
  const baseUrl = config.mathFacts.baseUrl;
  const sid = studentId || config.studentId;
  const url = `${baseUrl}${PATH}?student=${encodeURIComponent(sid)}`;
  return getJSON(url, { signal });
}

// Submits a redemption. Returns the created row from the proxy.
export async function postRedemption({ studentId, totalDollars, storeAmount, scholarshipAmount, note }) {
  const baseUrl = config.mathFacts.baseUrl;
  const sid = studentId || config.studentId;
  const url = `${baseUrl}${PATH}?student=${encodeURIComponent(sid)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      totalDollars,
      storeAmount,
      scholarshipAmount,
      note: note || null,
    }),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error || ""; } catch { /* ignore */ }
    throw new Error(`redemption failed: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
  }
  return res.json();
}
