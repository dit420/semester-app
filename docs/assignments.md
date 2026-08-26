# Shared assignments

A class-wide list of what's due, that anyone in the group can add to.

## Why this changes the plan

The moment classmates need to see each other's posts, the data stops being
personal. Three consequences, all of which land before a single line of UI:

1. **localStorage is out.** Shared state needs a server. Supabase moves from
   "later" to "first".
2. **Auth becomes a prerequisite.** Not a nice-to-have phase — the feature
   cannot exist without accounts, because every post needs an author.
3. **The threat model stops being "bugs" and starts being "people".** A crash
   loses your own data. A shared writable list loses *everyone's* data, and it
   only takes one person, once, in the week deadlines are due.

## The design problem

Sixty people, one writable list, no moderators. The schema is easy; deciding who
can destroy what is not.

### What was rejected

**Everyone edits everything (wiki).** Maximum flexibility, and one accidental
delete during a lecture takes out the class's deadline list. No audit trail, no
recovery, no way to know it happened.

**Only class reps can post.** Safe, but it creates a bottleneck exactly when it
matters most — the rep is in a different lecture when the deadline is announced,
and the list is stale by the time it's useful. Most posts would never happen.

### What was chosen

**Anyone posts. Only the author edits or retracts. Retraction is soft.**

- Any group member can add an assignment. No gatekeeping, no waiting.
- Only the person who posted it can change or remove it. A mistake costs one
  entry, not the list.
- "Removal" sets `deleted_at` and `deleted_by`. Nothing is destroyed, so a bad
  retraction is a one-line SQL fix rather than a lost week.
- Every entry shows who posted it and when. Attribution is the main deterrent —
  in a class where everyone knows everyone, a name next to a post does more work
  than any permission system.

**Correctness comes from corroboration, not moderation.** Anyone can tap
"confirm" on an entry. "9 classmates confirmed" tells you a deadline is real
without giving anyone the power to delete a stranger's post. Wrong entries get
outvoted by an accurate duplicate rather than deleted by someone who happens to
disagree.

There is a deliberate gap: nobody can fix someone else's typo. That's the price
of nobody being able to delete someone else's post, and it's the right trade at
this size.

## Shared vs private

This mirrors the split the app already uses for timetable and attendance:

| Shared with the group | Private to you |
|---|---|
| The assignment itself | Whether you've done it |
| Who posted it, when | Your attendance marks |
| Confirmation count | — |

Your progress never leaks. Nobody can see that you haven't started the
Philosophy essay, and the "done" tick is enforced by row level security rather
than by UI convention — `assignment_completions` only ever returns your own rows.

## Access

Anyone who can sign up can read the group's list. Without a restriction that
means anyone with the URL. Two options, both in the migration file:

- **College email domain check** — a trigger on `auth.users`. Simple, and ties
  identity to something the college already controls.
- **Invite code** — a shared secret entered at signup. More friction, works if
  the college has no consistent email domain.

Pick one before this is shared beyond a handful of people.

## Data model

See `supabase/migrations/0001_schema.sql`. Summary:

- `profiles` — name, group, linked to `auth.users`
- `assignments` — shared, group-scoped, soft-deletable, author-owned
- `assignment_confirmations` — the "this is real" signal
- `assignment_completions` — private, your done-state
- `attendance_records` — private, moved from React state

`assignments.group_code` accepts `'BOTH'` for work set to the whole cohort, since
several subjects run identical sessions for A and B.

## Attachments

The schema supports a file per assignment (a photo of the whiteboard, a brief
PDF) via a private storage bucket, capped at 10 MB and restricted to images and
PDFs. Users can only write into a folder named after their own user id.

**Consider shipping without it first.** The value is in "Philosophy essay, due
Friday" — that's a title and a date. Upload UI, progress states, failure
handling, and thumbnails are a meaningful chunk of work for a smaller payoff.
The column and bucket exist so adding it later needs no migration.

## Build order

1. **Auth + profile.** Sign in, pick a group, land in the app. Nothing else
   works until this does.
2. **Move attendance to Supabase.** Do this before assignments — it's the
   simpler table, it exercises the same RLS patterns, and it fixes the existing
   "refresh wipes everything" problem. `loadAttendance()` returns the same
   `{ [sessionId]: status }` shape the UI already consumes, so `statsFor()` and
   every component stay untouched.
3. **Test RLS adversarially.** Two accounts, different groups. Try to read the
   other's attendance and completions. Confirm you get zero rows. Do this while
   the data is disposable — RLS failures return empty results, not errors, so
   they don't announce themselves.
4. **Assignments read path.** List, group by due date, show author and
   confirmation count. Read-only first.
5. **Write path.** Add, edit own, retract own, confirm, mark done.
6. **Home screen surface.** "Due this week" strip, and a badge on the class card
   for a subject with something due — seeing "essay due Friday" while sitting in
   that lecture is where this earns its place.
7. **Realtime.** `subscribeAssignments()` so a deadline posted during a lecture
   appears on everyone's phone without a refresh. Small change, feels like
   magic.
8. **Attachments**, if still wanted.

## Worth deciding before building

- **Domain restriction or invite code?** Needed before you share the link.
- **Should `BOTH` be the default** when posting, or group-only? Depends how much
  of the coursework is genuinely common across A and B.
- **Do you want a comment thread per assignment?** It's the natural answer to
  "nobody can fix someone else's typo", but it's a whole second feature and
  invites a different kind of noise. Ship without it and see if the gap actually
  hurts.
