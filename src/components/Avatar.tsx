import { avatarUrl } from "../lib/store.js";
import type { Theme } from "../theme.js";

/** avatarUrl() is pure string templating (no network call) even though it
    lives in store.js — the one exception to "components never import the
    client" worth making, rather than threading a precomputed URL through
    every list item everywhere an avatar shows up. */
export default function Avatar({ T, path, name, size = 32 }: { T: Theme; path: string | null; name: string; size?: number }) {
  const url = avatarUrl(path);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return url ? (
    <img src={url} alt={name} width={size} height={size}
      style={{ width: size, height: size, borderRadius: size / 2, objectFit: "cover", flexShrink: 0, background: T.fill }} />
  ) : (
    <div aria-label={name} style={{
      width: size, height: size, borderRadius: size / 2, background: T.fill, color: T.label2,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: 700, flexShrink: 0,
    }}>
      {initial}
    </div>
  );
}
