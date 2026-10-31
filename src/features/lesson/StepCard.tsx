import { forwardRef } from "react";
import type { GlossaryEntry, Module, Step } from "../../content/schema";
import { CheckQuestion } from "./CheckQuestion";
import { Markdown } from "./Markdown";
import { Visual } from "./Visual";

interface Props {
  module: Module;
  step: Step;
  stepIndex: number;
  glossary: ReadonlyMap<string, GlossaryEntry>;
  checkPassed: boolean;
  onCheckCorrect: () => void;
}

/** The single card the learner works on. The heading receives focus on every step change. */
export const StepCard = forwardRef<HTMLHeadingElement, Props>(function StepCard({ module, step, stepIndex, glossary, checkPassed, onCheckCorrect }, headingRef) {
  return (
    <article aria-labelledby={`step-${step.id}`} className="ms-enter grid gap-s5 rounded-lg border border-border bg-surface p-s4 sm:p-s6 [@media(max-height:500px)]:gap-s4 [@media(max-height:500px)]:p-s4">
      <header className="grid gap-s2">
        <p className="text-sm font-bold text-text-muted">
          {module.title} · Step {stepIndex + 1} of {module.steps.length}
        </p>
        <h2 id={`step-${step.id}`} ref={headingRef} tabIndex={-1} className="text-2xl font-bold">
          {step.title}
        </h2>
      </header>
      <Markdown body={step.body} glossary={glossary} />
      <Visual visual={step.visual} />
      {step.check && <CheckQuestion key={step.id} check={step.check} answeredBefore={checkPassed} onCorrect={onCheckCorrect} />}
      <footer className="border-t border-border pt-s3">
        <p className="text-sm text-text-muted">
          Rule reference: {step.ruleRefs.join(", ")} (Magic Comprehensive Rules)
        </p>
      </footer>
    </article>
  );
});
