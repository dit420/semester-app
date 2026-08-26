# CLAUDE.md

Context for working on this repo. Read before making changes.

## What this is

A class timetable and attendance tracker for one student, for one term
(20 Aug – 9 Oct 2026). Two jobs, in priority order:

1. **"What class do I have now?"** — home screen shows today, scroll sideways for
   any other day.
2. **"Can I skip this?"** — per-subject count of how many more classes may be
   missed while staying at 80%.

It is a personal tracker, not an official record. The college register is the
source of truth.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # attendance maths (the part worth testing)
npm run data         # re-parse data/timetable.xlsx -> src/data/timetable.ts
npm run typecheck    # tsc --noEmit
```

Python parsing needs `pip install -r scripts/requirements.txt` (openpyxl only).

## The data, and why it shapes everything

The source is `data/timetable.xlsx`, a real college schedule. Three properties
of it drove most design decisions, and getting them wrong will send you down the
wrong path:

**1. It is a flat dated schedule, not a weekly pattern.** There is no recurrence
rule. All 220 sessions are listed individually across 38 teaching days, and the
pattern genuinely differs week to week. Do not add a "weekly slot" or
recurrence-expansion layer — there is nothing to expand.

**2. Groups are A and B, not numbered.** Group A sits in CR-06, group B in CR-08
(Yoga is CR-02 for both). The user originally said "group 8", which was the
*classroom*, not the group. **Group B is the working assumption and needs
confirming.**

**3. Every class is pre-numbered `SUBJECT-GROUP-N-FACULTY-ROOM`, so the total per
subject is known on day one.** This is the important one. It means 80% is an
exact count, not a drifting percentage:

| Subject | Total | Needed | May miss |
|---|---|---|---|
| EHV, FMS, IIS, IKS, POE, PSY | 15 | 12 | 3 |
| PHI-I | 9 | 8 | **1** |
| OC-II | 6 | 5 | **1** |
| Y&M-I | 5 | 4 | **1** |

Three subjects allow exactly one absence for the entire term. A percentage-based
tracker would only reveal this after it was too late to act. Preserve this
framing — "2 more absences allowed" beats "84%" everywhere in the UI.

The session numbering is also the strongest validation available: numbers must
run 1..N with no gaps. `scripts/parse_timetable.py` checks this and exits
non-zero on failure, so a partial parse never silently becomes the app's truth.

## Layout

```
src/
  App.tsx                  screen composition and state; no maths, no styling constants
  types.ts                 domain types: Session, Assignment, Profile, etc.
  theme.ts                 LIGHT / DARK tokens, type scale, useTheme()
  data/timetable.ts        GENERATED — do not hand-edit, run `npm run data`
  lib/
    attendance.ts          pure maths, no React, no imports from data/
    attendance.test.ts     8 tests covering the rounding and ceiling rules
    dates.ts               date + time helpers
  hooks/
    useDayRail.ts          horizontal scroll-snap rail and centring
  components/              presentational; all take `T` (theme) as a prop, .tsx
  lib/store.ts             ALL Supabase calls; components never import the client
scripts/
  parse_timetable.py       xlsx -> data/timetable.json, with validation
  to_js.py                 timetable.json -> src/data/timetable.ts
supabase/migrations/       schema + row level security
docs/
  project-doc.md           full spec and phase plan
  assignments.md           shared-assignment design and trust model
```

## Rules that matter

**Keep `lib/attendance.ts` pure.** No React, no data imports, no I/O. It takes
sessions and records and returns numbers. This is what survives the move to
Supabase unchanged, and it is the only code where a bug silently produces
plausible-but-wrong output. Add a test with every change.

**Never hardcode a colour in a component.** Add a token to `theme.ts`. Both
light and dark must be handled or dark mode breaks silently.

**Attendance state must never be guessed.** A past class with no mark is
*unmarked* — excluded from the percentage, but it still consumes the term's
supply, so it lowers the achievable ceiling. That asymmetry is deliberate and
tested; don't "simplify" it into counting unmarked as absent or ignoring it.

**Cancelled classes leave the denominator.** Most common bug in this category
of app.

**Design follows platform HIG conventions:** sentence case (not ALL CAPS), tap
targets ≥44px, semantic system colours, glyphs alongside colour so state does
not depend on colour vision. The register cells (`✓ ✕ ? –`) exist for this
reason.

## Landmine

`useDayRail.ts` centres the rail by measuring panel elements. The ref **must**
sit on an element that generates a layout box. A `display: contents` wrapper
measures as zero width at zero offset, so centring silently computes garbage and
the rail lands on day one instead of today. This was a real bug. There is a
comment at the call site in `App.tsx`; leave it there.

Centring also runs three times — after layout, next frame, and on
`document.fonts.ready` — because panel widths shift as font metrics resolve. One
pass lands a day or two off on cold load.

## State of things

Working, all client-side: day rail, today-centring, class cards with
proportional free-period gaps, live now-marker, attendance marking, per-class
register, exact absence budgets, catch-up sheet, light/dark, keyboard arrows.

**Nothing is persisted.** `records` is React state — a refresh wipes it.

Written but not yet wired up: `supabase/migrations/0001_schema.sql` (full schema
+ RLS) and `src/lib/store.js` (the data layer). Neither has been run against a
live project — there wasn't one to test against. Expect to debug the first
queries.

## Next up, in order

Shared assignments changed this ordering. Because classmates must see each
other's posts, the data is inherently multi-user, so **localStorage is no longer
a useful first step** — it would be thrown away immediately. Supabase is now
task one, and auth is a prerequisite rather than a later phase.

1. **Auth + profile.** Sign in, pick group, land in the app. Everything else
   depends on this.
2. **Move attendance to Supabase.** Before assignments: simpler table, same RLS
   patterns, and it fixes the refresh-wipes-everything problem. `loadAttendance()`
   returns the same `{ [sessionId]: status }` shape the UI already uses, so
   `statsFor()` and every component stay untouched.
3. **Test RLS adversarially.** Two accounts in different groups. Try to read the
   other's rows and confirm you get zero. Do it while the data is disposable —
   RLS failures return empty results, not errors, so they never announce
   themselves.
4. **Assignments**, read path then write path. See `docs/assignments.md`.
5. **Home screen surface** for assignments — "due this week" strip, plus a badge
   on the class card when that subject has something due.
6. **Realtime** via `subscribeAssignments()`.
7. In-app timetable upload, so other students can use it at all. Needs a
   mandatory preview step before writing — a silent bad import produces wrong
   attendance for a whole term.
8. Attachments, PWA manifest, deploy.

## Shared vs private — the rule to hold onto

The app has one organising principle. Reference data is shared; personal
judgements are private.

| Shared | Private |
|---|---|
| Timetable | Attendance marks |
| The assignment itself | Whether you've done it |
| Who posted it, confirmation count | — |

Never let a private table become readable by the group. Nobody should be able to
see that a classmate hasn't started an essay, and that's enforced by row level
security, not by what the UI happens to render.

## Shared writable data — the trust model

~60 people share one assignment list with no moderators. The rules, and why:

- **Anyone in the group can post.** Gatekeeping means the list is stale exactly
  when it matters.
- **Only the author can edit or retract.** One person's mistake costs one entry,
  not the class's whole list.
- **Retraction is soft** — sets `deleted_at` / `deleted_by`, never destroys.
  There is deliberately **no DELETE policy** on `assignments`. Don't add one.
- **Every entry shows its author.** In a class where everyone knows everyone,
  attribution does more work than permissions.
- **Correctness comes from corroboration.** "9 classmates confirmed" beats
  moderation, because it needs nobody to hold delete power over a stranger's
  post.

Known gap: nobody can fix someone else's typo. That is the accepted cost of
nobody being able to delete someone else's post.

## Open questions for the user

- **Signup must be restricted before the link is shared.** Right now anyone with
  the URL could join a group and post to it. The migration has both a college
  email-domain trigger and an invite-code note, commented out. Pick one.

- Is Group B correct?
- Are the subject names right? The sheet has codes only; the expansions in
  `scripts/to_js.py` are inferred.
- Does the college round 80% of 6 up to 5, or down to 4? Currently `Math.ceil`,
  which is the strict reading and the difference between one absence and two in
  OC-II.
- Is 80% enforced per subject, or across all subjects? Per subject is assumed.
