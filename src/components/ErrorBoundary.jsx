import React from "react";

/**
 * ErrorBoundary — last line of defense for the whole app.
 *
 * Without this, any uncaught render error (a malformed adapter
 * response, a null deref in a child component, etc.) white-screens
 * the entire dashboard with no recovery path — a hard fail for a
 * student or parent who just sees a blank page.
 *
 * Instead we catch it, log it for debugging, and show a calm
 * "something went wrong" card with a one-tap reload.
 *
 * React error boundaries must be class components — there is no
 * hook equivalent.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Surface it in the console so it's debuggable in production.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] uncaught render error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="login-shell">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div className="brand-mark">VPA</div>
          <h1 className="login-title">Something went wrong</h1>
          <p className="login-sub">
            The page hit an unexpected error. Reloading usually fixes it —
            your progress is saved.
          </p>
          <button
            type="button"
            className="btn-primary login-submit"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
