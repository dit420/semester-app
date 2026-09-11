import { useRef, useState, type ChangeEvent } from "react";
import type { Theme, ThemePreference } from "../theme.js";
import { THEME_OPTIONS } from "../theme.js";
import type { Profile } from "../types.js";
import Avatar from "./Avatar.js";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // matches the avatars bucket's own limit (0006)

export default function ProfileScreen({ T, profile, onSaveName, onSaveTheme, onUploadAvatar, onClose }: {
  T: Theme;
  profile: Profile;
  onSaveName: (name: string) => Promise<void>;
  onSaveTheme: (theme: ThemePreference) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [nameBusy, setNameBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveName = async () => {
    if (!name.trim() || name.trim() === profile.name || nameBusy) return;
    setNameBusy(true);
    setError(null);
    try {
      await onSaveName(name.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setNameBusy(false);
    }
  };

  const pickFile = () => fileInputRef.current?.click();

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets picking the same file again re-fire onChange
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setError("That photo is over 2 MB — pick a smaller one.");
      return;
    }
    setAvatarBusy(true);
    setError(null);
    try {
      await onUploadAvatar(file);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAvatarBusy(false);
    }
  };

  const labelStyle = { display: "block", fontSize: 13, color: T.label2, marginBottom: 6 };
  const inputStyle = {
    width: "100%", minHeight: 44, borderRadius: 10, border: `1px solid ${T.separator}`,
    background: T.bg, color: T.label, fontFamily: T.font, fontSize: 16,
    padding: "0 12px", boxSizing: "border-box" as const,
  };

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Your profile"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50,
      }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.bg, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto",
        borderRadius: "14px 14px 0 0", padding: "10px 16px 24px",
      }}>
        <div style={{ width: 36, height: 5, borderRadius: 3, background: T.label3, margin: "0 auto 14px" }} />

        <div className="flex items-start justify-between" style={{ marginBottom: 18, gap: 10 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Your profile</h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", padding: "4px 2px", cursor: "pointer",
            fontFamily: T.font, fontSize: 17, fontWeight: 600, color: T.blue, flexShrink: 0,
          }}>Done</button>
        </div>

        <div className="flex items-center" style={{ gap: 14, marginBottom: 22 }}>
          <Avatar T={T} path={profile.avatar_path} name={profile.name} size={64} />
          <div>
            <button onClick={pickFile} disabled={avatarBusy} style={{
              minHeight: 40, borderRadius: 9, border: "none", cursor: avatarBusy ? "default" : "pointer",
              background: T.fill, color: T.label, fontFamily: T.font, fontSize: 14, fontWeight: 600,
              padding: "0 14px", opacity: avatarBusy ? 0.6 : 1,
            }}>{avatarBusy ? "Uploading…" : "Change photo"}</button>
            <div style={{ fontSize: 12, color: T.label3, marginTop: 6 }}>JPEG, PNG or WebP, up to 2 MB</div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFile} />
          </div>
        </div>

        <label style={labelStyle}>Name</label>
        <div className="flex items-center" style={{ gap: 8, marginBottom: 22 }}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
            style={{ ...inputStyle, flex: 1 }} />
          <button onClick={saveName} disabled={nameBusy || !name.trim() || name.trim() === profile.name} style={{
            minHeight: 44, borderRadius: 10, border: "none",
            cursor: nameBusy ? "default" : "pointer", background: T.blue, color: "#fff",
            fontFamily: T.font, fontSize: 15, fontWeight: 600, padding: "0 16px",
            opacity: (nameBusy || !name.trim() || name.trim() === profile.name) ? 0.5 : 1,
          }}>{nameBusy ? "Saving…" : "Save"}</button>
        </div>

        <label style={labelStyle}>Theme</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {THEME_OPTIONS.map((opt) => {
            const on = profile.theme_preference === opt.value;
            return (
              <button key={opt.value}
                onClick={() => onSaveTheme(opt.value).catch((err: unknown) => setError((err as Error).message))}
                style={{
                minHeight: 44, borderRadius: 10, border: `1px solid ${on ? T.blue : T.separator}`,
                background: on ? T.fill : "transparent", color: T.label,
                fontFamily: T.font, fontSize: 15, fontWeight: on ? 600 : 500,
                textAlign: "left", padding: "0 14px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                {opt.label}
                {on && <span style={{ color: T.blue, fontWeight: 700 }}>✓</span>}
              </button>
            );
          })}
        </div>

        {error && <p style={{ color: T.red, fontSize: 13, margin: "14px 0 0" }}>{error}</p>}
      </div>
    </div>
  );
}
