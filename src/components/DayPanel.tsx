import type { ReactNode } from "react";
import Card from "./Card.js";
import ClassCard from "./ClassCard.js";
import { GapRow, NowLine } from "./TimeMarkers.js";
import { DAYS, MONTHS, mins, parseKey } from "../lib/dates.js";
import { num } from "../theme.js";
import type { Theme } from "../theme.js";
import type { Session, SubjectCard, AttendanceRecords, AttendanceStatus } from "../types.js";

const MIN_GAP = 20; // minutes below this read as a changeover, not a free period

export default function DayPanel({ T, date, list, statOf, records, todayKey, nowMin, onMark, dueSubjects = new Set() }: {
  T: Theme;
  date: string;
  list: Session[];
  statOf: (code: string) => SubjectCard | undefined;
  records: AttendanceRecords;
  todayKey: string;
  nowMin: number;
  onMark: (id: string, status: AttendanceStatus | null) => void;
  dueSubjects?: Set<string>;
}) {
  const d = parseKey(date);
  const isToday = date === todayKey;
  const rows: ReactNode[] = [];
  let nowPlaced = false;

  list.forEach((s, i) => {
    const prev = list[i - 1];
    if (prev) {
      const gap = mins(s.start) - mins(prev.end);
      if (gap >= MIN_GAP) {
        if (isToday && !nowPlaced && nowMin > mins(prev.end) && nowMin < mins(s.start)) {
          rows.push(<NowLine key={`now-${i}`} T={T} nowMin={nowMin} />);
          nowPlaced = true;
        }
        rows.push(<GapRow key={`gap-${i}`} T={T} minutes={gap} />);
      }
    } else if (isToday && !nowPlaced && nowMin < mins(s.start)) {
      rows.push(<NowLine key="now-start" T={T} nowMin={nowMin} />);
      nowPlaced = true;
    }

    const live = isToday && nowMin >= mins(s.start) && nowMin < mins(s.end);
    if (live) nowPlaced = true;

    rows.push(
      <ClassCard key={s.id} T={T} s={s} stat={statOf(s.code)} record={records[s.id]} live={live}
        markable={date < todayKey || (isToday && nowMin >= mins(s.start))} onMark={onMark}
        dueBadge={dueSubjects.has(s.code)} />
    );
  });

  if (isToday && !nowPlaced && list.length) rows.push(<NowLine key="now-end" T={T} nowMin={nowMin} />);

  return (
    <div>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 10, paddingLeft: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: isToday ? T.blue : T.label }}>
          {isToday ? "Today" : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`}
        </span>
        <span style={{ fontSize: 13, color: T.label2, ...num }}>
          {list.length ? `${list.length} ${list.length > 1 ? "classes" : "class"}` : ""}
        </span>
      </div>

      {list.length === 0 ? (
        <Card T={T} style={{ padding: "28px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.label }}>No classes</div>
          <div style={{ fontSize: 13, color: T.label2, marginTop: 3 }}>Nothing scheduled for your group.</div>
        </Card>
      ) : rows}
    </div>
  );
}
