#!/usr/bin/env python3
"""
Parse the college timetable spreadsheet into clean session records.

The sheet is a flat, date-driven schedule — NOT a recurring weekly pattern.
Structure:
    col A  date          (present only on the first row of each day, fill down)
    col B  weekday name  (same)
    col C  "HH:MM - HH:MM"  (present on the first row of each time slot)
    col D  "SUBJECT-GROUP-SESSION#-FACULTY-ROOM"

A single time slot spans several rows; each row in the slot holds at most one
class. The two groups (A and B) run concurrent classes in the same slot, so a
slot typically yields two sessions — one per group.

Usage:
    python3 parse_timetable.py timetable.xlsx -o timetable.json
"""

import argparse
import json
import re
import sys
from collections import Counter, defaultdict

from openpyxl import load_workbook

# "PHI-I-B-4-Dr. Ranjith Kallyani-CR -08"
#   subject may itself contain hyphens (PHI-I, OC-II, Y&M-I), so the subject
#   group is lazy and the anchors do the work: group is a single letter,
#   session is digits, room matches CR-<n> with optional spacing.
ENTRY = re.compile(
    r"^(?P<subject>.+?)"
    r"-(?P<group>[A-Z])"
    r"-(?P<n>\d+)"
    r"-(?P<faculty>.+?)"
    r"-\s*(?P<room>CR\s*-\s*\d+)\s*\.?$"
)

TIME = re.compile(r"^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$")


def parse(path, sheet=None):
    wb = load_workbook(path, data_only=True)
    ws = wb[sheet] if sheet else wb[wb.sheetnames[0]]

    sessions, problems = [], []
    date = day = slot = None

    for rownum, (a, b, c, d) in enumerate(
        ws.iter_rows(min_row=1, max_col=4, values_only=True), start=1
    ):
        # header / spacer rows
        if a == "Date" or (a is None and b is None and c is None and d is None):
            continue

        if a is not None:
            date = a.date() if hasattr(a, "date") else a
            day = (b or "").strip() if isinstance(b, str) else b
            slot = None

        if isinstance(c, str) and c.strip():
            m = TIME.match(c.strip())
            if not m:
                problems.append((rownum, f"unreadable time {c!r}"))
                slot = None
            else:
                slot = m.groups()

        if not (isinstance(d, str) and d.strip()):
            continue

        if date is None or slot is None:
            problems.append((rownum, f"class {d!r} with no date or time in scope"))
            continue

        m = ENTRY.match(d.strip())
        if not m:
            problems.append((rownum, f"unreadable class {d!r}"))
            continue

        g = m.groupdict()
        sessions.append(
            {
                "date": str(date),
                "day": day,
                "start": slot[0],
                "end": slot[1],
                "subject": g["subject"].strip(),
                "group": g["group"],
                "n": int(g["n"]),
                "faculty": g["faculty"].strip(),
                "room": re.sub(r"\s+", "", g["room"]),
            }
        )

    return sessions, problems


def validate(sessions):
    """Checks that only make sense for this sheet's own conventions."""
    warnings = []

    # Session numbers must run 1..N per subject+group with no gaps or repeats.
    # This is the strongest integrity check available: the sheet numbers every
    # class, so a parse error or a missing row shows up as a break in the run.
    by = defaultdict(list)
    for s in sessions:
        by[(s["subject"], s["group"])].append(s["n"])
    for (subj, grp), ns in sorted(by.items()):
        ns.sort()
        if ns != list(range(1, len(ns) + 1)):
            missing = sorted(set(range(1, max(ns) + 1)) - set(ns))
            dupes = [n for n, c in Counter(ns).items() if c > 1]
            warnings.append(
                f"{subj} group {grp}: session numbers not contiguous "
                f"(missing {missing or 'none'}, duplicated {dupes or 'none'})"
            )

    # A group cannot be in two rooms at once.
    seen = defaultdict(list)
    for s in sessions:
        seen[(s["group"], s["date"], s["start"])].append(s)
    for (grp, date, start), group in sorted(seen.items()):
        if len(group) > 1:
            names = ", ".join(f"{x['subject']}#{x['n']}" for x in group)
            warnings.append(f"group {grp} double-booked {date} {start}: {names}")

    return warnings


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("-o", "--out", default="timetable.json")
    ap.add_argument("--sheet")
    args = ap.parse_args()

    sessions, problems = parse(args.xlsx, args.sheet)
    warnings = validate(sessions)

    dates = sorted({s["date"] for s in sessions})
    groups = sorted({s["group"] for s in sessions})

    print(f"parsed   {len(sessions)} sessions")
    print(f"term     {dates[0]} to {dates[-1]}  ({len(dates)} teaching days)")
    print(f"groups   {', '.join(groups)}")
    for g in groups:
        counts = Counter(s["subject"] for s in sessions if s["group"] == g)
        total = sum(counts.values())
        print(f"  group {g}: {total} classes across {len(counts)} subjects")
        for subj, n in sorted(counts.items()):
            print(f"      {subj:<7} {n:>2}")

    if problems:
        print(f"\n{len(problems)} ROWS COULD NOT BE READ:", file=sys.stderr)
        for row, msg in problems:
            print(f"  row {row}: {msg}", file=sys.stderr)
    if warnings:
        print(f"\n{len(warnings)} WARNINGS:", file=sys.stderr)
        for w in warnings:
            print(f"  {w}", file=sys.stderr)
    if not problems and not warnings:
        print("\nno problems found")

    payload = {
        "term_start": dates[0],
        "term_end": dates[-1],
        "teaching_days": len(dates),
        "groups": groups,
        "sessions": sorted(sessions, key=lambda s: (s["date"], s["start"], s["group"])),
    }
    with open(args.out, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"\nwrote {args.out}")

    # A non-zero exit on unreadable rows makes this safe to run in a pipeline:
    # a partial parse should never silently become the app's source of truth.
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
