// =====================================================
// Tiny fetch wrapper used by every adapter.
// Keeps timeout/abort/error handling in one place.
// =====================================================

export async function getJSON(url, { headers = {}, signal, timeoutMs = 8000 } = {}) {
  // Respect any incoming signal but also enforce our own timeout.
  const localCtrl = new AbortController();
  const onAbort = () => localCtrl.abort();
  if (signal) signal.addEventListener("abort", onAbort);
  const timer = setTimeout(() => localCtrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: localCtrl.signal
    });
    if (!res.ok) {
      const body = await safeText(res);
      throw new Error(
        `HTTP ${res.status} ${res.statusText} from ${url}${body ? ` — ${body}` : ""}`
      );
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

async function safeText(res) {
  try {
    const t = await res.text();
    return t.length > 200 ? t.slice(0, 200) + "…" : t;
  } catch {
    return "";
  }
}
