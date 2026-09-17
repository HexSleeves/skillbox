import { useEffect, useState, type ReactNode } from "react";
import { Link2, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { api } from "./api";
import { skillReferenceMarkdown } from "../skill-references";
import type { SkillSummary } from "../shared";
import { SkillIconView } from "./skill-icon";
export function SkillReference({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const [target, setTarget] = useState<any>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setTarget(null);
    setFailed(false);
    api(`/skill-references/${id}`)
      .then((r) => {
        if (live) setTarget(r);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [id]);
  if (failed)
    return (
      <span
        className="skill-reference unavailable"
        title="Skill missing, disabled or outside your access"
      >
        <Link2 size={13} />
        {children} · unavailable
      </span>
    );
  if (!target)
    return (
      <span className="skill-reference">
        <Link2 size={13} />
        {children}
      </span>
    );
  return (
    <Link
      className={`skill-reference ${target.disabled ? "unavailable" : ""}`}
      to="/skills/$id"
      params={{ id: target.id }}
      title={`${target.title}${target.disabled ? " · disabled" : target.archived ? " · archived" : ""}`}
    >
      <Link2 size={13} />
      {children}
      {target.disabled ? " · disabled" : ""}
    </Link>
  );
}
export function ReferencePicker({
  onInsert,
  currentId,
}: {
  onInsert: (markdown: string) => void;
  currentId: string;
}) {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<SkillSummary[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (open)
      api("/skills?limit=500")
        .then((r) => setItems(r.items))
        .catch((e) => setError(e.message));
  }, [open]);
  return (
    <div className="reference-picker">
      <button type="button" onClick={() => setOpen(!open)}>
        <Link2 size={14} /> Link skill
      </button>
      {open && (
        <div className="reference-picker-menu">
          <label>
            <Search size={14} />
            <input
              aria-label="Find skill to reference"
              placeholder="Find a skill…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <div>
            {items
              .filter(
                (s) =>
                  s.id !== currentId &&
                  s.referenceId &&
                  `${s.title} ${s.id}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onInsert(skillReferenceMarkdown(s.title, s.referenceId!));
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <SkillIconView icon={s.icon} />
                  {s.title}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
