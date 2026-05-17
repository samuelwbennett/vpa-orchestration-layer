import React, { useState } from "react";
import { Coins, Check, X } from "lucide-react";
import { useAdminRedemptions } from "../hooks/useAdminRedemptions.js";

/**
 * PendingRedemptions — admin panel showing every pending incentive
 * redemption org-wide. Each row has "Mark as paid" + "Cancel"
 * buttons that move the row to fulfilled / cancelled respectively.
 *
 * Sits near the top of AdminView (right under "Program at a
 * glance") so admins see new requests immediately on sign-in.
 */
export default function PendingRedemptions() {
  const { pending, loading, error, fulfill } = useAdminRedemptions();
  const [busyId, setBusyId] = useState(null);
  const [errMsg, setErrMsg] = useState("");

  async function act(id, action) {
    setBusyId(id);
    setErrMsg("");
    try {
      await fulfill(id, action);
    } catch (e) {
      setErrMsg(e.message || "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && pending.length === 0) {
    return null; // quietly absent on first load
  }
  if (error) {
    return (
      <section className="section">
        <h2 className="section-title">Pending redemptions</h2>
        <div className="card" style={{ color: "var(--red)" }}>
          Couldn't load pending redemptions — {error.message}
        </div>
      </section>
    );
  }
  if (pending.length === 0) {
    return null; // empty state — don't take up space
  }

  const total = pending.reduce((s, r) => s + Number(r.total_dollars), 0);

  return (
    <section className="section">
      <h2 className="section-title">
        Pending redemptions ({pending.length} · ${total.toFixed(2)})
      </h2>
      <div className="card admin-list pending-redemptions-card">
        {pending.map((r) => (
          <div key={r.id} className="pending-redemption-row">
            <div className="pending-redemption-meta">
              <Coins size={14} />
              <span className="pending-redemption-student">
                {r.student?.display_name || "Unknown student"}
              </span>
              <span className="pending-redemption-amount">
                ${Number(r.total_dollars).toFixed(2)}
              </span>
              <span className="pending-redemption-split muted">
                ${Number(r.store_amount).toFixed(2)} store · ${Number(r.scholarship_amount).toFixed(2)} scholarship
              </span>
              <span className="pending-redemption-date muted">
                {new Date(r.redeemed_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {r.note && (
                <span className="pending-redemption-note muted">"{r.note}"</span>
              )}
            </div>
            <div className="pending-redemption-actions">
              <button
                type="button"
                className="btn-primary pending-fulfill-btn"
                onClick={() => act(r.id, "fulfill")}
                disabled={busyId === r.id}
              >
                <Check size={13} />
                {busyId === r.id ? "Saving…" : "Mark as paid"}
              </button>
              <button
                type="button"
                className="pending-cancel-btn"
                onClick={() => act(r.id, "cancel")}
                disabled={busyId === r.id}
                title="Cancel + refund this redemption"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}
        {errMsg && (
          <div className="pending-redemption-error">{errMsg}</div>
        )}
      </div>
    </section>
  );
}
