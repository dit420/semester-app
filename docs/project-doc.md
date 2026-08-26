# Semester Schedule & Attendance App — Project Doc

**Version:** 0.2
**Status:** Planning
**Stack:** React + Vite + Tailwind + Supabase (confirmed)
**Scope:** One semester. Build for this semester's needs, not a general-purpose product.

**Changes from v0.1:** Supabase confirmed. Timetable is now user-uploaded via CSV rather than seeded per group. Assignment tracker added to scope.

---

## 1. Problem

Three recurring annoyances across a semester:

1. **"What class do I have next?"** The official timetable is a wall of a spreadsheet.
2. **"Can I skip this?"** The 80% rule is enforced, but nobody knows their live number until it's too late. The useful question isn't "what's my percentage" — it's *"how many more can I miss?"*
3. **"What's due this week?"** Assignment deadlines live scattered across WhatsApp groups and whiteboards.

## 2. Goals (v1)

- Upload a timetable as CSV; share it with classmates via a code so it's uploaded once, not sixty times.
- Home screen shows today's classes in order, with the current/next class distinct.
- Scroll sideways to any day of the semester; yesterday/today/tomorrow are the default view.
- One-tap attendance marking: **Present / Absent / Cancelled**.
- Live per-subject attendance percentage plus a **bunk budget** — how many more classes can be missed at ≥80%.
- Assignment tracker with due dates, linked to subjects, surfaced on the home screen.

## 3. Non-goals

- Not an official record. The college register is the source of truth.
- No push notifications (v2).
- No file uploads or submission handling in the assignment tracker — it tracks deadlines, it isn't a dropbox.
- No faculty features, no grades, no notes.
- No flexible CSV column-mapping UI in v1 — strict template only (see §7).

## 4. Data ownership

| Entity | Scope | Notes |
|---|---|---|
| Timetable (subjects, slots) | Owned by uploader | Shared to others via share code |
| Class sessions | Derived from timetable | Regenerated on timetable change |
| Attendance records | Private per user | Never visible to anyone else |
| Assignments | Private per user | v2: optional sharing within a timetable |
| Target percentage | Private per user | Default 80 |

**The sharing model:** a `Timetable` row has an owner and a short `share_code`. Importing a timetable copies nothing — the importer's user record simply points at the same timetable id. One canonical copy, many readers. If the owner re-uploads a corrected CSV, everyone sees the fix.

Consequence: **auth is foundational now, not an add-on.** Nothing persists without a user. Plan accordingly — this is the main structural change from v0.1.

## 5. Domain model

```
User
  id, email, name, timetable_id, target_percentage (default 80)

Timetable
  id, owner_id, name ("Group 8 — Sem 5"),
  share_code (6 chars), semester_start, semester_end

Subject
  id, timetable_id, code, name, faculty,
  type (lecture | lab | tutorial), credit_weight

TimetableSlot                    -- recurring weekly pattern
  id, timetable_id, subject_id,
  day_of_week (0-6), start_time, end_time, room

ClassSession                     -- concrete dated instance
  id, slot_id, date, status (scheduled | cancelled | extra)

AttendanceRecord                 -- one per user per session, only if marked
  id, user_id, session_id, status (present | absent | cancelled), marked_at

Assignment
  id, user_id, subject_id, title, notes,
  due_date, status (pending | submitted | done), created_at
```

**Why `ClassSession` is its own table:** the weekly pattern can't express holidays, a cancelled lab, or a Saturday makeup class. Generating dated sessions once, up front, turns every downstream query into a date filter instead of a recurrence calculation. ~600 rows per timetable per semester. Cheap.

### Row-level security (the whole backend, essentially)

```sql
-- attendance: users see only their own
create policy "own attendance" on attendance_records
  for all using (auth.uid() = user_id);

-- assignments: users see only their own
create policy "own assignments" on assignments
  for all using (auth.uid() = user_id);

-- timetable data: readable by anyone pointed at that timetable
create policy "read own timetable" on subjects
  for select using (
    timetable_id = (select timetable_id from users where id = auth.uid())
  );

-- only the owner can modify the timetable
create policy "owner writes" on subjects
  for insert with check (
    timetable_id in (select id from timetables where owner_id = auth.uid())
  );
```

Mirror the last two for `timetable_slots` and `class_sessions`. That's the entire server-side authorization model.

## 6. The attendance math

For a given subject: `h` = sessions held (excluding cancelled), `a` = attended, `r` = remaining, `p` = target (0.8).

**Current**
```
current = a / h                          -- show "—" when h = 0
```

**Bunk budget — how many remaining classes can be skipped**
```
can_skip = floor(a + r - p × (h + r))    -- clamp at 0
```

**Recovery — if below target, consecutive classes needed**
```
must_attend = ceil((p × h - a) / (1 - p))
```
At p = 0.8 this is `ceil(4 × (0.8h - a))`. If `must_attend > r`, the target is unreachable this semester — say that plainly rather than showing a large number.

**Projection if everything remaining is attended**
```
projected = (a + r) / (h + r)
```

### Edge cases
- **Cancelled classes must not count in `h`.** The most common bug in attendance trackers.
- **Unmarked past sessions** are neither present nor absent. Don't guess — nag instead (§8, catch-up strip).
- **Labs may weigh more than lectures.** Sum `credit_weight`, not raw session counts.
- **`h = 0`** breaks every formula above. Special-case it.

## 7. CSV upload

### The decision: strict template, not flexible parsing

A parser that handles whatever a college registrar exports — merged cells, subjects as column headers, times in row one, notes in random cells — is a week of work and still fails on the next format. Instead: ship a downloadable template. The user reformats once, by hand, in ten minutes.

This converts an open-ended parsing problem into a validation problem, which is tractable.

### Template format

```csv
subject_code,subject_name,faculty,type,day,start_time,end_time,room
CS301,Operating Systems,Dr. Sharma,lecture,Monday,09:00,10:00,LH-4
CS302,DBMS Lab,Dr. Rao,lab,Monday,11:00,13:00,L-12
CS303,Computer Networks,Dr. Iyer,lecture,Tuesday,14:00,15:00,LH-2
```

- One row per weekly occurrence. A class meeting three times a week is three rows.
- `type` ∈ `lecture | lab | tutorial`
- `day` = full English weekday name
- Times in 24-hour `HH:MM`

### Upload flow

1. Download template → fill → upload.
2. Parse client-side (PapaParse). Validate every row.
3. **Preview screen before anything is written.** Show the parsed timetable as a weekly grid. Errors listed per row with line numbers: *"Row 7: `day` must be a weekday name, got 'Mon.'"*
4. On confirm: create timetable, subjects, slots; generate sessions across the semester date range.
5. Show the share code.

**The preview step is not optional.** A silent bad import produces a wrong timetable and wrong attendance percentages for the rest of the semester, and the user won't notice until it matters.

### Re-upload
Replacing a timetable deletes and regenerates sessions. **Attendance records reference sessions**, so this would orphan them. Handle it: match new sessions to old by `(subject_code, date, start_time)` and carry attendance across where they match. Warn the user about anything that can't be matched.

## 8. Home page

```
┌──────────────────────────────────────────┐
│  Tue, 25 Aug             Group 8 · Sem 5 │
│  ⚠ 3 classes unmarked from last week  →  │  ← catch-up strip
├──────────────────────────────────────────┤
│    ← YESTERDAY | ▸ TODAY | TOMORROW →    │  ← horizontal scroll-snap rail
│  ┌────────────────────────────────────┐  │
│  │ 09:00  Operating Systems      LH-4 │  │
│  │ 10:00  ✓ present                   │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ 11:00  DBMS Lab               L-12 │  │  ← NOW: accent border,
│  │ 13:00  [ Present ] [ Absent ]      │  │     scrolled into view on load
│  │        ● assignment due Friday     │  │  ← subject-linked assignment
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│  DUE THIS WEEK                           │
│  ● DBMS  ER diagram         Fri · 3d     │
│  ● CN    Socket programming Sun · 5d     │
├──────────────────────────────────────────┤
│  ATTENDANCE                              │
│  OS      86%  ▓▓▓▓▓▓▓▓░░   skip 3 more   │
│  DBMS    78%  ▓▓▓▓▓▓▓░░░   attend 2 ⚠    │
│  CN      91%  ▓▓▓▓▓▓▓▓▓░   skip 6 more   │
└──────────────────────────────────────────┘
```

### Behaviour
- **Day rail** holds every day of the semester in a scroll-snap container. Yesterday/today/tomorrow are simply the three in view at rest, today centred. Less code than a bespoke three-day widget, and more useful.
- **Auto-scroll to now** on open. On a 9-to-5 day nobody should scroll to find 2 PM.
- **Marking is time-gated** — a class can't be marked before it starts.
- **Assignment badge on class cards** is the one real integration between the two features. Seeing "due Friday" while sitting in that subject's class is worth more than a separate assignments tab.
- **Catch-up strip** appears only when past sessions are unmarked; tapping opens a focused list to clear them in a few taps. Without this the data rots and the percentages become fiction.
- **Weekends and holidays** get an empty state, not a blank screen.

## 9. Assignment tracker

Deliberately minimal. Add, edit, mark done, delete.

- **Add:** title, subject (dropdown from the user's timetable), due date, optional notes.
- **List views:** grouped by due date — overdue, this week, later, done.
- **Home surface:** "Due this week" strip, plus per-class badges.
- **Overdue** items stay visible and turn red. They don't auto-hide.

Not in v1: file attachments, recurring assignments, subtasks, reminders, shared/group assignments. Each is a reasonable v2 item; none is needed to make the tracker useful.

## 10. Execution plan

Every phase ends in something runnable. Don't start a phase until the previous one works.

### Phase 1 — Static home page
Vite + React + Tailwind. Hardcode a sample timetable as JSON. Build the day rail, class cards, session generation from weekly slots. No auth, no database.
**Done when:** you can scroll to any day of a fake semester and it looks right.

### Phase 2 — Supabase auth + schema
Supabase project, tables from §5, RLS policies. Sign up, log in, session persistence, protected routes.
**Done when:** two accounts exist and each sees only its own rows. Test RLS deliberately — try to read another user's attendance and confirm it fails.

### Phase 3 — CSV upload
Template download, PapaParse, per-row validation, preview grid, confirm-and-write, session generation, share code, import-by-code.
**Done when:** you upload your real timetable and the home page shows your actual classes.

*This is the first moment the app becomes yours rather than a demo. If a phase is going to slip, expect it to be this one — validation edge cases multiply.*

### Phase 4 — Attendance
Marking UI wired to Supabase. §6 formulas as pure functions in one file (`lib/attendance.ts`) — keep them free of database calls so they're trivially testable. Per-subject summary, catch-up strip, warning states.
**Done when:** you've used it for a week of real classes and the numbers match your own count.

### Phase 5 — Assignments
Schema, CRUD, list views, "due this week" strip, class-card badges.
**Done when:** you're tracking real deadlines in it.

### Phase 6 — Ship
Responsive polish (this lives on a phone), empty and error states, PWA manifest for home-screen install, deploy to Vercel. Hand it to three classmates and watch them use it without instructions.
**Done when:** someone other than you has used it for a week.

### Sequencing note
Phases 1–4 are the product. Phase 5 is additive and cuttable — if the semester gets busy, an app that nails attendance and ships is worth more than a half-finished app that also does assignments. Keep it last for exactly that reason.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Users won't reformat their timetable into the template | Make the template obvious and the preview forgiving; it's a one-time ten-minute cost |
| Bad import goes unnoticed | Mandatory preview step before any write |
| Re-upload orphans attendance records | Match-and-carry logic in §7 |
| RLS misconfigured, users read each other's data | Explicitly test cross-account reads in Phase 2, before there's real data |
| Users stop marking attendance | Catch-up strip; one-tap marking from home |
| 80% is enforced overall, not per subject | Config flag — same records, different aggregation |
| Scope creep | §3 exists. Re-read it |

## 12. Open questions

1. **Per subject or overall 80%?** Doc assumes per subject.
2. **Do labs count as multiple attendances?** Sets `credit_weight`.
3. **Semester start/end dates and known holidays** — needed to generate sessions.
4. **Electives** — do people sharing a timetable split into different subjects at the same hour? This breaks the one-shared-timetable model and needs handling if so.
5. **Email/password or Google sign-in?** Google is fewer screens and no password reset flow to build.

## 13. Next action

Phase 1. It needs no CSV and no Supabase project — start immediately with sample data, and slot your real timetable in at Phase 3.
