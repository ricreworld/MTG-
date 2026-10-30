// One calm check question: no timer, no score, no red. Wrong answers show the hint
// and the learner can try again as often as they like.
import { useId, useState } from "react";
import type { Check } from "../../content/schema";
import { Icon } from "../../components/Icon";

export function CheckQuestion({ check, onCorrect, answeredBefore = false }: { check: Check; onCorrect?: () => void; answeredBefore?: boolean }) {
  // Answered correctly on an earlier visit: show it as done (no need to answer again).
  // Captured once, so answering now doesn't switch the message to "earlier".
  const [earlier] = useState(answeredBefore);
  const [choice, setChoice] = useState<string | null>(earlier ? check.correctOptionId : null);
  const [result, setResult] = useState<"correct" | "hint" | null>(earlier ? "correct" : null);
  const name = useId();
  const questionId = useId();

  const submit = () => {
    if (!choice) return;
    if (choice === check.correctOptionId) { setResult("correct"); onCorrect?.(); }
    else setResult("hint");
  };

  return (
    <section aria-labelledby={questionId} className="grid gap-s3 rounded-lg border border-border-strong bg-surface-2 p-s4">
      <h3 id={questionId} className="text-lg font-bold">Quick check: {check.question}</h3>
      <fieldset className="grid gap-s2" disabled={result === "correct"}>
        <legend className="sr-only">{check.question}</legend>
        {check.options.map((o) => {
          const selected = choice === o.id;
          return (
            <label
              key={o.id}
              className={`flex min-h-tap cursor-pointer items-center gap-s3 rounded-md border-2 px-s4 py-s2 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-focus ${
                selected ? "border-accent bg-accent-soft" : "border-border-strong bg-surface"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o.id}
                checked={selected}
                onChange={() => { setChoice(o.id); if (result === "hint") setResult(null); }}
                className="h-5 w-5 accent-[rgb(var(--color-accent))]"
              />
              <span>{o.text}</span>
            </label>
          );
        })}
      </fieldset>
      {result !== "correct" && (
        <div>
          <button
            type="button"
            onClick={submit}
            disabled={!choice}
            className="min-h-tap rounded-md border-2 border-accent px-s5 font-bold disabled:cursor-not-allowed disabled:opacity-60"
          >
            Check my answer
          </button>
        </div>
      )}
      <div aria-live="polite">
        {result === "correct" && (
          <p className="flex items-start gap-s3 rounded-md bg-success-soft p-s3">
            <span className="text-success"><Icon name="check" /></span>
            <span><strong className="text-success">Correct.</strong> {earlier ? "You answered this one earlier." : "Nice work."}</span>
          </p>
        )}
        {result === "hint" && (
          <p className="flex items-start gap-s3 rounded-md bg-hint-soft p-s3">
            <span className="text-hint"><Icon name="info" /></span>
            <span><strong className="text-hint">Not quite. Here's a hint:</strong> {check.hint} Try again whenever you're ready.</span>
          </p>
        )}
      </div>
    </section>
  );
}
