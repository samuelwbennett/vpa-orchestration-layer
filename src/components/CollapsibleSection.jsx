import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * CollapsibleSection — a dashboard section whose body can be folded
 * away. Collapsed state persists per-section in localStorage so the
 * page comes back the way the student left it.
 *
 * Props:
 *   id             stable key for persistence (e.g. "knowledge-graph")
 *   title          section title text
 *   defaultOpen    initial state when nothing is stored (default false)
 *   summary        optional short text shown next to the title while
 *                  collapsed (e.g. "42 topics · 12 mastered")
 */
export default function CollapsibleSection({
  id,
  title,
  defaultOpen = false,
  summary = null,
  children,
}) {
  const storageKey = `vpa.section.${id}.open`;
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "1") return true;
      if (stored === "0") return false;
    } catch {
      /* private mode */
    }
    return defaultOpen;
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="section">
      <button
        type="button"
        className="section-toggle"
        onClick={toggle}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <h2 className="section-title collapsible">{title}</h2>
        {!open && summary && (
          <span className="section-toggle-summary">{summary}</span>
        )}
      </button>
      {open && children}
    </section>
  );
}
