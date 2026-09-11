import { useState } from "react";
import type { Theme } from "../theme.js";

/* Minimum height 40 plus surrounding padding keeps the tap target at ~44,
   which is the floor for a control used one-handed in a corridor. */
export default function Action({ T, label, tone, onClick }: { T: Theme; label: string; tone: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, minHeight: 40, borderRadius: 9, border: "none", cursor: "pointer",
        fontFamily: T.font, fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
        background: hover ? tone : T.fill, color: hover ? "#fff" : tone,
        transition: "background 140ms, color 140ms",
      }}
    >
      {label}
    </button>
  );
}
