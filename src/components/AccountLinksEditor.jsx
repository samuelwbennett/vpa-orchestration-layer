import React, { useEffect, useRef, useState } from "react";
import { Link as LinkIcon, Check, AlertCircle, X } from "lucide-react";
import { linkStudentAppAccount } from "../services/accountLinks.js";

/**
 * AccountLinksEditor — admin-only inline editor inside the AdminView
 * roster drill-down. Today it only handles Math Academy linking
 * because Math Facts / Reading Facts / Reading Academy auto-resolve
 * via `students.auth_user_id` and don't need explicit external_ids.
 *
 * Behavior:
 *   - Preloads the student's current MA id (or empty)
 *   - "Save" upserts via /api/link-student-app-account
 *   - Empty string saved → server unlinks (enabled=false), the
 *     proxy + cron will skip the student
 *
 * Save feedback:
 *   - Inline success banner under the input that names exactly what
 *     happened and stays visible for SUCCESS_LINGER_MS. Lingers long
 *     enough that even an admin glancing away catches it.
 *   - Button itself flips to "✓ Saved" and stays so until the input
 *     is edited again (no premature reset on the parent's refresh).
 */
const SUCCESS_LINGER_MS = 4500;

export default function AccountLinksEditor({
  studentId,
  studentName,
  mathAcademyLink,
  onSaved,
}) {
  const initial = (mathAcademyLink && mathAcademyLink.externalId) || "";
  const [maId, setMaId] = useState(initial);
  const [saving, setSaving] = useState(false);
  // What the user JUST saved, kept independent of `initial` so the
  // success state survives the parent's refresh re-render.
  const [lastSaved, setLastSaved] = useState({
    value: null,        // string ("36411") or "" for unlink, null for none yet
    at: null,           // Date.now() of the save
    action: null,       // "linked" | "unlinked" | "updated"
  });
  const [errMsg, setErrMsg] = useState("");
  const lingerTimerRef = useRef(null);

  // Auto-dismiss the inline success banner after the linger window.
  useEffect(() => {
    if (!lastSaved.at) return;
    if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);
    lingerTimerRef.current = setTimeout(() => {
      // Don't wipe lastSaved.value — we still want the button to read
      // "Saved" when nothing's been edited. Just clear the timestamp
      // so the banner disappears.
      setLastSaved((s) => ({ ...s, at: null }));
    }, SUCCESS_LINGER_MS);
    return () => clearTimeout(lingerTimerRef.current);
  }, [lastSaved.at]);

  const trimmed = maId.trim();
  const willUnlink = trimmed === "" && (initial || lastSaved.value);
  const isDirty = trimmed !== (lastSaved.value ?? initial);

  // The Save button label only flips to "Saved" when the user has
  // actually saved at least once AND hasn't dirtied the input since.
  const showSavedOnButton = lastSaved.value !== null && !isDirty;

  async function save() {
    setSaving(true);
    setErrMsg("");
    try {
      const prior = lastSaved.value ?? initial;
      const next = trimmed;
      const action =
        next === ""
          ? "unlinked"
          : prior === ""
          ? "linked"
          : "updated";
      await linkStudentAppAccount({
        studentId,
        slug: "math_academy",
        externalId: next || null,
      });
      setLastSaved({ value: next, at: Date.now(), action });
      // Refresh parent so the new link is visible everywhere else.
      if (onSaved) onSaved();
    } catch (e) {
      setErrMsg(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="account-links-editor">
      <div className="account-links-head">
        <LinkIcon size={14} />
        <span className="account-links-title">Account links</span>
      </div>

      <div className="account-links-row">
        <label className="account-links-label">Math Academy ID</label>
        <input
          type="text"
          className="account-links-input"
          value={maId}
          placeholder="e.g. 36411"
          onChange={(e) => setMaId(e.target.value)}
          disabled={saving}
          maxLength={32}
        />
        <button
          type="button"
          className={`account-links-save ${willUnlink ? "unlink" : ""} ${
            showSavedOnButton ? "saved" : ""
          }`}
          onClick={save}
          disabled={!isDirty || saving}
        >
          {saving ? (
            "Saving…"
          ) : willUnlink ? (
            "Unlink"
          ) : showSavedOnButton ? (
            <>
              <Check size={13} /> Saved
            </>
          ) : (
            "Save"
          )}
        </button>
      </div>

      {/* Persistent success banner — lingers SUCCESS_LINGER_MS so
          the admin can't miss what just happened. */}
      {lastSaved.at && !errMsg && (
        <div className="account-links-success">
          <Check size={13} />
          <span>
            {lastSaved.action === "unlinked"
              ? `${studentName} is no longer linked to Math Academy.`
              : lastSaved.action === "linked"
              ? `${studentName} is now linked to Math Academy ${lastSaved.value}.`
              : `Math Academy ID for ${studentName} updated to ${lastSaved.value}.`}
          </span>
        </div>
      )}

      <div className="account-links-help">
        On mathacademy.com, open {studentName}'s profile — the URL has{" "}
        <code>/students/&lt;number&gt;/...</code>. That number goes here.
        Leave blank to unlink.
      </div>

      {errMsg && (
        <div className="account-links-error">
          <AlertCircle size={13} /> {errMsg}
          <button
            type="button"
            className="account-links-error-dismiss"
            aria-label="Dismiss"
            onClick={() => setErrMsg("")}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
