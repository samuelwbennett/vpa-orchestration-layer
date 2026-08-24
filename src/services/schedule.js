// =====================================================
// Schedule service — Jackson's semester schedule
// -----------------------------------------------------
// Reads the shared Google Sheet ("Jackson_Semester1_Schedule") LIVE in
// the browser via Google's gviz CSV endpoint. The sheet is
// link-viewable, and gviz serves CSV with permissive CORS, so no API
// key, proxy, or backend is involved.
//
//   https://docs.google.com/spreadsheets/d/{sheetId}/gviz/tq
//       ?tqx=out:csv&sheet={tabName}
//
// We fetch only the "Semester Calendar" tab: Skip's Kula/ski/rehab
// entries are pulled onto that tab by in-sheet formulas, so one fetch
// carries school days, check-ins, robotics, cardio, and all of Skip's
// dates. If the fetch fails (offline, sharing changed), callers get a
// { days: [], _degraded: true } and the panel renders a quiet notice —
// never fabricated schedule data.
//
// Calendar tab columns (header row, matched loosely by keyword so
// cosmetic renames in the sheet don't break parsing):
//   Date | Day | School | Check-in | Robotics | Cardio |
//   Kula/Rehab | Ski | Other | Notes | Done
// =====================================================

import { config } from "./config.js";

// Same-every-day Google Meet link for the 9 AM travel check-ins (from
// the sheet's Key Info tab; the calendar cells just say "Google Meet").
export const CHECKIN_MEET_URL = "https://meet.google.com/dci-zgeb-exc";

export function csvUrl() {
  const { sheetId, calendarTab } = config.schedule;
  return (
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(calendarTab)}`
  );
}

export async function fetchSchedule({ signal } = {}) {
  try {
    const res = await fetch(csvUrl(), { signal });
    if (!res.ok) throw new Error(`schedule sheet HTTP ${res.status}`);
    const text = await res.text();
    const days = parseCalendarCsv(text);
    if (days.length === 0) throw new Error("schedule sheet parsed to 0 rows");
    return { days, fetchedAt: new Date() };
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    console.warn("[schedule] sheet unavailable, degrading:", err);
    return { days: [], fetchedAt: null, _degraded: true };
  }
}

// Should this student's dashboard show the schedule panel?
// Match by UUID when configured, otherwise by display-name prefix
// (default "Jackson") so it works before we wire up his UUID.
export function shouldShowSchedule(student) {
  const cfg = config.schedule;
  if (!cfg?.enabled || !student) return false;
  if (cfg.studentIds.length > 0) return cfg.studentIds.includes(student.id);
  const name = (student.display_name || "").trim().toLowerCase();
  return name.startsWith(cfg.studentNamePrefix.toLowerCase());
}

// ---------- selection helpers ----------

export function findToday(days, now = new Date()) {
  const iso = toIso(now);
  return days.find((d) => d.iso === iso) || null;
}

// Next `n` calendar rows strictly after today (sheet rows are school
// weekdays only, so weekends skip themselves).
export function findUpcoming(days, n = 5, now = new Date()) {
  const iso = toIso(now);
  return days.filter((d) => d.iso > iso).slice(0, n);
}

// ---------- parsing ----------

function parseCalendarCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  // Locate the header row (first row whose first cell is "Date").
  const headerIdx = rows.findIndex(
    (r) => (r[0] || "").trim().toLowerCase() === "date"
  );
  if (headerIdx === -1) return [];
  const header = rows[headerIdx].map((h) => h.trim().toLowerCase());

  const col = (keyword) => header.findIndex((h) => h.includes(keyword));
  const cols = {
    date: col("date"),
    day: col("day"),
    school: col("school"),
    checkin: col("check-in"),
    robotics: col("robotics"),
    cardio: col("cardio"),
    kula: col("kula"),
    // startsWith, not includes: every "(from Skip)" header contains
    // the substring "ski", so includes() would grab the Kula column.
    ski: header.findIndex((h) => h.startsWith("ski")),
    other: col("other"),
    notes: col("notes"),
    done: col("done")
  };

  const out = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const rawDate = (r[cols.date] || "").trim();
    if (!rawDate) continue;
    const date = parseSheetDate(rawDate);
    if (!date) continue;

    const cell = (k) => (cols[k] >= 0 ? (r[cols[k]] || "").trim() : "");
    out.push({
      iso: toIso(date),
      date,
      rawDate,
      dayName: cell("day"),
      school: cell("school"),
      checkin: cell("checkin"),
      robotics: cell("robotics"),
      cardio: cell("cardio"),
      kula: cell("kula"),
      ski: cell("ski"),
      other: cell("other"),
      notes: cell("notes"),
      done: cell("done") !== ""
    });
  }
  return out;
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

// "Aug 24" / "Dec 18" → Date. The sheet omits the year, so infer it:
// start from the current year and, if that lands more than ~6 months
// in the past, roll forward a year (keeps a spring-semester sheet
// working when viewed in the preceding December, and vice versa).
function parseSheetDate(raw, now = new Date()) {
  const m = raw.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2})$/);
  if (!m) {
    // Also accept full dates like 8/24/2026 or 2026-08-24.
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  const dayNum = parseInt(m[2], 10);

  let d = new Date(now.getFullYear(), month, dayNum);
  const HALF_YEAR = 183 * 24 * 3600 * 1000;
  if (d.getTime() < now.getTime() - HALF_YEAR) {
    d = new Date(now.getFullYear() + 1, month, dayNum);
  } else if (d.getTime() > now.getTime() + HALF_YEAR) {
    d = new Date(now.getFullYear() - 1, month, dayNum);
  }
  return d;
}

function toIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Minimal RFC-4180-ish CSV parser (handles quoted cells, embedded
// commas, doubled quotes, and newlines inside quotes).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell); cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}
