/* Semantic design tokens, light and dark.
   Values follow the platform system palette rather than custom hex, so both
   appearances stay legible. Never hardcode a colour in a component — add a
   token here instead, or dark mode silently breaks. */
import { useEffect, useState, type CSSProperties } from "react";

export const LIGHT = {
  bg: "#F2F2F7", surface: "#FFFFFF", surfaceAlt: "#FFFFFF",
  label: "#000000", label2: "rgba(60,60,67,0.60)", label3: "rgba(60,60,67,0.30)",
  separator: "rgba(60,60,67,0.29)", fill: "rgba(120,120,128,0.12)",
  blue: "#007AFF", green: "#34C759", red: "#FF3B30", orange: "#FF9500", gray: "#8E8E93",
  shadow: "0 1px 3px rgba(0,0,0,0.06)", pillShadow: "0 3px 8px rgba(0,0,0,0.12)",
  subject: ["#007AFF", "#34C759", "#5856D6", "#FF9500", "#FF2D55", "#AF52DE", "#FF3B30", "#30B0C7", "#A2845E"],
};

export type Theme = typeof LIGHT;

export const DARK: Theme = {
  bg: "#000000", surface: "#1C1C1E", surfaceAlt: "#2C2C2E",
  label: "#FFFFFF", label2: "rgba(235,235,245,0.60)", label3: "rgba(235,235,245,0.30)",
  separator: "rgba(84,84,88,0.65)", fill: "rgba(120,120,128,0.24)",
  blue: "#0A84FF", green: "#30D158", red: "#FF453A", orange: "#FF9F0A", gray: "#8E8E93",
  shadow: "none", pillShadow: "0 3px 8px rgba(0,0,0,0.4)",
  subject: ["#0A84FF", "#30D158", "#5E5CE6", "#FF9F0A", "#FF375F", "#BF5AF2", "#FF453A", "#40C8E0", "#AC8E68"],
};

export const FONT =
  `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

/* Type scale: 34 large title · 22 title · 17 headline/body · 15 subhead · 13 footnote · 12 caption */
export const num: CSSProperties = { fontVariantNumeric: "tabular-nums" };

export function useTheme(): Theme {
  const [dark, setDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  return dark ? DARK : LIGHT;
}
