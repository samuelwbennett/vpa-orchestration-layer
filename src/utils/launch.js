// =====================================================
// Single launch helper. Every "Start Now" / "Launch" button
// in the dashboard goes through this so we control behavior
// (popup target, security flags, telemetry hook, etc.) in one place.
// =====================================================

export function launchApp(url) {
  if (!url || url === "#") return;
  // _blank + noopener so the new tab can't access window.opener.
  window.open(url, "_blank", "noopener,noreferrer");
}
