import React, { useState } from "react";
import { updatePassword } from "../services/auth.js";

/**
 * ResetPassword — shown when the user arrives via a password-reset link.
 *
 * By the time this renders, Supabase has already turned the recovery
 * token in the URL into a session, so updateUser({ password }) can set a
 * new password without asking for the old one. App.jsx gates on the
 * `recovery` flag from useAuth and renders this ahead of the dashboard.
 */
const MIN_LENGTH = 8;

export default function ResetPassword({ email, onDone, onCancel }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < MIN_LENGTH) {
      setErrorMsg(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setErrorMsg("The two passwords don't match.");
      return;
    }

    setErrorMsg("");
    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);

    if (error) {
      setErrorMsg(
        error.message || "Couldn't update your password. Try again."
      );
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="brand-mark">VPA</div>
          <h1 className="login-title">Password updated</h1>
          <p className="login-sub">
            Your new password is set
            {email ? (
              <>
                {" "}
                for <strong>{email}</strong>
              </>
            ) : null}
            . You're signed in now — use it next time you log in.
          </p>
          <button
            type="button"
            className="btn-primary login-submit"
            onClick={onDone}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand-mark">VPA</div>
        <h1 className="login-title">Choose a new password</h1>
        <p className="login-sub">
          {email ? (
            <>
              Setting a new password for <strong>{email}</strong>.
            </>
          ) : (
            "Set a new password for your account."
          )}
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type="password"
            className="login-input"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
            autoFocus
          />
          <input
            type="password"
            className="login-input"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
          />
          <button
            type="submit"
            className="btn-primary login-submit"
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Save new password"}
          </button>
          {errorMsg && <div className="login-error">{errorMsg}</div>}
        </form>

        {/* Escape hatch: this screen renders whenever the URL carries
            ?mode=reset-password — including for someone who has no
            active recovery session and can't actually set a password
            here. Without this link they'd be stranded on a dead-end
            form. Clears the recovery flag and returns to sign-in. */}
        {onCancel && (
          <button type="button" className="link-btn" onClick={onCancel}>
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
