import Card from "./Card.js";
import Action from "./Action.js";
import { DAYS, MONTHS, parseKey } from "../lib/dates.js";
import { num } from "../theme.js";
import type { Theme } from "../theme.js";
import type { Session, AttendanceStatus } from "../types.js";

export default function CatchUpSheet({ T, sessions, onMark, onClose }: {
  T: Theme;
  sessions: Session[];
  onMark: (id: string, status: AttendanceStatus | null) => void;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Classes needing marking"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50,
      }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.bg, width: "100%", maxWidth: 520, maxHeight: "82vh", overflowY: "auto",
        borderRadius: "14px 14px 0 0", padding: "10px 16px 24px",
      }}>
        <div style={{ width: 36, height: 5, borderRadius: 3, background: T.label3, margin: "0 auto 14px" }} />

        <div className="flex items-start justify-between" style={{ marginBottom: 14, gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Needs marking</h2>
            <p style={{ fontSize: 13, color: T.label2, margin: "3px 0 0" }}>
              These already happened — they can't be attended again.
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", padding: "4px 2px", cursor: "pointer",
            fontFamily: T.font, fontSize: 17, fontWeight: 600, color: T.blue, flexShrink: 0,
          }}>Done</button>
        </div>

        {sessions.length === 0 ? (
          <Card T={T} style={{ padding: 26, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>All caught up</div>
          </Card>
        ) : sessions.map((s) => {
          const d = parseKey(s.date);
          return (
            <Card key={s.id} T={T} style={{ padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>{s.name}</div>
              <div style={{ fontSize: 13, color: T.label2, marginTop: 2, ...num }}>
                Class {s.n} of {s.total} · {DAYS[d.getDay()]} {d.getDate()} {MONTHS[d.getMonth()]} · {s.start}
              </div>
              <div className="flex" style={{ marginTop: 11, gap: 8 }}>
                <Action T={T} label="Present" tone={T.green} onClick={() => onMark(s.id, "present")} />
                <Action T={T} label="Absent" tone={T.red} onClick={() => onMark(s.id, "absent")} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
