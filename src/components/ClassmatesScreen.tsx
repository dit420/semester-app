import Card from "./Card.js";
import Avatar from "./Avatar.js";
import type { Theme } from "../theme.js";
import type { Classmate } from "../types.js";

export default function ClassmatesScreen({ T, classmates, myId, loaded }: {
  T: Theme;
  classmates: Classmate[];
  myId: string;
  loaded: boolean;
}) {
  return (
    <section style={{ padding: "0 16px 40px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 16px" }}>Classmates</h1>

      {!loaded ? (
        <div style={{ fontSize: 15, color: T.label2, padding: "20px 2px" }}>Loading…</div>
      ) : classmates.length === 0 ? (
        <Card T={T} style={{ padding: 26, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Nobody else has signed up yet</div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {classmates.map((c) => (
            <Card key={c.id} T={T} style={{ padding: "12px 14px" }}>
              <div className="flex items-center" style={{ gap: 12 }}>
                <Avatar T={T} path={c.avatarPath} name={c.name} size={44} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 600, color: T.label, letterSpacing: "-0.01em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {c.name}{c.id === myId && <span style={{ color: T.label3, fontWeight: 500 }}> (you)</span>}
                  </div>
                  {c.isAdmin && <div style={{ fontSize: 12, color: T.blue, fontWeight: 600, marginTop: 1 }}>Admin</div>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
