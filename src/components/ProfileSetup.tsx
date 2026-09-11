import { useState, type FormEvent } from "react";
import type { Theme } from "../theme.js";
import Segmented from "./Segmented.js";
import type { Group } from "../types.js";

export default function ProfileSetup({ T, onSubmit }: {
  T: Theme;
  onSubmit: (data: { name: string; groupCode: Group }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [groupCode, setGroupCode] = useState<Group>("B");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), groupCode });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: T.bg, fontFamily: T.font, color: T.label, padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 360, background: T.surface, borderRadius: 16, boxShadow: T.shadow, padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Set up your profile</h1>
        <p style={{ fontSize: 15, color: T.label2, margin: "0 0 20px" }}>
          One-time — this is how classmates will see your posts.
        </p>

        <form onSubmit={submit}>
          <label style={{ display: "block", fontSize: 13, color: T.label2, marginBottom: 6 }}>Name</label>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Your name" autoFocus required maxLength={80}
            style={{
              width: "100%", minHeight: 44, borderRadius: 10, border: `1px solid ${T.separator}`,
              background: T.bg, color: T.label, fontFamily: T.font, fontSize: 16,
              padding: "0 12px", boxSizing: "border-box", marginBottom: 16,
            }}
          />

          <label style={{ display: "block", fontSize: 13, color: T.label2, marginBottom: 6 }}>Group</label>
          <div style={{ marginBottom: 20 }}>
            <Segmented<Group> T={T} value={groupCode} onChange={setGroupCode} label="Your group"
              options={[{ value: "A", label: "Group A" }, { value: "B", label: "Group B" }]} />
          </div>

          {error && <p style={{ color: T.red, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
          <button type="submit" disabled={busy} style={{
            width: "100%", minHeight: 44, borderRadius: 10, border: "none",
            cursor: busy ? "default" : "pointer", background: T.blue, color: "#fff",
            fontFamily: T.font, fontSize: 16, fontWeight: 600, opacity: busy ? 0.6 : 1,
          }}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
