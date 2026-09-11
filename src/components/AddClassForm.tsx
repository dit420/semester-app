import { useState, type FormEvent } from "react";
import type { Theme } from "../theme.js";
import type { Group } from "../types.js";
import type { NewExtraSession } from "../lib/store.js";
import Segmented from "./Segmented.js";

export default function AddClassForm({ T, subjects, defaultGroup, onSubmit, onClose }: {
  T: Theme;
  subjects: [string, string, number, string][];
  defaultGroup: Group;
  onSubmit: (data: NewExtraSession) => Promise<void>;
  onClose: () => void;
}) {
  const [subjectCode, setSubjectCode] = useState(subjects[0][0]);
  const [group, setGroup] = useState<Group>(defaultGroup);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [room, setRoom] = useState("");
  const [faculty, setFaculty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !start || !end || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        subjectCode, group, date, start, end,
        room: room.trim() || null, faculty: faculty.trim() || null,
      });
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
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Add class"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50,
      }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.bg, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto",
        borderRadius: "14px 14px 0 0", padding: "10px 16px 24px",
      }}>
        <div style={{ width: 36, height: 5, borderRadius: 3, background: T.label3, margin: "0 auto 14px" }} />

        <div className="flex items-start justify-between" style={{ marginBottom: 4, gap: 10 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Add class</h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", padding: "4px 2px", cursor: "pointer",
            fontFamily: T.font, fontSize: 17, fontWeight: 600, color: T.label2, flexShrink: 0,
          }}>Cancel</button>
        </div>
        <p style={{ fontSize: 13, color: T.label2, margin: "0 0 14px" }}>
          Counts toward the real 80% requirement for everyone in the group — for a class the college is
          actually holding, not a personal reminder.
        </p>

        <form onSubmit={submit}>
          <label style={labelStyle}>Subject</label>
          <select value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} style={inputStyle}>
            {subjects.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>

          <label style={labelStyle}>Group</label>
          <div style={{ marginBottom: 14 }}>
            <Segmented<Group> T={T} value={group} onChange={setGroup} label="Group"
              options={[{ value: "A", label: "Group A" }, { value: "B", label: "Group B" }]} />
          </div>

          <label style={labelStyle}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={inputStyle} />

          <div className="flex" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Start time</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>End time</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required style={inputStyle} />
            </div>
          </div>

          <div className="flex" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Room (optional)</label>
              <input type="text" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. CR-08" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Faculty (optional)</label>
              <input type="text" value={faculty} onChange={(e) => setFaculty(e.target.value)} placeholder="e.g. Dr. Kundu" style={inputStyle} />
            </div>
          </div>

          {error && <p style={{ color: T.red, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}

          <button type="submit" disabled={busy} style={{
            width: "100%", minHeight: 44, borderRadius: 10, border: "none",
            cursor: busy ? "default" : "pointer", background: T.blue, color: "#fff",
            fontFamily: T.font, fontSize: 16, fontWeight: 600, opacity: busy ? 0.6 : 1,
          }}>
            {busy ? "Adding…" : "Add class"}
          </button>
        </form>
      </div>
    </div>
  );
}
