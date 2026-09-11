import { DAYS, MONTHS, parseKey } from "../lib/dates.js";
import type { Theme } from "../theme.js";
import type { EnrichedAssignment } from "../types.js";

export default function UpcomingAssignmentToast({ T, assignment, show, onOpen, onDismiss }: {
  T: Theme;
  assignment: EnrichedAssignment;
  show: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const accent = T.subject[assignment.colorIdx % T.subject.length];
  const d = parseKey(assignment.dueDate);
  const dueText = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

  return (
    <div role="status" aria-live="polite" style={{
      position: "fixed", top: 16, right: 16, zIndex: 60, width: 320, maxWidth: "calc(100vw - 32px)",
      transform: show ? "translateX(0)" : "translateX(calc(100% + 32px))",
      opacity: show ? 1 : 0,
      transition: "transform 320ms ease, opacity 320ms ease",
      pointerEvents: show ? "auto" : "none",
    }}>
      <div className="flex items-start" style={{
        background: T.surface, borderRadius: 14, boxShadow: T.pillShadow,
        padding: "12px 12px 12px 14px", gap: 8,
      }}>
        <button onClick={onOpen} className="flex items-start" style={{
          flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, margin: 0,
          cursor: "pointer", textAlign: "left", gap: 10, fontFamily: T.font,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: accent, marginTop: 6, flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.label2 }}>Upcoming assignment</span>
            <span style={{
              display: "block", fontSize: 15, fontWeight: 600, color: T.label, marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{assignment.title}</span>
            <span style={{ display: "block", fontSize: 13, color: T.label2, marginTop: 2 }}>
              {assignment.subjectName} · due {dueText}
            </span>
          </span>
        </button>
        <button onClick={onDismiss} aria-label="Dismiss" style={{
          background: "none", border: "none", padding: 4, cursor: "pointer",
          color: T.label3, fontSize: 15, flexShrink: 0, minWidth: 28, minHeight: 28,
        }}>✕</button>
      </div>
    </div>
  );
}
