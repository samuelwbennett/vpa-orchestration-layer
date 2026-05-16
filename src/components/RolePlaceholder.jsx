import React from "react";

/**
 * RolePlaceholder — a clean, Apple-simple holding screen for the
 * teacher / admin / parent roles. Their full experiences ship in
 * later steps of UNIFIED-EXPERIENCE-BLUEPRINT.md; until then, a
 * signed-in teacher / admin / parent lands here instead of hitting
 * the student dashboard or a dead-end.
 */
const COPY = {
  teacher: {
    title: "Teacher view",
    line: "Your roster and intervention queue — who needs you today — are coming next.",
  },
  admin: {
    title: "Admin view",
    line: "Program health and provisioning for your organization are coming soon.",
  },
  parent: {
    title: "Family view",
    line: "A simple window into your child's progress is coming soon.",
  },
};

export default function RolePlaceholder({ role, email, onSignOut }) {
  const copy =
    COPY[role] || { title: "Welcome", line: "Your experience is being set up." };

  return (
    <div className="login-shell">
      <div className="login-card" style={{ textAlign: "center" }}>
        <div className="brand-mark">VPA</div>
        <h1 className="login-title">{copy.title}</h1>
        <p className="login-sub">{copy.line}</p>
        {email && (
          <p
            className="login-sub"
            style={{ fontSize: "13px", marginTop: "4px" }}
          >
            Signed in as <strong>{email}</strong>
          </p>
        )}
        <div className="login-actions" style={{ marginTop: "20px" }}>
          <button type="button" className="link-btn" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
