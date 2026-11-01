// A sequence of steps shown one at a time with a visible position, for the turn and for combat.
import { useState } from "react";
import { Button } from "./Button";
import { ProgressMarker } from "./ProgressMarker";

export interface FlowStep { id: string; title: string; summary: string; detail: string; terms?: { word: string; plain: string }[] }

export function StepFlow({ label, steps }: { label: string; steps: FlowStep[] }) {
  const [i, setI] = useState(0);
  const step = steps[i]!;
  return (
    <div className="grid gap-s3 rounded-lg border-2 border-border bg-surface-2 p-s3" role="group" aria-label={label}>
      <ProgressMarker label={label} index={i} total={steps.length} />
      <ol className="flex flex-wrap gap-s1" aria-label={`${label} steps`}>
        {steps.map((s, k) => <li key={s.id}><button type="button" aria-current={k === i ? "step" : undefined} onClick={() => setI(k)} className={`min-h-tap rounded-md border-2 px-s2 text-sm font-bold ${k === i ? "border-accent bg-accent text-accent-ink" : "border-border-strong bg-surface"}`}>{k + 1}. {s.title}</button></li>)}
      </ol>
      <div className="grid gap-s2 rounded-md bg-surface p-s3" aria-live="polite">
        <h4 className="text-lg">{step.title}</h4>
        <p>{step.summary}</p>
        <p className="text-text-muted">{step.detail}</p>
        {step.terms?.length ? <dl className="grid gap-s1 text-sm">{step.terms.map((t) => <div key={t.word} className="rounded-sm bg-surface-2 px-s2 py-s1"><dt className="inline font-bold">{t.word}: </dt><dd className="inline">{t.plain}</dd></div>)}</dl> : null}
      </div>
      <div className="flex gap-s2">
        <Button icon="back" disabled={i === 0} onClick={() => setI(i - 1)}>Previous step</Button>
        <Button look="primary" icon="next" disabled={i === steps.length - 1} onClick={() => setI(i + 1)}>Next step</Button>
      </div>
    </div>
  );
}
