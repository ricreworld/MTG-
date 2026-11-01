// One kind of set: what it is, examples (text only), which formats its cards usually fit, and links to them.
import { useState } from "react";
import type { SetType } from "../../content/sets";
import { Icon } from "../Icon";
import { Button } from "./Button";
import { Callout } from "./Callout";

export function SetTypeCard({ set, onJump }: { set: SetType; onJump: (target: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="grid gap-s2 rounded-lg border-2 border-border bg-surface p-s3" aria-labelledby={`set-${set.id}`}>
      <h3 id={`set-${set.id}`} className="text-lg">{set.name}</h3>
      <p>{set.summary}</p>
      {set.examples.length > 0 && <p className="text-sm"><span className="font-bold text-text-muted">Examples: </span>{set.examples.join("; ")}.</p>}
      <div>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex min-h-tap items-center gap-s2 rounded-md px-s2 font-bold underline decoration-accent decoration-2 underline-offset-4"><Icon name={open ? "close" : "info"} size={1.1} /> {open ? "Hide why it matters" : "Why it matters"}</button>
        {open && <p className="mt-s1 rounded-md bg-surface-2 p-s3">{set.why}</p>}
      </div>
      <p className="text-sm"><span className="font-bold text-text-muted">Usually legal in: </span>{set.legalIn.map((l) => l.label).join(", ")}.</p>
      {set.changes && <Callout kind="changes" lastVerified={set.lastVerified}>{set.changes}</Callout>}
      <div className="flex flex-wrap items-center gap-s2">
        <span className="text-sm font-bold text-text-muted">Leads to</span>
        {set.legalIn.map((l) => <Button key={l.target} onClick={() => onJump(l.target)}>{l.label}</Button>)}
      </div>
    </article>
  );
}
