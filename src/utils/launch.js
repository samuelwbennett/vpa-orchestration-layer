// =====================================================
// Single launch helper. Every "Start Now" / "Launch" button
// in the dashboard goes through this so we control behavior
// (popup target, security flags, session bridging) in one place.
//
// SESSION BRIDGE:
//   Each in-house app (math-facts-trainer, reading-facts-app,
//   reading-academy) lives on its own vercel.app subdomain and
//   keeps its own browser auth session. So a student signed into
//   the orchestration layer is NOT signed into Math Facts on their
//   next click. Asking them to magic-link sign in to each app is a
//   horrible UX.
//
//   When the target URL is one of our bridgeable domains, we open
//   the new tab synchronously (so the popup blocker is satisfied —
//   browsers require window.open() inside the user-gesture stack),
//   then asynchronously fetch the current Supabase session and
//   navigate the tab to the URL with a #vpa_session=<base64>
//   fragment. The target app's boot code consumes that fragment,
//   calls supabase.auth.setSession(), and removes it from the URL.
//
//   For external apps (Math Academy on mathacademy.com) we can't
//   bridge — that's a third party. They get a plain launch.
//
// Security notes:
//   - URL fragments don't reach servers (no log leak), but they
//     do appear in browser history. Acceptable for a controlled
//     pilot cohort; the long-term answer is consolidating to a
//     shared parent domain so Supabase cookies span every app.
//   - We drop `noopener` for bridgeable destinations so we can
//     navigate the popup window after opening. This is safe because
//     the target is one of our own apps.
// =====================================================

import { supabase } from "../services/supabaseClient.js";

const BRIDGEABLE_DOMAINS = [
  "math-facts-trainer.vercel.app",
  "reading-facts-app.vercel.app",
  "reading-academy.vercel.app",
];

function isBridgeable(url) {
  try {
    const u = new URL(url);
    return BRIDGEABLE_DOMAINS.includes(u.hostname);
  } catch {
    return false;
  }
}

/**
 * The single entry point every "Start Now" / "Launch" button calls.
 * Synchronous (so popup blockers don't fire) — for bridgeable
 * destinations it kicks off an async session attach + navigate
 * after opening the blank tab.
 */
export function launchApp(url) {
  if (!url || url === "#") return;

  if (!isBridgeable(url)) {
    // External destination — plain launch, with noopener for safety.
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  // Bridgeable: open a blank tab NOW (in the user gesture), then
  // navigate it once we've attached the session.
  const win = window.open("about:blank", "_blank");
  if (!win) {
    // Popup blocker fired — fall back to same-tab navigation so
    // the user at least lands on the target (without the bridge,
    // they'll have to sign in there).
    window.location.href = url;
    return;
  }
  attachSessionAndNavigate(win, url);
}

async function attachSessionAndNavigate(win, url) {
  let target = url;
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (session?.access_token && session?.refresh_token) {
      const payload = JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      });
      const encoded = btoa(payload)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const joiner = url.includes("#") ? "&" : "#";
      target = `${url}${joiner}vpa_session=${encoded}`;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[launch] session attach failed, launching without:", err);
  }
  try {
    win.location.href = target;
  } catch {
    // If the popup got closed during the await, swallow.
  }
}
