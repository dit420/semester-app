import Card from "./Card.js";
import { FONT } from "../theme.js";
import type { Theme } from "../theme.js";
import { DAYS, MONTHS, parseKey } from "../lib/dates.js";
import type { EnrichedAssignment } from "../types.js";

function dueLabel(dueDate: string, dueTime: string | null, todayKey: string): string {
  const d = parseKey(dueDate);
  const dateStr = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const diffDays = Math.round((parseKey(dueDate).getTime() - parseKey(todayKey).getTime()) / 86400000);
  const timeStr = dueTime ? ` · ${dueTime.slice(0, 5)}` : "";
  if (diffDays < 0) return `Overdue since ${dateStr}${timeStr}`;
  if (diffDays === 0) return `Due today${timeStr}`;
  if (diffDays === 1) return `Due tomorrow${timeStr}`;
  return `Due ${dateStr}${timeStr}`;
}

export default function AssignmentCard({ T, a, todayKey, onEdit, onConfirm, onDone }: {
  T: Theme;
  a: EnrichedAssignment;
  todayKey: string;
  onEdit: () => void;
  onConfirm: (id: string, next: boolean) => void;
  onDone: (id: string, next: boolean) => void;
}) {
  const accent = T.subject[a.colorIdx % T.subject.length];
  const overdue = !a.done && a.dueDate < todayKey;

  return (
    <Card T={T} style={{ padding: "12px 14px", marginBottom: 8 }}>
      <div className="flex items-start" style={{ gap: 10 }}>
        <span style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: accent, flexShrink: 0, minHeight: 34 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-start justify-between" style={{ gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: T.label2, fontWeight: 600 }}>{a.subjectName}</div>
              <div style={{
                fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", color: T.label, marginTop: 1,
                textDecoration: a.done ? "line-through" : "none",
              }}>{a.title}</div>
            </div>
            {a.isMine && (
              <button onClick={onEdit} style={{
                background: "none", border: "none", padding: "4px 2px", cursor: "pointer",
                fontFamily: FONT, fontSize: 13, fontWeight: 600, color: T.blue, flexShrink: 0,
              }}>Edit</button>
            )}
          </div>

          {a.details && <div style={{ fontSize: 14, color: T.label2, marginTop: 4 }}>{a.details}</div>}

          <div style={{ fontSize: 13, color: overdue ? T.red : T.label2, fontWeight: overdue ? 600 : 400, marginTop: 6 }}>
            {dueLabel(a.dueDate, a.dueTime, todayKey)}
          </div>
          <div style={{ fontSize: 12, color: T.label3, marginTop: 2 }}>
            Posted by {a.author?.name ?? "someone"}
          </div>

          <div className="flex items-center" style={{ marginTop: 10, gap: 8 }}>
            <button onClick={() => onConfirm(a.id, !a.iConfirmed)} style={{
              minHeight: 40, borderRadius: 8, border: "none", cursor: "pointer",
              padding: "0 12px", fontFamily: FONT, fontSize: 13, fontWeight: 600,
              background: a.iConfirmed ? T.blue : T.fill, color: a.iConfirmed ? "#fff" : T.label,
            }}>
              ✓ {a.confirmations} confirmed
            </button>
            <button onClick={() => onDone(a.id, !a.done)} style={{
              minHeight: 40, borderRadius: 8, border: "none", cursor: "pointer",
              padding: "0 12px", fontFamily: FONT, fontSize: 13, fontWeight: 600,
              background: a.done ? T.green : T.fill, color: a.done ? "#fff" : T.label,
            }}>
              {a.done ? "✓ Done" : "Mark done"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
