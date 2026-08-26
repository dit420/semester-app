export const pad = (n: number): string => String(n).padStart(2, "0");
export const key = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (s: string): Date => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** "09:15" -> 555. All time comparison goes through this; never compare time strings. */
export const mins = (t: string): number => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export const fmtDur = (m: number): string =>
  m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`;

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The minimal shape isDone (and, transitively, statsFor) needs — not the
    full Session type, so these pure modules don't have to import the domain
    model just to describe what they actually touch. */
export interface DatedSession {
  date: string;
  start: string;
  end: string;
}

/** Has this session finished, as of now? */
export const isDone = (s: DatedSession, todayKey: string, nowMin: number): boolean =>
  s.date < todayKey || (s.date === todayKey && mins(s.end) <= nowMin);
