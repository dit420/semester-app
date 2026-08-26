/* Attendance maths. Pure — no imports from React, no data module, no I/O.
   Keep it that way: this is the part that must survive the move to Supabase
   unchanged, and it is the only part worth unit testing.

   The key property of this timetable: every class in the term is already
   scheduled and numbered, so the total per subject is known on day one. The
   target is therefore an exact count ("attend 12 of 15"), not a drifting
   percentage. That is what makes a warning possible before it is too late.

   Unmarked past classes are excluded from the ratio but still consume the
   term's supply, so they lower the achievable ceiling until resolved. */

import { isDone, type DatedSession } from "./dates.js";

export const TARGET = 0.8;

export type AttendanceStatus = "present" | "absent" | "cancelled";

/** The minimal shape statsFor needs: a dated session it can look up by id. */
export interface AttendanceSession extends DatedSession {
  id: string;
}

export type AttendanceRecords = Record<string, AttendanceStatus>;

export interface SubjectStats {
  effTotal: number;
  required: number;
  attended: number;
  absent: number;
  unmarked: number;
  remaining: number;
  cancelled: number;
  pct: number | null;
  canSkip: number;
  unreachable: boolean;
}

export function statsFor(
  subjectSessions: AttendanceSession[],
  records: AttendanceRecords,
  todayKey: string,
  nowMin: number
): SubjectStats {
  let attended = 0, absent = 0, unmarked = 0, remaining = 0, cancelled = 0;

  for (const s of subjectSessions) {
    const rec = records[s.id];
    if (rec === "cancelled") { cancelled++; continue; }
    if (!isDone(s, todayKey, nowMin)) { remaining++; continue; }
    if (rec === "present") attended++;
    else if (rec === "absent") absent++;
    else unmarked++;
  }

  const effTotal = subjectSessions.length - cancelled;
  const required = Math.ceil(TARGET * effTotal);
  const held = attended + absent;
  const ceiling = attended + remaining; // best still achievable

  return {
    effTotal, required, attended, absent, unmarked, remaining, cancelled,
    pct: held === 0 ? null : attended / held,
    canSkip: Math.max(0, ceiling - required),
    unreachable: ceiling < required,
  };
}
