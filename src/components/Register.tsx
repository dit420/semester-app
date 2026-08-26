import { DAYS, MONTHS, parseKey, isDone } from "../lib/dates.js";
import type { Theme } from "../theme.js";
import type { Session, AttendanceRecords } from "../types.js";

/**
 * One cell per class for the whole term. Viable only because these courses run
 * 5–15 sessions — "you have one empty box left" lands harder than "80%".
 *
 * Every state carries a glyph as well as a colour, so the information survives
 * colour blindness, greyscale printing, and a phone in bright sun.
 */
export default function Register({ T, sessions, records, todayKey, nowMin }: {
  T: Theme;
  sessions: Session[];
  records: AttendanceRecords;
  todayKey: string;
  nowMin: number;
}) {
  return (
    <div className="flex" style={{ gap: 4, flexWrap: "wrap" }}>
      {[...sessions].sort((a, b) => a.n - b.n).map((s) => {
        const rec = records[s.id];
        const done = isDone(s, todayKey, nowMin);
        let bg = "transparent", bd = T.separator, fg = T.label3, glyph = "";
        if (rec === "present") { bg = T.green; bd = T.green; fg = "#fff"; glyph = "✓"; }
        else if (rec === "absent") { bd = T.red; fg = T.red; glyph = "✕"; }
        else if (rec === "cancelled") { glyph = "–"; }
        else if (done) { bg = T.orange; bd = T.orange; fg = "#fff"; glyph = "?"; }

        const d = parseKey(s.date);
        const state = rec || (done ? "not marked" : "upcoming");
        const when = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
        return (
          <span key={s.id} role="img" aria-label={`Class ${s.n}, ${when}, ${state}`}
            title={`#${s.n} · ${when} · ${s.start} · ${state}`}
            style={{
              width: 17, height: 17, borderRadius: 4, border: `1.5px solid ${bd}`,
              background: bg, color: fg, fontSize: 9.5, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
            {glyph}
          </span>
        );
      })}
    </div>
  );
}
