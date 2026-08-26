import { fmtDur, pad } from "../lib/dates.js";
import { num } from "../theme.js";
import type { Theme } from "../theme.js";

/* A free period rendered at a height proportional to its real length. Most
   timetable apps collapse gaps to nothing, but a college day is shaped as much
   by the two-hour hole after lunch as by the classes. */
export function GapRow({ T, minutes }: { T: Theme; minutes: number }) {
  return (
    <div className="flex items-center" style={{ height: Math.max(28, Math.min(60, minutes * 0.3)) }}>
      <div style={{ width: 58, flexShrink: 0 }} />
      <div style={{ flex: 1, borderTop: `1px solid ${T.separator}`, opacity: 0.5 }} />
      <span style={{ fontSize: 12, color: T.label3, paddingLeft: 10, ...num }}>
        {fmtDur(minutes)} free
      </span>
    </div>
  );
}

/* Red line with a leading dot — the platform's own current-time marker. */
export function NowLine({ T, nowMin }: { T: Theme; nowMin: number }) {
  return (
    <div className="flex items-center" style={{ height: 20 }} aria-label="Current time">
      <span style={{ width: 58, flexShrink: 0, fontSize: 12, fontWeight: 600, color: T.red, ...num }}>
        {pad(Math.floor(nowMin / 60))}:{pad(nowMin % 60)}
      </span>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: T.red, flexShrink: 0 }} />
      <div style={{ flex: 1, height: 1.5, background: T.red }} />
    </div>
  );
}
