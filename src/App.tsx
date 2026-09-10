import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session as AuthSession } from "@supabase/supabase-js";
import { useTheme, FONT, num } from "./theme.js";
import { SESSIONS, SUBS, DATES } from "./data/timetable.js";
import { statsFor, TARGET } from "./lib/attendance.js";
import { useDayRail } from "./hooks/useDayRail.js";
import { key, parseKey, addDays, mins, isDone, LONG, MONTHS } from "./lib/dates.js";
import {
  getSession, onAuthChange, signOut, signInWithMagicLink,
  getProfile, createProfile, loadAttendance, setAttendance,
  listAssignments, createAssignment, updateAssignment, retractAssignment,
  setConfirmed, setDone, listExtraSessions, createExtraSession, retractExtraSession,
} from "./lib/store.js";
import type { AssignmentFormData } from "./components/AssignmentForm.js";
import type { NewExtraSession } from "./lib/store.js";
import type {
  Group, Profile, Assignment, EnrichedAssignment, Session, SubjectCard,
  AttendanceRecords, AttendanceStatus, ExtraSession,
} from "./types.js";
import Card from "./components/Card.js";
import Segmented from "./components/Segmented.js";
import DayPanel from "./components/DayPanel.js";
import Register from "./components/Register.js";
import CatchUpSheet from "./components/CatchUpSheet.js";
import SignIn from "./components/SignIn.js";
import ProfileSetup from "./components/ProfileSetup.js";
import DueStrip from "./components/DueStrip.js";
import AssignmentsScreen from "./components/AssignmentsScreen.js";
import AssignmentForm from "./components/AssignmentForm.js";
import AddClassForm from "./components/AddClassForm.js";
import type { Theme } from "./theme.js";

function Loading({ T }: { T: Theme }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: T.bg, fontFamily: FONT, color: T.label2, fontSize: 15,
    }}>
      Loading…
    </div>
  );
}

type View = "home" | "assignments";

export default function App() {
  const T = useTheme();

  // undefined = still checking, null = signed out, object = signed in.
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [records, setRecords] = useState<AttendanceRecords>({});
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [view, setView] = useState<View>("home");
  const [formOpen, setFormOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  const [extraSessions, setExtraSessions] = useState<ExtraSession[]>([]);
  const [classError, setClassError] = useState<string | null>(null);
  const [classFormOpen, setClassFormOpen] = useState(false);

  useEffect(() => {
    getSession().then(setSession);
    const sub = onAuthChange(setSession);
    return () => sub.unsubscribe();
  }, []);

  // Resets on every session change, so switching accounts in one tab never
  // leaves the previous signed-in user's profile or marks on screen.
  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      setProfile(null);
      setRecords({});
      setRecordsLoaded(false);
      setAssignments([]);
      setAssignmentsLoaded(false);
      setExtraSessions([]);
      setView("home");
      return;
    }
    let cancelled = false;
    setProfile(undefined);
    getProfile().then((p) => { if (!cancelled) setProfile(p); });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    loadAttendance().then((r) => {
      if (!cancelled) { setRecords(r); setRecordsLoaded(true); }
    });
    return () => { cancelled = true; };
  }, [profile]);

  // Assignments load in parallel and never block the home screen — that stays
  // job one (CLAUDE.md), and this is a secondary surface on top of it.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    listAssignments()
      .then((rows) => { if (!cancelled) { setAssignments(rows); setAssignmentsLoaded(true); } })
      .catch((err: unknown) => { if (!cancelled) setAssignError(`Couldn't load assignments — ${(err as Error).message}`); });
    return () => { cancelled = true; };
  }, [profile]);

  const refreshAssignments = useCallback(async () => {
    setAssignments(await listAssignments());
  }, []);

  // Admin-added classes, same "load in parallel, never block home" pattern
  // as assignments.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    listExtraSessions()
      .then((rows) => { if (!cancelled) setExtraSessions(rows); })
      .catch((err: unknown) => { if (!cancelled) setClassError(`Couldn't load classes — ${(err as Error).message}`); });
    return () => { cancelled = true; };
  }, [profile]);

  const handleAddClass = useCallback(async (data: NewExtraSession) => {
    await createExtraSession(data);
    setExtraSessions(await listExtraSessions());
    setClassFormOpen(false);
  }, []);

  const handleDeleteClass = useCallback((id: string) => {
    if (!window.confirm("Remove this class for everyone in the group? This can't be undone from the app.")) return;
    setClassError(null);
    retractExtraSession(id)
      .then(() => setExtraSessions((rows) => rows.filter((e) => e.id !== id)))
      .catch((err: unknown) => setClassError(`Couldn't remove that class — ${(err as Error).message}`));
  }, []);

  const handleConfirm = useCallback((id: string, next: boolean) => {
    setAssignments((rows) => rows.map((r) => r.id === id
      ? { ...r, iConfirmed: next, confirmations: r.confirmations + (next ? 1 : -1) }
      : r));
    setConfirmed(id, next).catch((err: unknown) => {
      setAssignError(`Couldn't update confirmation — ${(err as Error).message}`);
      refreshAssignments();
    });
  }, [refreshAssignments]);

  const handleDoneToggle = useCallback((id: string, next: boolean) => {
    setAssignments((rows) => rows.map((r) => r.id === id ? { ...r, done: next } : r));
    setDone(id, next).catch((err: unknown) => {
      setAssignError(`Couldn't update — ${(err as Error).message}`);
      refreshAssignments();
    });
  }, [refreshAssignments]);

  const openCreate = useCallback(() => { setEditingAssignment(null); setFormOpen(true); }, []);
  const openEdit = useCallback((a: EnrichedAssignment) => { setEditingAssignment(a); setFormOpen(true); }, []);
  const closeForm = useCallback(() => setFormOpen(false), []);

  const handleCreateOrUpdate = useCallback(async (formData: AssignmentFormData) => {
    if (editingAssignment) {
      await updateAssignment(editingAssignment.id, {
        subject_code: formData.subjectCode,
        title: formData.title,
        details: formData.details,
        due_date: formData.dueDate,
        due_time: formData.dueTime,
      });
    } else {
      await createAssignment({ ...formData, groupCode: profile!.group_code });
    }
    await refreshAssignments();
    setFormOpen(false);
  }, [editingAssignment, profile, refreshAssignments]);

  const handleRetract = useCallback(async (id: string) => {
    await retractAssignment(id);
    await refreshAssignments();
    setFormOpen(false);
  }, [refreshAssignments]);

  // Subject metadata (display name, colour) attached once so AssignmentCard
  // and DueStrip stay presentational, matching how ClassCard receives it.
  const subjectMeta = useMemo(() => {
    const m: Record<string, { name: string; colorIdx: number }> = {};
    SUBS.forEach(([code, name], i) => { m[code] = { name, colorIdx: i }; });
    return m;
  }, []);

  // The static, generated schedule plus any admin-added classes, merged into
  // one Session pool so statsFor() and everything downstream of it (byDate,
  // Register, the day rail) never has to know the difference. Static
  // sessions keep their id/n exactly as generated — attendance marks are
  // keyed by id, so renumbering an existing one would silently detach it
  // from whatever mark it already has. Extra sessions get fresh n values
  // appended after the static count, and every session for that
  // subject+group (static and extra alike) gets a recomputed shared total.
  const allSessions: Session[] = useMemo(() => {
    const staticByKey = new Map<string, Session[]>();
    for (const s of SESSIONS) {
      const k = `${s.code}|${s.group}`;
      const arr = staticByKey.get(k);
      if (arr) arr.push(s); else staticByKey.set(k, [s]);
    }
    const extraByKey = new Map<string, ExtraSession[]>();
    for (const e of extraSessions) {
      const k = `${e.subjectCode}|${e.group}`;
      const arr = extraByKey.get(k);
      if (arr) arr.push(e); else extraByKey.set(k, [e]);
    }

    const out: Session[] = [];
    for (const k of new Set([...staticByKey.keys(), ...extraByKey.keys()])) {
      const statics = staticByKey.get(k) ?? [];
      const extras = extraByKey.get(k) ?? [];
      const total = statics.length + extras.length;
      for (const s of statics) out.push(total === s.total ? s : { ...s, total });
      let n = statics.length;
      for (const e of extras) {
        n += 1;
        const meta = subjectMeta[e.subjectCode];
        out.push({
          id: e.id, date: e.date, start: e.start, end: e.end,
          code: e.subjectCode, name: meta?.name ?? e.subjectCode,
          faculty: e.faculty ?? "TBA", total, colorIdx: meta?.colorIdx ?? 0,
          n, group: e.group, room: e.room ?? "TBA", isExtra: true,
        });
      }
    }
    return out;
  }, [extraSessions, subjectMeta]);

  const enrichedAssignments: EnrichedAssignment[] = useMemo(
    () => assignments.map((a) => ({
      ...a,
      subjectName: subjectMeta[a.subjectCode]?.name ?? a.subjectCode,
      colorIdx: subjectMeta[a.subjectCode]?.colorIdx ?? 0,
    })),
    [assignments, subjectMeta]
  );

  // Viewing group defaults to the signed-in user's own group but can still be
  // toggled to browse the other one; groupOverride tracks a manual choice.
  const [groupOverride, setGroupOverride] = useState<Group | null>(null);
  const group: Group = groupOverride ?? profile?.group_code ?? "B";

  const [sheetOpen, setSheetOpen] = useState(false);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const todayKey = key(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const weekEndKey = useMemo(() => key(addDays(now, 6)), [now]);

  const dueSubjects = useMemo(
    () => new Set(enrichedAssignments.filter((a) => !a.done).map((a) => a.subjectCode)),
    [enrichedAssignments]
  );

  const dueThisWeek = useMemo(
    () => enrichedAssignments
      .filter((a) => !a.done && a.dueDate >= todayKey && a.dueDate <= weekEndKey)
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0)),
    [enrichedAssignments, todayKey, weekEndKey]
  );

  // Every calendar day in the term, including days with no classes, so that
  // "today" always has a panel to land on.
  const dates = useMemo(() => {
    const out: string[] = [];
    let c = parseKey(DATES[0]);
    const end = parseKey(DATES[DATES.length - 1]);
    while (c <= end) { out.push(key(c)); c = addDays(c, 1); }
    return out;
  }, []);

  const beforeTerm = todayKey < dates[0];
  const afterTerm = todayKey > dates[dates.length - 1];
  const anchorIdx = beforeTerm ? 0 : afterTerm ? dates.length - 1 : dates.indexOf(todayKey);

  const { railRef, panelRefs, focusIdx, centerOn, onScroll, onKeyDown } = useDayRail(dates, anchorIdx);

  const byDate = useMemo(() => {
    const m: Record<string, Session[]> = {};
    for (const s of allSessions) {
      if (s.group !== group) continue;
      (m[s.date] ||= []).push(s);
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => mins(a.start) - mins(b.start));
    return m;
  }, [allSessions, group]);

  const stats: SubjectCard[] = useMemo(
    () => SUBS.map(([code], i) => {
      const sessions = allSessions.filter((s) => s.code === code && s.group === group);
      return {
        code, colorIdx: i, name: SUBS[i][1], sessions,
        ...statsFor(sessions, records, todayKey, nowMin),
      };
    }),
    [allSessions, group, records, todayKey, nowMin]
  );
  const statOf = useCallback((code: string) => stats.find((s) => s.code === code), [stats]);

  const unmarked = useMemo(
    () => allSessions
      .filter((s) => s.group === group && !records[s.id] && isDone(s, todayKey, nowMin))
      .sort((a, b) => (a.date === b.date ? mins(a.start) - mins(b.start) : a.date < b.date ? -1 : 1)),
    [allSessions, group, records, todayKey, nowMin]
  );

  // Optimistic: the mark shows immediately. If the write fails, roll the
  // local state back to what it was and surface the error.
  const mark = useCallback((id: string, status: AttendanceStatus | null) => {
    const prev = records[id] ?? null;
    setRecords((r) => {
      const next = { ...r };
      if (status === null) delete next[id]; else next[id] = status;
      return next;
    });
    setSyncError(null);
    setAttendance(id, status).catch((err: unknown) => {
      setRecords((r) => {
        const next = { ...r };
        if (prev === null) delete next[id]; else next[id] = prev;
        return next;
      });
      setSyncError(`Couldn't save that mark — ${(err as Error).message}`);
    });
  }, [records]);

  const handleSignIn = useCallback((email: string, inviteCode: string) => signInWithMagicLink(email, inviteCode), []);

  const handleProfileSetup = useCallback(async ({ name, groupCode }: { name: string; groupCode: Group }) => {
    const p = await createProfile({ name, groupCode });
    setProfile(p);
  }, []);

  if (session === undefined) return <Loading T={T} />;
  if (session === null) return <SignIn T={T} onSubmit={handleSignIn} />;
  if (profile === undefined) return <Loading T={T} />;
  if (profile === null) return <ProfileSetup T={T} onSubmit={handleProfileSetup} />;
  if (!recordsLoaded) return <Loading T={T} />;

  const fd = parseKey(dates[focusIdx]);
  const onToday = focusIdx === anchorIdx && !beforeTerm && !afterTerm;
  const risky = stats.filter((s) => s.unreachable || s.canSkip === 0).length;
  const daysLeft = dates.filter((d) => d >= todayKey).length;

  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: FONT, color: T.label }}>
      <style>{`button:focus-visible{outline:3px solid ${T.blue};outline-offset:2px}`}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 0 48px" }}>
        {/* top nav */}
        <div className="flex items-center justify-between" style={{ padding: "0 16px", marginBottom: 18, gap: 12 }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <Segmented<View> T={T} value={view} onChange={setView} label="Screen"
              options={[{ value: "home", label: "Home" }, { value: "assignments", label: "Assignments" }]} />
            {profile.is_admin && (
              <button onClick={() => setClassFormOpen(true)} style={{
                minHeight: 36, borderRadius: 8, border: "none", cursor: "pointer",
                background: T.fill, color: T.label, fontFamily: FONT, fontSize: 13, fontWeight: 600,
                padding: "0 12px",
              }}>+ Add class</button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.label }}>Hi, {profile.name}</span>
            <button onClick={() => signOut()} style={{
              background: "none", border: "none", padding: "2px", cursor: "pointer",
              fontFamily: FONT, fontSize: 12, fontWeight: 500, color: T.label2,
            }}>Sign out</button>
          </div>
        </div>

        {assignError && (
          <div style={{ padding: "0 16px", marginBottom: 16 }}>
            <div style={{
              background: T.surface, borderRadius: 12, boxShadow: T.shadow,
              padding: "10px 14px", fontSize: 13, color: T.red,
            }}>
              {assignError}
            </div>
          </div>
        )}

        {classError && (
          <div style={{ padding: "0 16px", marginBottom: 16 }}>
            <div style={{
              background: T.surface, borderRadius: 12, boxShadow: T.shadow,
              padding: "10px 14px", fontSize: 13, color: T.red,
            }}>
              {classError}
            </div>
          </div>
        )}

        {view === "assignments" ? (
          <AssignmentsScreen T={T} assignments={enrichedAssignments} todayKey={todayKey} weekEndKey={weekEndKey}
            loaded={assignmentsLoaded} onAdd={openCreate} onEdit={openEdit}
            onConfirm={handleConfirm} onDone={handleDoneToggle} />
        ) : (
      <>
        {/* header */}
        <header className="flex items-start justify-between" style={{ padding: "0 16px", marginBottom: 16, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: T.label2, ...num }}>
              {beforeTerm ? "Term starts 20 Aug"
                : afterTerm ? "Term ended 9 Oct"
                : `${daysLeft} days left in term`}
            </div>
            <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", margin: "2px 0 0", lineHeight: 1.05 }}>
              {onToday ? "Today" : `${LONG[fd.getDay()]} ${fd.getDate()}`}
            </h1>
            <div style={{ fontSize: 15, color: T.label2, marginTop: 2 }}>
              {LONG[fd.getDay()]}, {fd.getDate()} {MONTHS[fd.getMonth()]} {fd.getFullYear()}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
            <Segmented<Group> T={T} value={group} onChange={setGroupOverride} label="Class group"
              options={[{ value: "A", label: "Group A" }, { value: "B", label: "Group B" }]} />
            {!onToday && (
              <button onClick={() => centerOn(anchorIdx, true)} style={{
                background: "none", border: "none", padding: "4px 2px", cursor: "pointer",
                fontFamily: FONT, fontSize: 15, fontWeight: 600, color: T.blue,
              }}>Today</button>
            )}
          </div>
        </header>

        {syncError && (
          <div style={{ padding: "0 16px", marginBottom: 16 }}>
            <div style={{
              background: T.surface, borderRadius: 12, boxShadow: T.shadow,
              padding: "10px 14px", fontSize: 13, color: T.red,
            }}>
              {syncError}
            </div>
          </div>
        )}

        {/* catch-up */}
        {unmarked.length > 0 && (
          <div style={{ padding: "0 16px", marginBottom: 16 }}>
            <button onClick={() => setSheetOpen(true)} className="flex items-center" style={{
              width: "100%", minHeight: 56, background: T.surface, borderRadius: 12, border: "none",
              boxShadow: T.shadow, padding: "10px 14px", cursor: "pointer", textAlign: "left", gap: 12,
            }}>
              <span style={{
                width: 30, height: 30, borderRadius: 15, background: T.orange, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 17, fontWeight: 700, flexShrink: 0,
              }}>!</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: T.label }}>
                  {unmarked.length} {unmarked.length === 1 ? "class needs" : "classes need"} marking
                </span>
                <span style={{ display: "block", fontSize: 13, color: T.label2, marginTop: 1 }}>
                  They don't count until you do
                </span>
              </span>
              <span style={{ fontSize: 20, color: T.label3, flexShrink: 0 }}>›</span>
            </button>
          </div>
        )}

        {/* day rail */}
        <div ref={railRef} className="rail" onScroll={onScroll} onKeyDown={onKeyDown} tabIndex={0}
          role="region" aria-label="Daily schedule"
          style={{
            display: "flex", overflowX: "auto", scrollSnapType: "x mandatory",
            gap: 16, padding: "0 16px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
          }}>
          {dates.map((dk) => (
            // The ref must sit on this element: it generates a layout box.
            // See the note in useDayRail.js before changing this.
            <div key={dk} ref={(el) => { panelRefs.current[dk] = el; }}
              style={{ flex: "0 0 min(86%, 366px)", scrollSnapAlign: "center" }}>
              <DayPanel T={T} date={dk} list={byDate[dk] || []} statOf={statOf} records={records}
                todayKey={todayKey} nowMin={nowMin} onMark={mark} dueSubjects={dueSubjects}
                isAdmin={profile.is_admin} onDeleteClass={handleDeleteClass} />
            </div>
          ))}
        </div>

        <DueStrip T={T} items={dueThisWeek} onOpen={() => setView("assignments")} />

        {/* attendance */}
        <section style={{ padding: "30px 16px 0" }}>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 10, paddingLeft: 2 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Attendance</h2>
            <span style={{ fontSize: 13, color: risky > 0 ? T.red : T.label2 }}>
              {risky > 0 ? `${risky} with no room left` : `${Math.round(TARGET * 100)}% target`}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
            {stats.map((s) => {
              const accent = T.subject[s.colorIdx % T.subject.length];
              return (
                <Card key={s.code} T={T} style={{ padding: "14px 15px" }}>
                  <div className="flex items-start justify-between" style={{ gap: 10, marginBottom: 12 }}>
                    <div className="flex items-start" style={{ gap: 9, minWidth: 0 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 5, background: accent, flexShrink: 0, marginTop: 5 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.25 }}>{s.name}</div>
                        <div style={{ fontSize: 13, color: T.label2, marginTop: 2, ...num }}>
                          Needs {s.required} of {s.effTotal}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", flexShrink: 0, ...num,
                      color: s.pct === null ? T.label3 : s.pct >= TARGET ? T.label : T.red,
                    }}>
                      {s.pct === null ? "—" : `${Math.round(s.pct * 100)}%`}
                    </div>
                  </div>

                  <Register T={T} sessions={s.sessions} records={records} todayKey={todayKey} nowMin={nowMin} />

                  <div style={{ fontSize: 15, marginTop: 12 }}>
                    {s.unreachable ? (
                      <span style={{ color: T.red, fontWeight: 600 }}>80% is no longer reachable</span>
                    ) : (
                      <span style={{ fontWeight: 600, color: s.canSkip === 0 ? T.red : T.label }}>
                        {s.canSkip === 0
                          ? "Attend every remaining class"
                          : `${s.canSkip} more ${s.canSkip === 1 ? "absence" : "absences"} allowed`}
                      </span>
                    )}
                    <span style={{ display: "block", fontSize: 13, color: T.label2, marginTop: 3, ...num }}>
                      {s.attended} attended · {s.remaining} still to come
                      {s.unmarked > 0 && ` · ${s.unmarked} unmarked`}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </>
        )}
      </div>

      {sheetOpen && (
        <CatchUpSheet T={T} sessions={unmarked} onMark={mark} onClose={() => setSheetOpen(false)} />
      )}

      {formOpen && (
        <AssignmentForm T={T} subjects={SUBS} initial={editingAssignment}
          onSubmit={handleCreateOrUpdate} onRetract={handleRetract} onClose={closeForm} />
      )}

      {classFormOpen && (
        <AddClassForm T={T} subjects={SUBS} defaultGroup={group}
          onSubmit={handleAddClass} onClose={() => setClassFormOpen(false)} />
      )}
    </div>
  );
}
