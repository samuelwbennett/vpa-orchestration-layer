import React, { useState } from "react";
import {
  signInWithPassword,
  signInWithMagicLink,
  sendPasswordReset,
} from "../services/auth.js";

// Students log in with a bare username (e.g. "jacksonleever") and have a
// synthesized, non-deliverable email on file. Teachers/admins use their
// real email. Normalize: if the entered value has no "@", treat it as a
// student username and append the student domain. Anything containing
// "@" is passed through untouched (real email).
const STUDENT_EMAIL_DOMAIN = "@students.elevateedwards.com";

function toLoginEmail(value) {
  const v = value.trim().toLowerCase();
  if (!v) return v;
  return v.includes("@") ? v : v + STUDENT_EMAIL_DOMAIN;
}

/**
 * Login — email + password with a magic-link fallback and a
 * "Forgot password?" flow that emails a reset link.
 *
 * Modes:
 *   - "password" — email + password (no email sent, no rate limit)
 *   - "magic"    — email-only, Supabase mails a one-time sign-in link
 *   - "reset"    — email-only, Supabase mails a password-reset link
 *
 * Mirrors the reading-facts and math-facts apps' auth UX so a user who
 * can sign in there can sign in here with the same credentials.
 */
export default function Login() {
  const [mode, setMode] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email) return;
    if (mode === "password" && password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setErrorMsg("");
    setSubmitting(true);

    let result;
    if (mode === "password") {
      result = await signInWithPassword(toLoginEmail(email), password);
    } else if (mode === "magic") {
      result = await signInWithMagicLink(email.trim());
    } else {
      result = await sendPasswordReset(email.trim());
    }

    setSubmitting(false);

    if (result.error) {
      setErrorMsg(result.error.message || "Something went wrong. Try again.");
      return;
    }

    if (mode === "magic") setMagicSent(true);
    if (mode === "reset") setResetSent(true);
    // For password mode, onAuthStateChange flips the dashboard to the
    // signed-in view automatically — nothing more to do here.
  }

  // ---- confirmation: magic link sent ----
  if (magicSent) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="brand-mark">VPA</div>
          <h1 className="login-title">Check your email</h1>
          <p className="login-sub">
            We sent a one-time sign-in link to <strong>{email}</strong>. Tap it
            on this device to continue.
          </p>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMagicSent(false);
              setEmail("");
            }}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  // ---- confirmation: reset link sent ----
  if (resetSent) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="brand-mark">VPA</div>
          <h1 className="login-title">Check your email</h1>
          <p className="login-sub">
            If <strong>{email}</strong> has an account, a password-reset link
            is on its way. Open it on this device to choose a new password.
          </p>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setResetSent(false);
              setMode("password");
              setEmail("");
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // ---- reset-request screen ----
  if (mode === "reset") {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="brand-mark">VPA</div>
          <h1 className="login-title">Reset your password</h1>
          <p className="login-sub">
            Enter your account email and we'll send you a link to set a new
            password.
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <input
              type="email"
              className="login-input"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
            <button
              type="submit"
              className="btn-primary login-submit"
              disabled={submitting}
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>
            {errorMsg && <div className="login-error">{errorMsg}</div>}
          </form>

          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode("password");
              setErrorMsg("");
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // ---- main sign-in screen (password | magic) ----
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand-mark">VPA</div>
        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">
          Use your VPA account — the same username and password as your reading
          and math apps.
        </p>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${mode === "password" ? "active" : ""}`}
            onClick={() => {
              setMode("password");
              setErrorMsg("");
            }}
          >
            Password
          </button>
          <button
            type="button"
            className={`login-tab ${mode === "magic" ? "active" : ""}`}
            onClick={() => {
              setMode("magic");
              setErrorMsg("");
            }}
          >
            Email link
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            type={mode === "password" ? "text" : "email"}
            className="login-input"
            placeholder={
              mode === "password" ? "Username or email" : "email@example.com"
            }
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus
          />
          {mode === "password" && (
            <input
              type="password"
              className="login-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              minLength={6}
              required
            />
          )}
          <button
            type="submit"
            className="btn-primary login-submit"
            disabled={submitting}
          >
            {submitting
              ? "Working…"
              : mode === "magic"
              ? "Send sign-in link"
              : "Sign in"}
          </button>
          {errorMsg && <div className="login-error">{errorMsg}</div>}
        </form>

        {mode === "password" && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode("reset");
              setErrorMsg("");
              setPassword("");
            }}
          >
            Forgot password?
          </button>
        )}
      </div>
    </div>
  );
}
