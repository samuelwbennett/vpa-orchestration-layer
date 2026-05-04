import React from "react";
import { signOut } from "../services/auth.js";

/**
 * AccountUnlinked — shown when a Supabase auth user signs in but no
 * students.auth_user_id row points at them. The student needs to be
 * linked by an admin (run public.link_student_auth in the SQL editor).
 */
export default function AccountUnlinked({ email, onRefresh }) {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand-mark">VPA</div>
        <h1 className="login-title">Account isn't linked yet</h1>
        <p className="login-sub">
          You're signed in as <strong>{email || "this account"}</strong>, but
          no student profile is connected to it yet. Ask your admin to link
          your account, then refresh this page.
        </p>
        <div className="login-actions">
          <button type="button" className="btn-primary" onClick={onRefresh}>
            I'm linked now — try again
          </button>
          <button type="button" className="link-btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
