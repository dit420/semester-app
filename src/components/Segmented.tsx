import type { Theme } from "../theme.js";

export default function Segmented<V extends string>({ T, value, options, onChange, label }: {
  T: Theme;
  value: V;
  options: { value: V; label: string; badge?: number }[];
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
              position: "relative", minHeight: 30, padding: "0 14px", borderRadius: 7, border: "none", cursor: "pointer",
              fontFamily: T.font, fontSize: 13, fontWeight: on ? 600 : 500,
              background: on ? T.surfaceAlt : "transparent", color: T.label,
              boxShadow: on ? T.pillShadow : "none", transition: "background 160ms",
            }}>
            {o.label}
            {!!o.badge && (
              <span aria-label={`${o.badge} new`} style={{
                position: "absolute", top: -5, right: -3, minWidth: 16, height: 16, borderRadius: 8,
                background: T.red, color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
              }}>
                {o.badge > 9 ? "9+" : o.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
