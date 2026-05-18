import React, { useState } from "react";
import { Link as LinkIcon, Check, AlertCircle } from "lucide-react";
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
 * UX note: keep this lean — the admin's mental model is "where do I
 * find the MA id?" → "click student, paste id, save." A help line
 * tells them how to grab the numeric id from mathacademy.com.
 */
export default function AccountLinksEditor({
  studentId,
  studentName,
  mathAcademyLink,
  onSaved,
}) {
  const initial = (mathAcademyLink && mathAcademyLink.externalId) || "";
  const [maId, setMaId] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [errMsg, setErrMsg] = useState("");

  const isDirty = (maId || "") !== (initial || "");
  const willUnlink = isDirty && maId.trim() === "";

  async function save() {
    setSaving(true);
    setErrMsg("");
    try {
      await linkStudentAppAccount({
        studentId,
        slug: "math_academy",
        externalId: maId.trim() || null,
      });
      setSavedAt(Date.now());
      // Tell parent to refresh so the new link shows up everywhere
      // else (snapshot endpoints, cron, etc. will pick it up immediately).
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
          className={`account-links-save ${willUnlink ? "unlink" : ""}`}
          onClick={save}
          disabled={!isDirty || saving}
        >
          {saving
            ? "Saving…"
            : willUnlink
            ? "Unlink"
            : savedAt && !isDirty
            ? (<><Check size={13} /> Saved</>)
            : "Save"}
        </button>
      </div>

      <div className="account-links-help">
        On mathacademy.com, open {studentName}'s profile — the URL has{" "}
        <code>/students/&lt;number&gt;/...</code>. That number goes here.
        Leave blank to unlink.
      </div>

      {errMsg && (
        <div className="account-links-error">
          <AlertCircle size={13} /> {errMsg}
        </div>
      )}
    </div>
  );
}
