/**
 * Data layer. Every Supabase call lives here — components never import the
 * client directly, so the wire format stays swappable and testable.
 *
 * Shape convention: each function returns plain data or throws. No Supabase
 * response envelopes leak past this file.
 *
 * Typing note: `createClient` below isn't given a `Database` generic — that
 * needs `supabase gen types typescript`, which shells out to Docker, and
 * Docker isn't available in this environment. Without it, every `.from(...)`
 * call's raw response is untyped by the library itself. `unwrap<T>` is the
 * one seam that deals with that: it receives the response as `unknown` and
 * asserts the type each function documents, rather than trusting an implicit
 * `any` from the client. That assertion is the one boundary in this codebase
 * the compiler doesn't verify structurally — every function signature below,
 * and everything that imports from this file, is fully typed from there out.
 */
import { createClient, type Session as AuthSession, type Subscription, type RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type {
  Group, Profile, Assignment, AssignmentAuthor, AttendanceRecords, ExtraSession,
  Classmate, ChatMessage, ThemePreference,
} from "../types.js";
import type { AttendanceStatus } from "./attendance.js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface ErrorLike {
  message: string;
}

function unwrap<T>(res: { data: unknown; error: ErrorLike | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/* ----------------------------------------------------------------- session */

export const getSession = async (): Promise<AuthSession | null> =>
  (await supabase.auth.getSession()).data.session;

export const onAuthChange = (fn: (session: AuthSession | null) => void): Subscription =>
  supabase.auth.onAuthStateChange((_e, session) => fn(session)).data.subscription;

export const signOut = () => supabase.auth.signOut();

// signInWithOtp's resolved shape is a non-trivial union (immediate session
// vs. pending-confirmation vs. message-only) and nothing downstream reads
// the value — SignIn.tsx only awaits or catches. Rather than model that
// union just to discard it, this is deliberately `unknown`.
export async function signInWithMagicLink(email: string, inviteCode: string): Promise<unknown> {
  return unwrap<unknown>(
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, data: { invite_code: inviteCode } },
    })
  );
}

export async function getProfile(): Promise<Profile | null> {
  const session = await getSession();
  if (!session) return null;
  return unwrap<Profile | null>(
    await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle()
  );
}

/** Called once after first sign-in, when the user picks their group. */
export async function createProfile({ name, groupCode }: { name: string; groupCode: Group }): Promise<Profile> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in");
  return unwrap<Profile>(
    await supabase
      .from("profiles")
      .insert({ id: session.user.id, name, group_code: groupCode })
      .select()
      .single()
  );
}

export interface ProfileUpdate {
  name?: string;
  avatar_path?: string | null;
  theme_preference?: ThemePreference;
}

/** group_code and is_admin deliberately aren't accepted here — 0002/0004's
    trigger would reject a client attempt at either anyway, so ProfileUpdate
    doesn't even offer the option. */
export async function updateProfile(patch: ProfileUpdate): Promise<Profile> {
  const session = await getSession();
  return unwrap<Profile>(
    await supabase.from("profiles").update(patch).eq("id", session!.user.id).select().single()
  );
}

/** Uploads to the caller's own folder (enforced by the avatars bucket's own
    RLS, not just this path convention) and points the profile at it. */
export async function uploadAvatar(file: File): Promise<string> {
  const session = await getSession();
  const userId = session!.user.id;
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  await updateProfile({ avatar_path: path });
  return path;
}

/** avatars is a public bucket (see 0006) — this is just URL construction,
    no network round trip, safe to call per-render. */
export function avatarUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

export async function listClassmates(): Promise<Classmate[]> {
  const rows = unwrap<{ id: string; name: string; avatar_path: string | null; is_admin: boolean }[]>(
    await supabase.from("profiles").select("id, name, avatar_path, is_admin").order("name")
  );
  return rows.map((r) => ({ id: r.id, name: r.name, avatarPath: r.avatar_path, isAdmin: r.is_admin }));
}

/* ------------------------------------------------------------- attendance  */

interface AttendanceRow {
  session_id: string;
  status: AttendanceStatus;
}

export async function loadAttendance(): Promise<AttendanceRecords> {
  const rows = unwrap<AttendanceRow[]>(
    await supabase.from("attendance_records").select("session_id, status")
  );
  // Collapse to the { [sessionId]: status } shape the UI already uses, so
  // nothing downstream of statsFor() has to change.
  return Object.fromEntries(rows.map((r) => [r.session_id, r.status]));
}

export async function setAttendance(sessionId: string, status: AttendanceStatus | null): Promise<null> {
  const session = await getSession();
  if (status === null) {
    return unwrap<null>(
      await supabase.from("attendance_records").delete()
        .eq("session_id", sessionId).eq("user_id", session!.user.id)
    );
  }
  return unwrap<null>(
    await supabase.from("attendance_records").upsert(
      { user_id: session!.user.id, session_id: sessionId, status, marked_at: new Date().toISOString() },
      { onConflict: "user_id,session_id" }
    )
  );
}

/* ------------------------------------------------------------ assignments  */

/** The raw persisted row — snake_case, pre-mapping. Distinct from the
    `Assignment` domain type, which is the enriched shape listAssignments()
    hands back to the UI (author joined in, confirmations counted, etc). */
interface AssignmentRow {
  id: string;
  group_code: string;
  subject_code: string;
  title: string;
  details: string | null;
  due_date: string;
  due_time: string | null;
  attachment: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

interface AssignmentListRow {
  id: string;
  subject_code: string;
  title: string;
  details: string | null;
  due_date: string;
  due_time: string | null;
  attachment: string | null;
  created_by: string;
  created_at: string;
  author: AssignmentAuthor | null;
  assignment_confirmations: { user_id: string }[];
  assignment_completions: { user_id: string }[];
}

/**
 * The shared list for a group, with each entry carrying its social signals
 * (who posted, how many confirmed) and the caller's own private done-state.
 */
export async function listAssignments(): Promise<Assignment[]> {
  const session = await getSession();
  const rows = unwrap<AssignmentListRow[]>(
    await supabase
      .from("assignments")
      .select(`
        id, subject_code, title, details, due_date, due_time, attachment,
        created_by, created_at,
        author:profiles!assignments_created_by_fkey ( id, name ),
        assignment_confirmations ( user_id ),
        assignment_completions ( user_id )
      `)
      .is("deleted_at", null)
      .order("due_date", { ascending: true })
  );

  const me = session?.user?.id;
  return rows.map((r) => ({
    id: r.id,
    subjectCode: r.subject_code,
    title: r.title,
    details: r.details,
    dueDate: r.due_date,
    dueTime: r.due_time,
    attachment: r.attachment,
    author: r.author,
    isMine: r.created_by === me,
    createdAt: r.created_at,
    confirmations: r.assignment_confirmations.length,
    iConfirmed: r.assignment_confirmations.some((c) => c.user_id === me),
    // RLS means completions only ever returns the caller's own rows, so a
    // non-empty array here is by definition "I have done this".
    done: r.assignment_completions.length > 0,
  }));
}

export interface NewAssignment {
  subjectCode: string;
  title: string;
  details: string | null;
  dueDate: string;
  dueTime: string | null;
  groupCode: Group | "BOTH";
  attachment?: string | null;
}

export async function createAssignment({ subjectCode, title, details, dueDate, dueTime, groupCode, attachment }: NewAssignment): Promise<AssignmentRow> {
  const session = await getSession();
  return unwrap<AssignmentRow>(
    await supabase.from("assignments").insert({
      created_by: session!.user.id,
      group_code: groupCode,
      subject_code: subjectCode,
      title: title.trim(),
      details: details?.trim() || null,
      due_date: dueDate,
      due_time: dueTime || null,
      attachment: attachment || null,
    }).select().single()
  );
}

export async function updateAssignment(id: string, patch: Partial<AssignmentRow>): Promise<AssignmentRow> {
  return unwrap<AssignmentRow>(await supabase.from("assignments").update(patch).eq("id", id).select().single());
}

/** Retract, don't destroy. RLS allows this only for the author. */
export async function retractAssignment(id: string): Promise<null> {
  const session = await getSession();
  return unwrap<null>(
    await supabase.from("assignments")
      .update({ deleted_at: new Date().toISOString(), deleted_by: session!.user.id })
      .eq("id", id)
  );
}

export async function setConfirmed(assignmentId: string, confirmed: boolean): Promise<null> {
  const session = await getSession();
  if (!confirmed) {
    return unwrap<null>(
      await supabase.from("assignment_confirmations").delete()
        .eq("assignment_id", assignmentId).eq("user_id", session!.user.id)
    );
  }
  return unwrap<null>(
    await supabase.from("assignment_confirmations")
      .upsert({ assignment_id: assignmentId, user_id: session!.user.id })
  );
}

export async function setDone(assignmentId: string, done: boolean): Promise<null> {
  const session = await getSession();
  if (!done) {
    return unwrap<null>(
      await supabase.from("assignment_completions").delete()
        .eq("assignment_id", assignmentId).eq("user_id", session!.user.id)
    );
  }
  return unwrap<null>(
    await supabase.from("assignment_completions")
      .upsert({ assignment_id: assignmentId, user_id: session!.user.id })
  );
}

/** Live updates, so a deadline posted in class appears without a refresh. */
export function subscribeAssignments(onChange: (payload: RealtimePostgresChangesPayload<AssignmentRow>) => void): () => void {
  const ch = supabase
    .channel("assignments")
    .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/* --------------------------------------------------------- extra sessions  */

/** Raw persisted row — snake_case, pre-mapping. See supabase/migrations/0003:
    admin-gated at the database, so this insert fails for anyone whose
    profile isn't is_admin regardless of what the client sends. */
interface ExtraSessionRow {
  id: string;
  group_code: string;
  subject_code: string;
  date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  faculty: string | null;
  created_by: string;
  created_at: string;
}

export async function listExtraSessions(): Promise<ExtraSession[]> {
  const rows = unwrap<ExtraSessionRow[]>(
    await supabase.from("extra_sessions").select("*").is("deleted_at", null)
  );
  return rows.map((r) => ({
    id: r.id,
    subjectCode: r.subject_code,
    group: r.group_code as Group,
    date: r.date,
    start: r.start_time,
    end: r.end_time,
    room: r.room,
    faculty: r.faculty,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }));
}

export interface NewExtraSession {
  subjectCode: string;
  group: Group;
  date: string;
  start: string;
  end: string;
  room: string | null;
  faculty: string | null;
}

export async function createExtraSession({ subjectCode, group, date, start, end, room, faculty }: NewExtraSession): Promise<ExtraSessionRow> {
  const session = await getSession();
  return unwrap<ExtraSessionRow>(
    await supabase.from("extra_sessions").insert({
      created_by: session!.user.id,
      group_code: group,
      subject_code: subjectCode,
      date,
      start_time: start,
      end_time: end,
      room: room || null,
      faculty: faculty || null,
    }).select().single()
  );
}

/** Retract, don't destroy — same soft-delete pattern as assignments. */
export async function retractExtraSession(id: string): Promise<null> {
  const session = await getSession();
  return unwrap<null>(
    await supabase.from("extra_sessions")
      .update({ deleted_at: new Date().toISOString(), deleted_by: session!.user.id })
      .eq("id", id)
  );
}

/* -------------------------------------------------------------------- chat */

interface ChatMessageRow {
  id: string;
  user_id: string;
  body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  created_at: string;
  author: { id: string; name: string; avatar_path: string | null } | null;
}

/** Most recent `limit` messages, oldest first (ready to render top-to-bottom
    with the composer pinned below). */
export async function listChatMessages(limit = 100): Promise<ChatMessage[]> {
  const session = await getSession();
  const rows = unwrap<ChatMessageRow[]>(
    await supabase
      .from("chat_messages")
      .select(`
        id, user_id, body, attachment_path, attachment_name, attachment_size, created_at,
        author:profiles!chat_messages_user_id_fkey ( id, name, avatar_path )
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit)
  );

  const me = session?.user?.id;
  return rows.reverse().map((r) => ({
    id: r.id,
    userId: r.user_id,
    authorName: r.author?.name ?? "Someone",
    authorAvatarPath: r.author?.avatar_path ?? null,
    body: r.body,
    attachmentPath: r.attachment_path,
    attachmentName: r.attachment_name,
    attachmentSize: r.attachment_size,
    createdAt: r.created_at,
    isMine: r.user_id === me,
  }));
}

export interface NewChatMessage {
  groupCode: Group;
  body: string | null;
  file?: File | null;
}

/** groupCode comes from the caller (App.tsx already holds the signed-in
    profile) rather than being refetched here — RLS still independently
    checks group_code = my_group() regardless of what's sent. */
export async function sendChatMessage({ groupCode, body, file }: NewChatMessage): Promise<null> {
  const session = await getSession();
  const userId = session!.user.id;

  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;
  let attachmentSize: number | null = null;

  if (file) {
    const path = `${userId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("chat-files").upload(path, file);
    if (error) throw new Error(error.message);
    attachmentPath = path;
    attachmentName = file.name;
    attachmentSize = file.size;
  }

  return unwrap<null>(
    await supabase.from("chat_messages").insert({
      user_id: userId,
      group_code: groupCode,
      body: body?.trim() || null,
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
      attachment_size: attachmentSize,
    })
  );
}

/** Retract, don't destroy. RLS allows this for the author or any admin —
    see 0006 for why chat differs from assignments' author-only rule. */
export async function retractChatMessage(id: string): Promise<null> {
  const session = await getSession();
  return unwrap<null>(
    await supabase.from("chat_messages")
      .update({ deleted_at: new Date().toISOString(), deleted_by: session!.user.id })
      .eq("id", id)
  );
}

/** chat-files is a private bucket (0006): read access is tied to being in
    the same group as the message the file is attached to, so this has to
    be a signed, time-limited URL rather than a public one. Call on demand
    (e.g. when a download link is clicked), not eagerly per message. */
export async function chatFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("chat-files").createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Live updates. The realtime payload is the raw row only (no author join),
    so callers refetch the list on any change rather than trying to merge a
    partial payload — simple, and chat volume here is low enough that
    refetching is cheap. */
export function subscribeChatMessages(onChange: (payload: RealtimePostgresChangesPayload<ChatMessageRow>) => void): () => void {
  const ch = supabase
    .channel("chat_messages")
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
