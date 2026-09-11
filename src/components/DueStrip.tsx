import { num } from "../theme.js";
import type { Theme } from "../theme.js";
import { DAYS, MONTHS, parseKey } from "../lib/dates.js";
import type { EnrichedAssignment } from "../types.js";

/* A horizontal strip, not the full assignment list — enough to notice
   "essay due Friday" while scanning the home screen, not to act on it. */
export default function DueStrip({ T, items, onOpen }: { T: Theme; items: EnrichedAssignment[]; onOpen: () => void }) {
  if (items.length === 0) return null;

  return (
    <div style={{ padding: "0 16px", marginBottom: 16 }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 8, paddingLeft: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: T.label }}>Due this week</span>
        <button onClick={onOpen} style={{
          background: "none", border: "none", padding: "4px 2px", cursor: "pointer",
          fontFamily: T.font, fontSize: 13, fontWeight: 600, color: T.blue,
        }}>See all</button>
      </div>
      <div className="flex" style={{ gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
        {items.map((a) => {
          const accent = T.subject[a.colorIdx % T.subject.length];
          const d = parseKey(a.dueDate);
          return (
            <button key={a.id} onClick={onOpen} style={{
              flex: "0 0 auto", width: 180, minHeight: 44, textAlign: "left", cursor: "pointer",
              background: T.surface, borderRadius: 12, boxShadow: T.shadow, border: "none",
              padding: "10px 12px", fontFamily: T.font,
            }}>
              <div className="flex items-center" style={{ gap: 6, marginBottom: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: accent, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: T.label2, fontWeight: 600, ...num }}>
                  {DAYS[d.getDay()]} {d.getDate()} {MONTHS[d.getMonth()]}
                </span>
              </div>
              <div style={{
                fontSize: 14, fontWeight: 600, color: T.label, letterSpacing: "-0.01em",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{a.title}</div>
              <div style={{
                fontSize: 12, color: T.label3, marginTop: 2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{a.subjectName}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
