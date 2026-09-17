import { useState } from "react";
import { BookOpen } from "lucide-react";
import {
  ICON_PACK,
  skillIconUrl,
  parseSkillIcon,
  type SkillIcon,
} from "../skill-icons";
import { api } from "./api";
export function SkillIconView({ icon }: { icon?: SkillIcon | null }) {
  const url = skillIconUrl(icon);
  return (
    <span className="skill-icon">
      {url ? <img src={url} alt="" /> : <BookOpen size={22} />}
    </span>
  );
}
export function SkillIconEditor({
  id,
  revision,
  icon,
  disabled,
  onSaved,
}: {
  id: string;
  revision: string;
  icon?: SkillIcon | null;
  disabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<SkillIcon | null>(icon ?? null),
    [mode, setMode] = useState<"icon" | "emoji" | "image">(
      icon?.kind ?? "icon",
    );
  const [query, setQuery] = useState(""),
    [color, setColor] = useState(
      icon?.kind === "icon" ? icon.background : "#526b91",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8_000_000)
        throw new Error("Choose a PNG, JPEG or WebP under 8 MB");
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 96;
      const context = canvas.getContext("2d")!;
      const scale = Math.min(96 / bitmap.width, 96 / bitmap.height),
        w = bitmap.width * scale,
        h = bitmap.height * scale;
      context.drawImage(bitmap, (96 - w) / 2, (96 - h) / 2, w, h);
      bitmap.close();
      const value = parseSkillIcon({
        kind: "image",
        src: canvas.toDataURL("image/webp", 0.85),
      });
      setDraft(value);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="skill-icon-editor">
      <button
        type="button"
        className="skill-icon-trigger"
        aria-label="Edit skill icon"
        aria-expanded={open}
        disabled={disabled || busy}
        onClick={() => {
          setOpen(!open);
          setDraft(icon ?? null);
          setError("");
        }}
      >
        <SkillIconView icon={icon} />
      </button>
      {open && (
        <div
          className="skill-icon-picker"
          role="dialog"
          aria-label="Skill icon"
        >
          <div className="icon-tabs">
            {(["icon", "emoji", "image"] as const).map((kind) => (
              <button
                type="button"
                key={kind}
                aria-pressed={mode === kind}
                onClick={() => setMode(kind)}
              >
                {kind === "icon"
                  ? "Icons"
                  : kind === "emoji"
                    ? "Emoji"
                    : "Image"}
              </button>
            ))}
          </div>
          {mode === "icon" && (
            <>
              <div className="icon-search">
                <input
                  aria-label="Search icons"
                  placeholder="Search icons"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <input
                  type="color"
                  aria-label="Icon background"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    if (draft?.kind === "icon")
                      setDraft({ ...draft, background: e.target.value });
                  }}
                />
              </div>
              <div className="icon-grid">
                {Object.keys(ICON_PACK)
                  .filter((name) => name.includes(query.toLowerCase()))
                  .map((name) => (
                    <button
                      type="button"
                      key={name}
                      title={name}
                      aria-label={name}
                      aria-pressed={
                        draft?.kind === "icon" && draft.name === name
                      }
                      onClick={() =>
                        setDraft({ kind: "icon", name, background: color })
                      }
                    >
                      <img
                        src={skillIconUrl({
                          kind: "icon",
                          name,
                          background: color,
                        })}
                        alt=""
                      />
                    </button>
                  ))}
              </div>
            </>
          )}
          {mode === "emoji" && (
            <>
              <input
                aria-label="Emoji"
                placeholder="Choose or paste an emoji"
                maxLength={32}
                value={draft?.kind === "emoji" ? draft.value : ""}
                onChange={(e) =>
                  setDraft({ kind: "emoji", value: e.target.value })
                }
              />
              <div className="icon-grid">
                {[
                  "🧠",
                  "✨",
                  "💻",
                  "🎨",
                  "📚",
                  "🛠️",
                  "🚀",
                  "❤️",
                  "📅",
                  "📧",
                  "🏠",
                  "💰",
                  "🎵",
                  "🌍",
                  "🤖",
                  "🔎",
                ].map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setDraft({ kind: "emoji", value })}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </>
          )}
          {mode === "image" && (
            <input
              aria-label="Upload icon image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          )}
          <div className="icon-picker-footer">
            <SkillIconView icon={draft} />
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const value = parseSkillIcon(draft);
                  await api(`/skills/${id}/icon`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      icon: value,
                      expectedRevision: revision,
                    }),
                  });
                  await onSaved();
                  setOpen(false);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
