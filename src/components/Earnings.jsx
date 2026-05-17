import React, { useState } from "react";
import { Coins, GraduationCap, Store, X } from "lucide-react";
import { useXpRollup } from "../hooks/useXpRollup.js";

/**
 * Earnings — shows the signed-in student's incentive balance with a
 * breakdown of today / this week / lifetime, plus a "Redeem" button
 * that opens the redemption modal.
 *
 * Dollar data comes from useIncentives(studentId), which talks to the
 * /api/incentives proxy and reads from `daily_progress.total_xp`.
 * Today that's only Math Facts XP, since Math Facts is the only app
 * writing to daily_progress. The cross-app XP we surface below
 * (useXpRollup → contract /api/xp on every app) reflects the full
 * picture, even though the dollar economy hasn't caught up yet.
 */

export default function Earnings({ data, loading, error, redeem, studentId }) {
  const xp = useXpRollup({ studentId });
  const [modalOpen, setModalOpen] = useState(false);

  if (loading && !data) {
    return (
      <div className="card" style={{ color: "var(--text-muted)" }}>
        Loading earnings…
      </div>
    );
  }
  if (error) {
    return (
      <div className="card" style={{ color: "var(--red)" }}>
        Couldn't load earnings — {error.message}
      </div>
    );
  }
  if (!data) return null;

  const { earnings, rules, redemptions } = data;
  const canRedeem = earnings.available >= 0.01;

  return (
    <div className="earnings-card">
      <div className="earnings-top">
        <div className="earnings-headline">
          <div className="earnings-headline-label">Available to redeem</div>
          <div className="earnings-headline-value">
            ${earnings.available.toFixed(2)}
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!canRedeem}
          onClick={() => setModalOpen(true)}
        >
          <Coins size={16} /> Redeem
        </button>
      </div>

      <div className="earnings-stats">
        <Stat label="Today" value={`$${earnings.today.toFixed(2)}`} />
        <Stat label="This week" value={`$${earnings.thisWeek.toFixed(2)}`} />
        <Stat label="Lifetime" value={`$${earnings.totalEarned.toFixed(2)}`} />
        <Stat label="Redeemed" value={`$${earnings.totalRedeemed.toFixed(2)}`} />
      </div>

      {xp.totals && (xp.totals.today > 0 || xp.totals.thisWeek > 0 || xp.totals.allTime > 0) && (
        <div className="earnings-xp-rollup">
          <div className="earnings-xp-rollup-label">XP across all apps</div>
          <div className="earnings-xp-rollup-stats">
            <Stat label="Today" value={`${Math.round(xp.totals.today)} XP`} />
            <Stat label="This week" value={`${Math.round(xp.totals.thisWeek)} XP`} />
            <Stat label="Lifetime" value={`${Math.round(xp.totals.allTime)} XP`} />
          </div>
        </div>
      )}

      <div className="earnings-rules">
        Earn ${rules.ratePerXp.toFixed(2)} per XP · cap ${rules.dailyDollarsCap.toFixed(2)}/day · ${rules.weeklyDollarsCap.toFixed(2)}/week
      </div>

      {redemptions && redemptions.length > 0 && (
        <details className="earnings-history">
          <summary>Redemption history ({redemptions.length})</summary>
          <ul>
            {redemptions.slice(0, 10).map((r) => (
              <li key={r.id}>
                <span className="muted">
                  {new Date(r.redeemed_at).toLocaleDateString()}
                </span>
                <span>${Number(r.total_dollars).toFixed(2)}</span>
                <span className="muted">
                  ${Number(r.store_amount).toFixed(2)} store · ${Number(r.scholarship_amount).toFixed(2)} scholarship
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {modalOpen && (
        <RedeemModal
          available={earnings.available}
          defaultSplit={rules.defaultSplit}
          onClose={() => setModalOpen(false)}
          onSubmit={async (payload) => {
            await redeem(payload);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="earnings-stat">
      <div className="earnings-stat-label">{label}</div>
      <div className="earnings-stat-value">{value}</div>
    </div>
  );
}

function RedeemModal({ available, defaultSplit, onClose, onSubmit }) {
  const [amount, setAmount] = useState(available);
  // store-share fraction (0..1). Scholarship is 1 − store.
  const [storeShare, setStoreShare] = useState(defaultSplit?.store ?? 0.5);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const total = Math.max(0, Math.min(available, Number(amount) || 0));
  const storeAmount = Math.round(total * storeShare * 100) / 100;
  const scholarshipAmount = Math.round((total - storeAmount) * 100) / 100;
  const valid = total > 0;

  async function submit(e) {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setErrMsg("");
    try {
      await onSubmit({
        totalDollars: total,
        storeAmount,
        scholarshipAmount,
        note: note.trim() || null,
      });
    } catch (err) {
      setErrMsg(err.message || "Redemption failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Redeem earnings</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="modal-body">
          <label className="modal-field">
            <span>Amount</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={available}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <span className="modal-help">
              Up to ${available.toFixed(2)} available
            </span>
          </label>

          <div className="modal-split">
            <div className="modal-split-row">
              <span><Store size={14} /> School store</span>
              <span>${storeAmount.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.round(storeShare * 100)}
              onChange={(e) => setStoreShare(Number(e.target.value) / 100)}
            />
            <div className="modal-split-row">
              <span><GraduationCap size={14} /> Scholarship</span>
              <span>${scholarshipAmount.toFixed(2)}</span>
            </div>
          </div>

          <label className="modal-field">
            <span>Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="What it's for…"
            />
          </label>

          {errMsg && <div className="login-error">{errMsg}</div>}

          <div className="modal-actions">
            <button type="button" className="link-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!valid || submitting}
            >
              {submitting ? "Submitting…" : `Redeem $${total.toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
