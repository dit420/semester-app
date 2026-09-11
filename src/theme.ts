/* Semantic design tokens, one palette per theme. Values follow a platform
   system palette rather than one-off hex per component — never hardcode a
   colour in a component, add a token here instead, or switching themes
   silently breaks one screen. */
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

/* Deep blue-black rather than DARK's neutral near-black — a distinct dark
   option, not a re-skin. */
export const MIDNIGHT: Theme = {
  bg: "#05070F", surface: "#101322", surfaceAlt: "#181C30",
  label: "#EAEBFF", label2: "rgba(224,226,255,0.62)", label3: "rgba(224,226,255,0.32)",
  separator: "rgba(140,150,200,0.25)", fill: "rgba(140,150,220,0.16)",
  blue: "#5B9CFF", green: "#3FD68C", red: "#FF6B6B", orange: "#FFB454", gray: "#8E93B0",
  shadow: "none", pillShadow: "0 3px 10px rgba(0,0,10,0.6)",
  subject: ["#5B9CFF", "#3FD68C", "#8C8CFF", "#FFB454", "#FF7096", "#C48CFF", "#FF6B6B", "#4AD0E0", "#C0946B"],
};

/* Warm, paper-toned light option. */
export const SEPIA: Theme = {
  bg: "#F5EDE0", surface: "#FFFBF3", surfaceAlt: "#FFFBF3",
  label: "#3A2E22", label2: "rgba(58,46,34,0.62)", label3: "rgba(58,46,34,0.32)",
  separator: "rgba(58,46,34,0.25)", fill: "rgba(154,120,80,0.14)",
  blue: "#0A6E8C", green: "#4C7A3B", red: "#B84B3E", orange: "#C4791F", gray: "#8A7A63",
  shadow: "0 1px 3px rgba(58,46,34,0.10)", pillShadow: "0 3px 8px rgba(58,46,34,0.16)",
  subject: ["#0A6E8C", "#4C7A3B", "#6A5A9A", "#C4791F", "#B0466B", "#8A5AA8", "#B84B3E", "#2E8F94", "#8A5A3A"],
};

/** Matches profiles.theme_preference's check constraint exactly. */
export type ThemePreference = "system" | "light" | "dark" | "midnight" | "sepia";

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Match device" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "midnight", label: "Midnight" },
  { value: "sepia", label: "Sepia" },
];

const NAMED_THEMES: Record<Exclude<ThemePreference, "system">, Theme> = {
  light: LIGHT, dark: DARK, midnight: MIDNIGHT, sepia: SEPIA,
};

export const FONT =
  `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

/* Type scale: 34 large title · 22 title · 17 headline/body · 15 subhead · 13 footnote · 12 caption */
export const num: CSSProperties = { fontVariantNumeric: "tabular-nums" };

/**
 * `preference` is the signed-in profile's stored choice (or "system" before
 * a profile has loaded). "system" is the only case that still needs to
 * watch prefers-color-scheme; every named theme is a fixed lookup.
 */
export function useTheme(preference: ThemePreference = "system"): Theme {
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  if (preference === "system") return systemDark ? DARK : LIGHT;
  return NAMED_THEMES[preference];
}
