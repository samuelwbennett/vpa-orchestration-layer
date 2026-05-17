// =====================================================
// useAdminRedemptions
// -----------------------------------------------------
// Hook for the AdminView's "Pending redemptions" panel. Loads the
// org-scoped pending list and exposes a `fulfill(id, action)`
// callback that triggers a refresh on success.
//
// Refresh is also exposed so the panel can be reloaded from the
// header refresh button (consistent with the rest of the admin
// dashboard).
// =====================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listPendingRedemptions,
  fulfillRedemption,
} from "../services/redemptions.js";

export function useAdminRedemptions() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const rows = await listPendingRedemptions();
      if (!controller.signal.aborted) setPending(rows);
    } catch (e) {
      if (e.name !== "AbortError" && !controller.signal.aborted) setError(e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [refresh]);

  const fulfill = useCallback(async (redemptionId, action) => {
    await fulfillRedemption({ redemptionId, action });
    await refresh();
  }, [refresh]);

  return { pending, loading, error, refresh, fulfill };
}
