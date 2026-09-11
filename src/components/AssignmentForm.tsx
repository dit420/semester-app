import { useState, type FormEvent } from "react";
import type { Theme } from "../theme.js";
import type { Assignment } from "../types.js";

export interface AssignmentFormData {
  subjectCode: string;
  title: string;
  details: string | null;
  dueDate: string;
  dueTime: string | null;
}

export default function AssignmentForm({ T, subjects, initial, onSubmit, onRetract, onClose }: {
  T: Theme;
  subjects: [string, string, number, string][];
  initial: Assignment | null;
  onSubmit: (data: AssignmentFormData) => Promise<void>;
  onRetract: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const editing = !!initial?.id;
  const [subjectCode, setSubjectCode] = useState(initial?.subjectCode ?? subjects[0][0]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [details, setDetails] = useState(initial?.details ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [dueTime, setDueTime] = useState(initial?.dueTime?.slice(0, 5) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRetract, setConfirmingRetract] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ subjectCode, title: title.trim(), details: details.trim() || null, dueDate, dueTime: dueTime || null });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const retract = async () => {
    setBusy(true);
    setError(null);
    try {
      await onRetract(initial!.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const inputStyle = {
    width: "100%", minHeight: 44, borderRadius: 10, border: `1px solid ${T.separator}`,
    background: T.bg, color: T.label, fontFamily: T.font, fontSize: 16,
    padding: "0 12px", boxSizing: "border-box" as const, marginBottom: 14,
  };
  const labelStyle = { display: "block", fontSize: 13, color: T.label2, marginBottom: 6 };

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={editing ? "Edit assignment" : "Add assignment"}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50,
      }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.bg, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto",
        borderRadius: "14px 14px 0 0", padding: "10px 16px 24px",
      }}>
        <div style={{ width: 36, height: 5, borderRadius: 3, background: T.label3, margin: "0 auto 14px" }} />

        <div className="flex items-start justify-between" style={{ marginBottom: 14, gap: 10 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
            {editing ? "Edit assignment" : "Add assignment"}
          </h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", padding: "4px 2px", cursor: "pointer",
            fontFamily: T.font, fontSize: 17, fontWeight: 600, color: T.label2, flexShrink: 0,
          }}>Cancel</button>
        </div>

        <form onSubmit={submit}>
          <label style={labelStyle}>Subject</label>
          <select value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} style={inputStyle}>
            {subjects.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>

          <label style={labelStyle}>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200}
            placeholder="e.g. Essay on utilitarianism" style={inputStyle} />

          <label style={labelStyle}>Details (optional)</label>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} rows={3}
            style={{ ...inputStyle, minHeight: 72, paddingTop: 10, paddingBottom: 10, resize: "vertical" }} />

          <div className="flex" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Due time (optional)</label>
              <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {error && <p style={{ color: T.red, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}

          <button type="submit" disabled={busy} style={{
            width: "100%", minHeight: 44, borderRadius: 10, border: "none",
            cursor: busy ? "default" : "pointer", background: T.blue, color: "#fff",
            fontFamily: T.font, fontSize: 16, fontWeight: 600, opacity: busy ? 0.6 : 1,
          }}>
            {busy ? "Saving…" : editing ? "Save changes" : "Post"}
          </button>
        </form>

        {editing && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.separator}` }}>
            {confirmingRetract ? (
              <div>
                <p style={{ fontSize: 13, color: T.label2, margin: "0 0 10px" }}>
                  Retract this post? Classmates will no longer see it.
                </p>
                <div className="flex" style={{ gap: 8 }}>
                  <button onClick={() => setConfirmingRetract(false)} disabled={busy} style={{
                    flex: 1, minHeight: 40, borderRadius: 9, border: "none", cursor: "pointer",
                    background: T.fill, color: T.label, fontFamily: T.font, fontSize: 15, fontWeight: 600,
                  }}>Keep it</button>
                  <button onClick={retract} disabled={busy} style={{
                    flex: 1, minHeight: 40, borderRadius: 9, border: "none", cursor: "pointer",
                    background: T.red, color: "#fff", fontFamily: T.font, fontSize: 15, fontWeight: 600,
                  }}>Retract</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmingRetract(true)} disabled={busy} style={{
                width: "100%", minHeight: 40, background: "none", border: "none", cursor: "pointer",
                fontFamily: T.font, fontSize: 15, fontWeight: 600, color: T.red,
              }}>Retract this post</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
