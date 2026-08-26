import type { CSSProperties, ReactNode } from "react";
import type { Theme } from "../theme.js";

export default function Card({ T, children, style }: { T: Theme; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: T.surface, borderRadius: 12, boxShadow: T.shadow, ...style }}>
      {children}
    </div>
  );
}
