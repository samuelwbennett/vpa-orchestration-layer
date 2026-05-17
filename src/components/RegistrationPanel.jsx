import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import {
  createClass,
  bulkAddStudents,
} from "../services/registration.js";

/**
 * RegistrationPanel — admin tools for setting up classes and adding
 * students. Two forms side by side, plus a results display for
 * bulk-add invite URLs.
 */
const GRADES = ["K", "1", "2", "1-2", "K-2"];

export default function RegistrationPanel({ classes, teachers, onSuccess }) {
  return (
    <section className="section">
      <h2 className="section-title">Manage</h2>
      <div className="reg-grid">
        <CreateClassForm teachers={teachers} onSuccess={onSuccess} />
        <AddStudentsForm classes={classes} onSuccess={onSuccess} />
      </div>
    </section>
  );
}

function CreateClassForm({ teachers, onSuccess }) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const teacherOptions = (teachers || [])
    .filter((t) => t.role === "teacher" || t.role === "admin")
    .sort((a, b) => a.name.localeCompare(b.name));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !teacherId) return;
    setBusy(true);
    setMsg(null);
    try {
      await createClass({
        name: name.trim(),
        gradeLevel: grade || undefined,
        teacherUserId: teacherId,
      });
      setMsg({ type: "success", text: `Class "${name.trim()}" created.` });
      setName("");
      setGrade("");
      setTeacherId("");
      onSuccess && onSuccess();
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Failed to create class" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card reg-card">
      <h3 className="reg-title">Create class</h3>
      {teacherOptions.length === 0 ? (
        <p className="reg-empty">
          No teachers in your organization yet. Promote a user to teacher
          first (allowlist or SQL), then come back.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="reg-form">
          <label className="reg-label">
            Class name
            <input
              type="text"
              className="reg-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Mrs. Smith's 2nd Grade"
              maxLength={80}
              required
              disabled={busy}
            />
          </label>
          <div className="reg-row">
            <label className="reg-label">
              Grade
              <select
                className="reg-input"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                disabled={busy}
              >
                <option value="">— pick —</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="reg-label">
              Teacher
              <select
                className="reg-input"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                required
                disabled={busy}
              >
                <option value="">— pick teacher —</option>
                {teacherOptions.map((t) => (
                  <option key={t.authUserId} value={t.authUserId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            className="btn-primary reg-submit"
            disabled={busy || !name.trim() || !teacherId}
          >
            {busy ? "Creating…" : "Create class"}
          </button>
        </form>
      )}
      {msg && <div className={`reg-msg reg-msg-${msg.type}`}>{msg.text}</div>}
    </div>
  );
}

function AddStudentsForm({ classes, onSuccess }) {
  const [classId, setClassId] = useState("");
  const [namesText, setNamesText] = useState("");
  const [grade, setGrade] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [results, setResults] = useState(null);

  const classOptions = (classes || []).slice().sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  function parseNames(text) {
    return text
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  const names = parseNames(namesText);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!classId || names.length === 0) return;
    setBusy(true);
    setMsg(null);
    setResults(null);
    try {
      const result = await bulkAddStudents({
        classId,
        students: names.map((displayName) => ({
          displayName,
          gradeLevel: grade || undefined,
        })),
      });
      setResults(result);
      const summary = result?.summary || {};
      const allOk = (summary.failed ?? 0) === 0;
      setMsg({
        type: allOk ? "success" : "warn",
        text: `Created ${summary.created ?? 0}, enrolled ${
          summary.enrolled ?? 0
        }${summary.failed ? ` · ${summary.failed} failed` : ""}.`,
      });
      setNamesText("");
      onSuccess && onSuccess();
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Bulk add failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card reg-card">
      <h3 className="reg-title">Add students to a class</h3>
      {classOptions.length === 0 ? (
        <p className="reg-empty">
          No classes yet. Create one with the form on the left, then come
          back.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="reg-form">
          <div className="reg-row">
            <label className="reg-label">
              Class
              <select
                className="reg-input"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                required
                disabled={busy}
              >
                <option value="">— pick a class —</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.studentCount}{" "}
                    {c.studentCount === 1 ? "student" : "students"})
                  </option>
                ))}
              </select>
            </label>
            <label className="reg-label">
              Grade (optional)
              <select
                className="reg-input"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                disabled={busy}
              >
                <option value="">—</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="reg-label">
            Student names (one per line, up to 50)
            <textarea
              className="reg-input reg-textarea"
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              rows={6}
              placeholder={"Ada Lovelace\nAlan Turing\nGrace Hopper"}
              disabled={busy}
            />
          </label>
          <button
            type="submit"
            className="btn-primary reg-submit"
            disabled={busy || !classId || names.length === 0}
          >
            {busy
              ? "Adding…"
              : `Add ${names.length || ""} student${
                  names.length === 1 ? "" : "s"
                }`.trim()}
          </button>
        </form>
      )}
      {msg && <div className={`reg-msg reg-msg-${msg.type}`}>{msg.text}</div>}
      {results?.results?.length > 0 && (
        <RegistrationResults results={results.results} />
      )}
    </div>
  );
}

function RegistrationResults({ results }) {
  const [copiedIdx, setCopiedIdx] = useState(null);

  function copy(text, idx) {
    try {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
      });
    } catch {
      /* clipboard not available — silent */
    }
  }

  return (
    <div className="reg-results">
      <div className="reg-results-label">Invite links</div>
      <ul className="reg-results-list">
        {results.map((r, i) => (
          <li key={i} className={`reg-result ${r.ok ? "ok" : "err"}`}>
            <span className="reg-result-name">{r.displayName}</span>
            {r.ok ? (
              <>
                <code className="reg-result-url" title={r.inviteUrl}>
                  {r.inviteUrl}
                </code>
                <button
                  type="button"
                  className="reg-copy-btn"
                  onClick={() => copy(r.inviteUrl, i)}
                  aria-label="Copy invite link"
                >
                  {copiedIdx === i ? (
                    <>
                      <Check size={12} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
              </>
            ) : (
              <span className="reg-result-err">{r.error}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
