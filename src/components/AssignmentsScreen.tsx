import { useMemo } from "react";
import Card from "./Card.js";
import AssignmentCard from "./AssignmentCard.js";
import type { Theme } from "../theme.js";
import type { EnrichedAssignment } from "../types.js";

type Bucket = "overdue" | "thisWeek" | "later" | "done";

function bucketOf(a: EnrichedAssignment, todayKey: string, weekEndKey: string): Bucket {
  if (a.done) return "done";
  if (a.dueDate < todayKey) return "overdue";
  if (a.dueDate <= weekEndKey) return "thisWeek";
  return "later";
}

const SECTIONS: [Bucket, string][] = [
  ["overdue", "Overdue"],
  ["thisWeek", "This week"],
  ["later", "Later"],
  ["done", "Done"],
];

export default function AssignmentsScreen({ T, assignments, todayKey, weekEndKey, loaded, onAdd, onEdit, onConfirm, onDone }: {
  T: Theme;
  assignments: EnrichedAssignment[];
  todayKey: string;
  weekEndKey: string;
  loaded: boolean;
  onAdd: () => void;
  onEdit: (a: EnrichedAssignment) => void;
  onConfirm: (id: string, next: boolean) => void;
  onDone: (id: string, next: boolean) => void;
}) {
  const groups = useMemo(() => {
    const g: Record<Bucket, EnrichedAssignment[]> = { overdue: [], thisWeek: [], later: [], done: [] };
    for (const a of assignments) g[bucketOf(a, todayKey, weekEndKey)].push(a);
    for (const k of Object.keys(g) as Bucket[]) g[k].sort((x, y) => (x.dueDate < y.dueDate ? -1 : x.dueDate > y.dueDate ? 1 : 0));
    return g;
  }, [assignments, todayKey, weekEndKey]);

  return (
    <section style={{ padding: "0 16px 40px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Assignments</h1>
        <button onClick={onAdd} style={{
          minHeight: 40, borderRadius: 20, border: "none", cursor: "pointer",
          background: T.blue, color: "#fff", fontFamily: T.font, fontSize: 15, fontWeight: 600,
          padding: "0 16px",
        }}>+ Add</button>
      </div>

      {!loaded ? (
        <div style={{ fontSize: 15, color: T.label2, padding: "20px 2px" }}>Loading…</div>
      ) : assignments.length === 0 ? (
        <Card T={T} style={{ padding: 26, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Nothing posted yet</div>
          <div style={{ fontSize: 13, color: T.label2, marginTop: 4 }}>Be the first to add what's due.</div>
        </Card>
      ) : (
        SECTIONS.map(([k, label]) => groups[k].length > 0 && (
          <div key={k} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.label2, margin: "0 0 8px 2px" }}>
              {label} · {groups[k].length}
            </div>
            {groups[k].map((a) => (
              <AssignmentCard key={a.id} T={T} a={a} todayKey={todayKey}
                onEdit={() => onEdit(a)} onConfirm={onConfirm} onDone={onDone} />
            ))}
          </div>
        ))
      )}
    </section>
  );
}
