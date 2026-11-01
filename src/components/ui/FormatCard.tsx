// One format: the same nine fields every time, summary first, details on tap.
import { useState } from "react";
import type { Format } from "../../content/formats";
import { Icon } from "../Icon";
import { Button } from "./Button";
import { Callout } from "./Callout";

export const FIELDS: { key: keyof Format["fields"]; label: string }[] = [
  { key: "deckSize", label: "Deck size" }, { key: "copies", label: "Copies of a card" }, { key: "life", label: "Starting life" }, { key: "players", label: "Players" },
  { key: "pool", label: "Card pool" }, { key: "rotates", label: "Rotates" }, { key: "where", label: "Where you play" }, { key: "cost", label: "Cost to start" }, { key: "bestFor", label: "Best for" },
];

export function FormatCard({ format, onCompare, onJump }: { format: Format; onCompare?: ((id: string) => void) | undefined; onJump?: ((target: string) => void) | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="grid gap-s2 rounded-lg border-2 border-border bg-surface p-s3" aria-labelledby={`fmt-${format.id}`}>
      <h3 id={`fmt-${format.id}`} className="text-lg">{format.name}{format.experienced && <span className="ml-s2 rounded-sm bg-accent-soft px-s2 text-sm font-bold">for experienced players</span>}</h3>
      <p>{format.summary}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-s3 gap-y-s1 text-sm">
        {FIELDS.map((f) => <div key={f.key} className="contents"><dt className="font-bold text-text-muted">{f.label}</dt><dd>{format.fields[f.key]}</dd></div>)}
      </dl>
      <div>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex min-h-tap items-center gap-s2 rounded-md px-s2 font-bold underline decoration-accent decoration-2 underline-offset-4"><Icon name={open ? "close" : "info"} size={1.1} /> {open ? "Hide why it matters" : "Why it matters"}</button>
        {open && <p className="mt-s1 rounded-md bg-surface-2 p-s3">{format.why}</p>}
      </div>
      {format.changes && <Callout kind="changes" lastVerified={format.lastVerified}>{format.changes}</Callout>}
      <div className="flex flex-wrap items-center gap-s2">
        {onCompare && <Button onClick={() => onCompare(format.id)}>Compare</Button>}
        {format.leadsTo.map((l) => <Button key={l.target} onClick={() => onJump?.(l.target)}>{l.label}</Button>)}
      </div>
    </article>
  );
}
