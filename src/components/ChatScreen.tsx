import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { FONT, num } from "../theme.js";
import type { Theme } from "../theme.js";
import type { ChatMessage } from "../types.js";
import Avatar from "./Avatar.js";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // matches the chat-files bucket's own limit (0006)
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ChatScreen({ T, messages, loaded, myId, isAdmin, onSend, onRetract, onDownload }: {
  T: Theme;
  messages: ChatMessage[];
  loaded: boolean;
  myId: string;
  isAdmin: boolean;
  onSend: (body: string | null, file: File | null) => Promise<void>;
  onRetract: (id: string) => void;
  onDownload: (attachmentPath: string) => Promise<string>;
}) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const pickFile = () => fileInputRef.current?.click();

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setError("That file is over 20 MB — it won't upload.");
      return;
    }
    setError(null);
    setFile(f);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if ((!body.trim() && !file) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(body.trim() || null, file);
      setBody("");
      setFile(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const download = async (path: string, name: string) => {
    try {
      const url = await onDownload(path);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
    } catch (err) {
      setError(`Couldn't open ${name} — ${(err as Error).message}`);
    }
  };

  return (
    <section style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", height: "calc(100vh - 110px)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 12px" }}>Chat</h1>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 2 }}>
        {!loaded ? (
          <div style={{ fontSize: 15, color: T.label2, padding: "20px 2px" }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ fontSize: 15, color: T.label2, padding: "20px 2px", textAlign: "center" }}>
            No messages yet — say hello.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.userId === myId;
            const canRetract = mine || isAdmin;
            return (
              <div key={m.id} className="flex items-start" style={{
                gap: 8, marginBottom: 12, flexDirection: mine ? "row-reverse" : "row",
              }}>
                <Avatar T={T} path={m.authorAvatarPath} name={m.authorName} size={30} />
                <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                  <div style={{ fontSize: 12, color: T.label3, marginBottom: 3 }}>
                    {mine ? "You" : m.authorName} · {fmtTime(m.createdAt)}
                  </div>
                  {m.body && (
                    <div style={{
                      background: mine ? T.blue : T.fill, color: mine ? "#fff" : T.label,
                      borderRadius: 14, padding: "8px 12px", fontSize: 15, lineHeight: 1.35,
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>
                      {m.body}
                    </div>
                  )}
                  {m.attachmentPath && m.attachmentName && (
                    <button onClick={() => download(m.attachmentPath!, m.attachmentName!)} style={{
                      marginTop: m.body ? 4 : 0, minHeight: 40, borderRadius: 12, border: `1px solid ${T.separator}`,
                      background: T.surface, color: T.label, cursor: "pointer", fontFamily: FONT,
                      padding: "6px 12px", textAlign: "left", maxWidth: "100%",
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ fontSize: 16 }}>📎</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{
                          display: "block", fontSize: 13, fontWeight: 600,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{m.attachmentName}</span>
                        {m.attachmentSize != null && (
                          <span style={{ display: "block", fontSize: 11, color: T.label3, ...num }}>{fmtBytes(m.attachmentSize)}</span>
                        )}
                      </span>
                    </button>
                  )}
                  {canRetract && (
                    <button onClick={() => onRetract(m.id)} style={{
                      marginTop: 3, background: "none", border: "none", padding: "2px", cursor: "pointer",
                      fontFamily: FONT, fontSize: 11, color: T.label3,
                    }}>Remove</button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={listEndRef} />
      </div>

      {error && (
        <div style={{ fontSize: 13, color: T.red, padding: "6px 2px" }}>{error}</div>
      )}

      {file && (
        <div className="flex items-center justify-between" style={{
          background: T.fill, borderRadius: 10, padding: "6px 10px", marginBottom: 8, gap: 8,
        }}>
          <span style={{ fontSize: 13, color: T.label, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📎 {file.name}
          </span>
          <button onClick={() => setFile(null)} style={{
            background: "none", border: "none", padding: "4px", cursor: "pointer", color: T.label2, fontSize: 15,
          }}>✕</button>
        </div>
      )}

      <form onSubmit={submit} className="flex items-center" style={{ gap: 8, paddingTop: 4 }}>
        <button type="button" onClick={pickFile} aria-label="Attach a file" title="Attach a file" style={{
          minHeight: 44, minWidth: 44, borderRadius: 10, border: "none", background: T.fill,
          color: T.label2, fontSize: 18, cursor: "pointer", flexShrink: 0,
        }}>📎</button>
        <input ref={fileInputRef} type="file" accept={ACCEPT} hidden onChange={handleFile} />
        <input type="text" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000}
          placeholder="Message your group…"
          style={{
            flex: 1, minHeight: 44, borderRadius: 10, border: `1px solid ${T.separator}`,
            background: T.bg, color: T.label, fontFamily: FONT, fontSize: 16,
            padding: "0 12px", boxSizing: "border-box",
          }} />
        <button type="submit" disabled={busy || (!body.trim() && !file)} style={{
          minHeight: 44, borderRadius: 10, border: "none", flexShrink: 0,
          cursor: busy ? "default" : "pointer", background: T.blue, color: "#fff",
          fontFamily: FONT, fontSize: 15, fontWeight: 600, padding: "0 18px",
          opacity: (busy || (!body.trim() && !file)) ? 0.5 : 1,
        }}>Send</button>
      </form>
    </section>
  );
}
