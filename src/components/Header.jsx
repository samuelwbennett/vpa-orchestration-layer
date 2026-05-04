import React from "react";
import { RefreshCw } from "lucide-react";

/**
 * Header
 *  - Eyebrow: today's date + "Today's Learning Plan"
 *  - Title: greeting w/ student name
 *  - Right: On-Track pill + "last updated" + refresh button
 */
export default function Header({
  studentName,
  onTrackStatus,
  onTrackLabel,
  lastUpdated,
  onRefresh,
  refreshing
}) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  return (
    <header className="header">
      <div className="header-left">
        <div className="eyebrow">{today} · Today's Learning Plan</div>
        <h1>Good {greeting()}, {studentName}.</h1>
        <div className="student">Here's what to focus on right now.</div>
      </div>

      <div className="header-right">
        <div className={`on-track ${onTrackStatus}`}>
          <span className="dot" />
          {onTrackLabel}
        </div>

        <button
          className="refresh-btn"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh app data"
        >
          <RefreshCw
            size={13}
            className={refreshing ? "spinning" : ""}
          />
          {lastUpdated ? `Updated ${formatAgo(lastUpdated)}` : "Refresh"}
        </button>
      </div>
    </header>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function formatAgo(date) {
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}
