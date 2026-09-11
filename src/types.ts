/* Domain types, shared across data, store, and components. String literal
   unions rather than `string` throughout — a typo in a status or group code
   is meant to be a compile error, not a runtime surprise. */

export type Group = "A" | "B";

import type { AttendanceStatus, AttendanceRecords, SubjectStats } from "./lib/attendance.js";
export type { AttendanceStatus, AttendanceRecords, SubjectStats };

import type { ThemePreference } from "./theme.js";
export type { ThemePreference };

export interface Session {
  id: string;
  date: string;
  start: string;
  end: string;
  code: string;
  name: string;
  faculty: string;
  total: number;
  colorIdx: number;
  n: number;
  group: Group;
  room: string;
  /** True only for a session App.tsx merged in from ExtraSession — never
      set on one generated from the static timetable. Distinguishes a
      deletable admin-added class from the college's own fixed schedule. */
  isExtra?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  group_code: Group;
  is_admin: boolean;
  theme_preference: ThemePreference;
  avatar_path: string | null;
  created_at: string;
}

/** A group member as shown on the Classmates tab. Same profiles rows
    listAssignments()'s author join already reads — RLS already scopes this
    to "my own group or myself", so no new data exposure, just a screen. */
export interface Classmate {
  id: string;
  name: string;
  avatarPath: string | null;
  isAdmin: boolean;
}

/** The shape src/lib/store.ts's listChatMessages() maps every row into. */
export interface ChatMessage {
  id: string;
  userId: string;
  authorName: string;
  authorAvatarPath: string | null;
  body: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  createdAt: string;
  isMine: boolean;
}

/** An admin-added class outside the original timetable — a makeup or a
    genuinely surprise session. Counts toward the real 80% requirement, so
    App.tsx merges these into the same Session pool statsFor() reads, rather
    than tracking them separately. See supabase/migrations/0003. */
export interface ExtraSession {
  id: string;
  subjectCode: string;
  group: Group;
  date: string;
  start: string;
  end: string;
  room: string | null;
  faculty: string | null;
  createdBy: string;
  createdAt: string;
}

export interface AssignmentAuthor {
  id: string;
  name: string;
}

/** The shape src/lib/store.ts's listAssignments() maps every row into. */
export interface Assignment {
  id: string;
  subjectCode: string;
  title: string;
  details: string | null;
  dueDate: string;
  dueTime: string | null;
  attachment: string | null;
  author: AssignmentAuthor | null;
  isMine: boolean;
  createdAt: string;
  confirmations: number;
  iConfirmed: boolean;
  done: boolean;
}

/** Assignment plus the subject metadata (display name, colour) App.tsx
    attaches once, so AssignmentCard/DueStrip/AssignmentsScreen stay
    presentational the same way ClassCard receives a fully-prepared Session. */
export interface EnrichedAssignment extends Assignment {
  subjectName: string;
  colorIdx: number;
}

/** statsFor()'s result plus the display metadata App.tsx merges in for the
    Attendance section and class cards — used across App.tsx, DayPanel, and
    ClassCard, so it lives here rather than being redefined per file. */
export interface SubjectCard extends SubjectStats {
  code: string;
  colorIdx: number;
  name: string;
  sessions: Session[];
}
