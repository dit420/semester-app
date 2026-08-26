import { describe, it, expect } from "vitest";
import { statsFor, TARGET, type AttendanceRecords, type AttendanceSession } from "./attendance.js";

const TODAY = "2026-09-01";
const NOW = 12 * 60;
const mk = (n: number, date: string): AttendanceSession => ({ id: `X-${n}`, date, start: "09:15", end: "10:45" });
const past = (n: number) => mk(n, "2026-08-20");
const future = (n: number) => mk(n, "2026-10-01");

describe("statsFor", () => {
  it("reports no percentage before any class is held", () => {
    const s = statsFor([future(1), future(2)], {}, TODAY, NOW);
    expect(s.pct).toBe(null);
    expect(s.remaining).toBe(2);
  });

  it("derives the required count from the full term, not classes so far", () => {
    // 15 total -> 80% of 15 is 12, even on day one
    const all = Array.from({ length: 15 }, (_, i) => future(i + 1));
    expect(statsFor(all, {}, TODAY, NOW).required).toBe(12);
  });

  it("rounds the requirement up, never down", () => {
    // 6 classes: 80% is 4.8, so 5 are needed and only 1 may be missed
    const all = Array.from({ length: 6 }, (_, i) => future(i + 1));
    const s = statsFor(all, {}, TODAY, NOW);
    expect(s.required).toBe(5);
    expect(s.canSkip).toBe(1);
  });

  it("excludes cancelled classes from the total", () => {
    const all = Array.from({ length: 10 }, (_, i) => past(i + 1));
    const rec: AttendanceRecords = { "X-1": "cancelled", "X-2": "cancelled" };
    const s = statsFor(all, rec, TODAY, NOW);
    expect(s.effTotal).toBe(8);
    expect(s.required).toBe(Math.ceil(TARGET * 8));
  });

  it("keeps unmarked past classes out of the ratio", () => {
    const all = [past(1), past(2), past(3)];
    const s = statsFor(all, { "X-1": "present" }, TODAY, NOW);
    expect(s.attended).toBe(1);
    expect(s.unmarked).toBe(2);
    expect(s.pct).toBe(1); // 1 of 1 held, not 1 of 3
  });

  it("still counts unmarked past classes against the ceiling", () => {
    // 5 total, need 4. Two went by unmarked, so at best 3 can be attended.
    const all = [past(1), past(2), future(3), future(4), future(5)];
    const s = statsFor(all, {}, TODAY, NOW);
    expect(s.required).toBe(4);
    expect(s.unreachable).toBe(true);
  });

  it("flags a subject where the target can no longer be reached", () => {
    const all = [past(1), past(2), future(3), future(4), future(5)];
    const rec: AttendanceRecords = { "X-1": "absent", "X-2": "absent" };
    expect(statsFor(all, rec, TODAY, NOW).unreachable).toBe(true);
  });

  it("never returns a negative allowance", () => {
    const all = [past(1), past(2), past(3)];
    const rec: AttendanceRecords = { "X-1": "absent", "X-2": "absent", "X-3": "absent" };
    expect(statsFor(all, rec, TODAY, NOW).canSkip).toBe(0);
  });
});
