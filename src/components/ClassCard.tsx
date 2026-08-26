import Card from "./Card.js";
import Action from "./Action.js";
import { FONT, num } from "../theme.js";
import type { Theme } from "../theme.js";
import type { Session, SubjectCard, AttendanceStatus } from "../types.js";

export default function ClassCard({ T, s, stat, record, live, markable, onMark, dueBadge }: {
  T: Theme;
  s: Session;
  stat: SubjectCard | undefined;
  record: AttendanceStatus | undefined;
  live: boolean;
  markable: boolean;
  onMark: (id: string, status: AttendanceStatus | null) => void;
  dueBadge: boolean;
}) {
  const accent = T.subject[s.colorIdx % T.subject.length];
  const cancelled = record === "cancelled";

  return (
    <div className="flex" style={{ marginBottom: 8 }}>
      <div style={{ width: 58, flexShrink: 0, paddingTop: 13 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: cancelled ? T.label3 : T.label, ...num }}>{s.start}</div>
        <div style={{ fontSize: 13, color: T.label3, marginTop: 1, ...num }}>{s.end}</div>
      </div>

      <Card T={T} style={{
        flex: 1, padding: "12px 14px", opacity: cancelled ? 0.5 : 1,
        border: live ? `2px solid ${accent}` : "none",
      }}>
        <div className="flex items-start" style={{ gap: 10 }}>
          <span style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: accent, flexShrink: 0, minHeight: 34 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-start justify-between" style={{ gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", color: T.label,
                  lineHeight: 1.25, textDecoration: cancelled ? "line-through" : "none",
                }}>{s.name}</div>
                <div style={{ fontSize: 13, color: T.label2, marginTop: 2 }}>{s.room} · {s.faculty}</div>
              </div>
              <div className="flex items-center" style={{ gap: 6, flexShrink: 0 }}>
                {dueBadge && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: "#fff", background: T.orange,
                    borderRadius: 6, padding: "2px 6px", letterSpacing: "-0.01em",
                  }}>Due</span>
                )}
                <span style={{ fontSize: 13, color: T.label3, ...num }}>{s.n}/{s.total}</span>
              </div>
            </div>
            {live && <div style={{ fontSize: 13, fontWeight: 600, color: accent, marginTop: 4 }}>Happening now</div>}
          </div>
        </div>

        {cancelled ? (
          <button onClick={() => onMark(s.id, null)} style={{
            marginTop: 10, background: "none", border: "none", padding: "4px 2px", cursor: "pointer",
            fontFamily: FONT, fontSize: 13, color: T.blue,
          }}>Class cancelled · undo</button>
        ) : record ? (
          <div className="flex items-center justify-between" style={{ marginTop: 10, gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: record === "present" ? T.green : T.red }}>
              {record === "present" ? "✓ Present" : "✕ Absent"}
            </span>
            <button onClick={() => onMark(s.id, null)} style={{
              background: "none", border: "none", padding: "4px 2px", cursor: "pointer",
              fontFamily: FONT, fontSize: 15, color: T.blue,
            }}>Undo</button>
          </div>
        ) : markable ? (
          <div className="flex" style={{ marginTop: 11, gap: 8 }}>
            <Action T={T} label="Present" tone={T.green} onClick={() => onMark(s.id, "present")} />
            <Action T={T} label="Absent" tone={T.red} onClick={() => onMark(s.id, "absent")} />
            <button onClick={() => onMark(s.id, "cancelled")} aria-label="Class was cancelled"
              title="Class was cancelled"
              style={{
                minHeight: 40, minWidth: 44, borderRadius: 9, border: "none", background: T.fill,
                color: T.label2, fontFamily: FONT, fontSize: 15, cursor: "pointer",
              }}>—</button>
          </div>
        ) : (
          <div className="flex items-center justify-between" style={{ marginTop: 10, gap: 8 }}>
            <span style={{ fontSize: 13, color: T.label3 }}>Upcoming</span>
            {stat && (
              <span style={{ fontSize: 13, ...num, color: stat.unreachable || stat.canSkip === 0 ? T.red : T.label3 }}>
                {stat.unreachable ? "80% not reachable"
                  : stat.canSkip === 0 ? "Must attend"
                  : `${stat.canSkip} absences left`}
              </span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
