import { useState, type FormEvent } from "react";
import { FONT } from "../theme.js";
import type { Theme } from "../theme.js";

export default function SignIn({ T, onSubmit }: { T: Theme; onSubmit: (email: string, inviteCode: string) => Promise<unknown> }) {
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(email.trim(), inviteCode.trim());
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: T.bg, fontFamily: FONT, color: T.label, padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 360, background: T.surface, borderRadius: 16, boxShadow: T.shadow, padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Sign in</h1>
        <p style={{ fontSize: 15, color: T.label2, margin: "0 0 20px" }}>
          Enter your email and we'll send you a sign-in link.
        </p>

        {sent ? (
          <p style={{ fontSize: 15, color: T.label, margin: 0 }}>
            Check <strong>{email}</strong> for a link to finish signing in.
          </p>
        ) : (
          <form onSubmit={submit}>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" autoFocus required autoComplete="email"
              style={{
                width: "100%", minHeight: 44, borderRadius: 10, border: `1px solid ${T.separator}`,
                background: T.bg, color: T.label, fontFamily: FONT, fontSize: 16,
                padding: "0 12px", boxSizing: "border-box", marginBottom: 12,
              }}
            />
            <input
              type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Invite code" autoComplete="off"
              style={{
                width: "100%", minHeight: 44, borderRadius: 10, border: `1px solid ${T.separator}`,
                background: T.bg, color: T.label, fontFamily: FONT, fontSize: 16,
                padding: "0 12px", boxSizing: "border-box", marginBottom: 4,
              }}
            />
            <p style={{ fontSize: 12, color: T.label3, margin: "0 0 12px" }}>
              First time only — ask a classmate if you don't have it.
            </p>
            {error && <p style={{ color: T.red, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
            <button type="submit" disabled={busy} style={{
              width: "100%", minHeight: 44, borderRadius: 10, border: "none",
              cursor: busy ? "default" : "pointer", background: T.blue, color: "#fff",
              fontFamily: FONT, fontSize: 16, fontWeight: 600, opacity: busy ? 0.6 : 1,
            }}>
              {busy ? "Sending…" : "Send link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
