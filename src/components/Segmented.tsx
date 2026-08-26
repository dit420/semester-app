import { FONT } from "../theme.js";
import type { Theme } from "../theme.js";

export default function Segmented<V extends string>({ T, value, options, onChange, label }: {
  T: Theme;
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  label: string;
}) {
  return (
    <div className="flex" role="tablist" aria-label={label}
      style={{ background: T.fill, borderRadius: 9, padding: 2, gap: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} role="tab" aria-selected={on} onClick={() => onChange(o.value)}
            style={{
              minHeight: 30, padding: "0 14px", borderRadius: 7, border: "none", cursor: "pointer",
              fontFamily: FONT, fontSize: 13, fontWeight: on ? 600 : 500,
              background: on ? T.surfaceAlt : "transparent", color: T.label,
              boxShadow: on ? T.pillShadow : "none", transition: "background 160ms",
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
