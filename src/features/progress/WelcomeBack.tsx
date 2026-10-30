// The one calm "welcome back" card. Start over asks once more before clearing anything.
import { forwardRef, useState } from "react";
import { Icon } from "../../components/Icon";

interface Props {
  where: string;
  percent: number;
  done: number;
  total: number;
  onContinue: () => void;
  onStartOver: () => void;
}

export const WelcomeBack = forwardRef<HTMLHeadingElement, Props>(function WelcomeBack(
  { where, percent, done, total, onContinue, onStartOver },
  headingRef,
) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section aria-labelledby="welcome-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s5">
      <h2 id="welcome-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Welcome back</h2>
      <p>Continue where you left off?</p>
      <div className="grid gap-s1 rounded-md bg-surface-2 p-s4">
        <p><strong>You were on:</strong> {where}</p>
        <p className="text-text-muted">You've done {percent}% of the course ({done} of {total} steps).</p>
      </div>
      {!confirming ? (
        <div className="flex flex-wrap gap-s3">
          <button type="button" onClick={onContinue} className="inline-flex min-h-tap items-center gap-s2 rounded-md bg-accent px-s5 font-bold text-accent-ink">
            <Icon name="play" /> Continue
          </button>
          <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-tap items-center gap-s2 rounded-md border-2 border-border-strong bg-surface px-s5 font-bold">
            Start over
          </button>
        </div>
      ) : (
        <div className="grid gap-s3 rounded-md border-2 border-border-strong p-s4" role="group" aria-labelledby="confirm-text">
          <p id="confirm-text">Starting over clears your checkmarks, answers and checklist ticks. Your settings stay the same.</p>
          <div className="flex flex-wrap gap-s3">
            <button type="button" onClick={() => setConfirming(false)} className="inline-flex min-h-tap items-center rounded-md bg-accent px-s5 font-bold text-accent-ink">
              Keep my progress
            </button>
            <button type="button" onClick={onStartOver} className="inline-flex min-h-tap items-center rounded-md border-2 border-border-strong bg-surface px-s5 font-bold">
              Yes, start over
            </button>
          </div>
        </div>
      )}
    </section>
  );
});
