// One idea: a one-line summary, "why it matters" on tap, and "leads to" buttons that jump to the next idea.
import { useId, useState } from "react";
import { Icon } from "../Icon";
import { Button } from "./Button";

export interface LeadsTo { label: string; target: string }

interface Props {
  id: string;
  title: string;
  summary: string;
  why: string;
  leadsTo?: LeadsTo[];
  onJump?: ((target: string) => void) | undefined;
  /** Shown when this step is the active one (for the pinned card). */
  active?: boolean;
  onActivate?: (() => void) | undefined;
  children?: React.ReactNode;
}

export function LessonStep({ id, title, summary, why, leadsTo = [], onJump, active, onActivate, children }: Props) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`grid gap-s2 rounded-lg border-2 p-s3 ${active ? "border-accent bg-surface" : "border-border bg-surface"}`} onFocus={onActivate} onPointerDown={onActivate}>
      <h3 id={`${id}-h`} className="text-lg">{title}</h3>
      <p>{summary}</p>
      {children}
      <div>
        <button type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen((v) => !v)} className="inline-flex min-h-tap items-center gap-s2 rounded-md px-s2 font-bold underline decoration-accent decoration-2 underline-offset-4">
          <Icon name={open ? "close" : "info"} size={1.1} /> {open ? "Hide why it matters" : "Why it matters"}
        </button>
        <div id={panel} className="unfold grid" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
          <div className="overflow-hidden"><p className="rounded-md bg-surface-2 p-s3">{why}</p></div>
        </div>
      </div>
      {leadsTo.length > 0 && (
        <div className="flex flex-wrap items-center gap-s2">
          <span className="text-sm font-bold text-text-muted">Leads to</span>
          {leadsTo.map((l) => <Button key={l.target} look="secondary" onClick={() => onJump?.(l.target)}>{l.label}</Button>)}
        </div>
      )}
    </section>
  );
}
