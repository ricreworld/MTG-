// Screen B: Ways to play. Three families, the same nine fields per format, compare mode, and a three-question picker.
import { forwardRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Callout } from "../../components/ui/Callout";
import { FormatCard } from "../../components/ui/FormatCard";
import { FormatCompare } from "../../components/ui/FormatCompare";
import { FAMILIES, FORMATS, FORMATS_LAST_VERIFIED, QUESTIONS, formatById, recommend } from "../../content/formats";

interface Props { onJump: (target: string) => void; initial?: string | null | undefined }

export const WaysScreen = forwardRef<HTMLHeadingElement, Props>(function WaysScreen({ onJump, initial }, ref) {
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);

  const jump = (target: string) => {
    const f = formatById(target);
    if (f) { const el = document.getElementById(`fmt-${f.id}`); if (el) { el.scrollIntoView({ block: "start" }); el.focus?.(); return; } }
    onJump(target);
  };
  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]));
  const a = compare[0] ? formatById(compare[0]) : undefined;
  const b = compare[1] ? formatById(compare[1]) : undefined;
  const answered = QUESTIONS.every((q) => answers[q.id]);
  const result = picked ? formatById(picked) : null;

  return (
    <section aria-labelledby="ways-heading" className="grid gap-s4">
      <div className="grid gap-s2">
        <h2 id="ways-heading" ref={ref} tabIndex={-1} className="text-2xl">Ways to play</h2>
        <p>Every format answers the same nine questions, so you can compare any two. Not sure? Answer three questions below and we'll point at one.</p>
      </div>

      <div className="grid gap-s3 rounded-lg border-2 border-border bg-surface-2 p-s3" role="group" aria-labelledby="picker-h">
        <h3 id="picker-h" className="text-lg">Which format is for me?</h3>
        {QUESTIONS.map((q) => (
          <fieldset key={q.id} className="grid gap-s2">
            <legend className="font-bold">{q.text}</legend>
            <div className="flex flex-wrap gap-s2">{q.options.map((o) => <Button key={o.id} pressed={answers[q.id] === o.id} onClick={() => { setAnswers({ ...answers, [q.id]: o.id }); setPicked(null); }}>{o.text}</Button>)}</div>
          </fieldset>
        ))}
        <div><Button look="primary" disabled={!answered} onClick={() => setPicked(recommend(answers).id)}>Show my format</Button></div>
        {result && <Callout kind="success"><p><span className="font-bold">{result.name}.</span> {result.summary}</p><p className="mt-s2"><Button onClick={() => jump(result.id)}>Read about {result.name}</Button></p></Callout>}
      </div>

      <div className="flex flex-wrap items-center gap-s2">
        <Button pressed={comparing} onClick={() => { setComparing((v) => !v); setCompare([]); }}>{comparing ? "Stop comparing" : "Compare two formats"}</Button>
        {comparing && <span className="text-sm text-text-muted">{compare.length === 0 ? "Pick the first format." : compare.length === 1 ? "Pick a second format." : "Both picked. The table is below."}</span>}
      </div>
      {a && b && <div className="overflow-x-auto rounded-lg border-2 border-border bg-surface p-s3"><FormatCompare a={a} b={b} /></div>}

      {FAMILIES.map((fam) => (
        <section key={fam.id} id={`family-${fam.id}`} aria-labelledby={`fam-${fam.id}`} className="grid gap-s3">
          <h3 id={`fam-${fam.id}`} className="text-xl">{fam.name}</h3>
          <p>{fam.summary}</p>
          {FORMATS.filter((f) => f.family === fam.id).map((f) => (
            <div key={f.id} className={initial === f.id ? "rounded-lg ring-4 ring-accent" : ""}>
              <FormatCard format={f} onCompare={comparing ? toggleCompare : undefined} onJump={jump} />
            </div>
          ))}
        </section>
      ))}
      <Callout kind="changes" lastVerified={FORMATS_LAST_VERIFIED}>Deck rules, banned lists and which sets are legal move over time. The official format pages are the source of truth.</Callout>
    </section>
  );
});
