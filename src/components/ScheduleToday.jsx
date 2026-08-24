import React from "react";
import {
  GraduationCap,
  Video,
  Bot,
  HeartPulse,
  Activity,
  Snowflake,
  CalendarDays,
  ExternalLink
} from "lucide-react";
import { useSchedule } from "../hooks/useSchedule.js";
import {
  findToday,
  findUpcoming,
  CHECKIN_MEET_URL
} from "../services/schedule.js";
import { config } from "../services/config.js";

/**
 * ScheduleToday — Jackson's day, straight from the shared Google Sheet
 * (the one Dan, Skip, and Sam edit). Shows today's blocks — school,
 * 9 AM check-in (with the Meet link), robotics, cardio, and anything
 * Skip entered (Kula / ski / rehab) — plus a compact look-ahead.
 *
 * Data flows live: Skip adds a date on the sheet, it appears here on
 * the next refresh without a deploy.
 */
export default function ScheduleToday() {
  const { days, degraded } = useSchedule(true);

  if (days === null) {
    return (
      <div className="card" style={{ color: "var(--text-muted)" }}>
        Loading schedule…
      </div>
    );
  }

  if (degraded || days.length === 0) {
    return (
      <div className="card" style={{ color: "var(--text-muted)" }}>
        Couldn't reach the schedule sheet just now — it'll retry on its
        own. You can always open it directly:{" "}
        <a
          href={sheetEditUrl()}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--blue)" }}
        >
          Semester 1 schedule
        </a>
        .
      </div>
    );
  }

  const today = findToday(days);
  const upcoming = findUpcoming(days, 4);

  return (
    <div className="card schedule-card">
      <div className="schedule-head">
        <div>
          <div className="schedule-date">{formatLongDate(new Date())}</div>
          {today?.notes && <div className="schedule-note">{today.notes}</div>}
        </div>
        <a
          className="schedule-sheet-link"
          href={sheetEditUrl()}
          target="_blank"
          rel="noreferrer"
        >
          Open sheet <ExternalLink size={13} />
        </a>
      </div>

      {today ? (
        <div className="schedule-blocks">
          <Block
            icon={<GraduationCap size={16} />}
            label="School"
            value={today.school || "—"}
            tone={schoolTone(today.school)}
          />
          {today.checkin && (
            <Block
              icon={<Video size={16} />}
              label="Check-in"
              value={today.checkin}
              action={
                <a
                  className="btn-secondary schedule-join"
                  href={CHECKIN_MEET_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Join
                </a>
              }
            />
          )}
          {today.robotics && (
            <Block
              icon={<Bot size={16} />}
              label="Robotics"
              value={today.robotics}
              tone={/^no robotics/i.test(today.robotics) ? "muted" : undefined}
            />
          )}
          {today.cardio && (
            <Block
              icon={<HeartPulse size={16} />}
              label="Cardio"
              value={today.cardio}
              tone={/break|travel/i.test(today.cardio) ? "muted" : undefined}
            />
          )}
          {today.kula && (
            <Block icon={<Activity size={16} />} label="Kula / Rehab" value={today.kula} />
          )}
          {today.ski && (
            <Block icon={<Snowflake size={16} />} label="Ski" value={today.ski} />
          )}
          {today.other && (
            <Block icon={<CalendarDays size={16} />} label="Other" value={today.other} />
          )}
        </div>
      ) : (
        <div className="schedule-weekend">
          Nothing scheduled today — weekends are ski training, family, and
          rest.
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="schedule-upcoming">
          <div className="schedule-upcoming-title">Coming up</div>
          {upcoming.map((d) => (
            <div key={d.iso} className="schedule-upcoming-row">
              <span className="schedule-upcoming-date">
                {d.rawDate} · {d.dayName}
              </span>
              <span className="schedule-upcoming-items">
                {upcomingSummary(d)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Block({ icon, label, value, tone, action }) {
  return (
    <div className={`schedule-block${tone ? ` ${tone}` : ""}`}>
      <span className="schedule-block-icon">{icon}</span>
      <span className="schedule-block-label">{label}</span>
      <span className="schedule-block-value">{value}</span>
      {action}
    </div>
  );
}

function schoolTone(school) {
  if (!school) return undefined;
  if (/^no school/i.test(school)) return "gold";
  if (/remote|travel/i.test(school)) return "orange";
  return undefined;
}

// One calm line per upcoming day: lead with whatever is unusual,
// fall back to the cardio rotation.
function upcomingSummary(d) {
  const bits = [];
  if (/^no school/i.test(d.school)) bits.push(d.school);
  if (/remote|travel/i.test(d.school)) bits.push(d.school);
  if (d.checkin) bits.push("9 AM check-in");
  if (d.robotics && !/^no robotics/i.test(d.robotics)) bits.push("Robotics 12–3");
  if (d.kula) bits.push(d.kula);
  if (d.ski) bits.push(d.ski);
  if (d.other) bits.push(d.other);
  if (d.notes) bits.push(d.notes);
  if (bits.length === 0 && d.cardio) bits.push(d.cardio);
  return bits.join(" · ") || "Regular school day";
}

function sheetEditUrl() {
  return `https://docs.google.com/spreadsheets/d/${config.schedule.sheetId}/edit`;
}

function formatLongDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}
