// Course progress: a bar AND the numbers in words, so it never relies on colour alone.
export function ProgressBar({ done, total, percent }: { done: number; total: number; percent: number }) {
  return (
    <div data-focus-hide className="grid gap-s1">
      <p className="text-sm text-text-muted">
        <span className="font-bold text-text">Course progress: {percent}%</span>, {done} of {total} steps done
      </p>
      <div
        role="progressbar"
        aria-label="Course progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent} percent, ${done} of ${total} steps done`}
        className="h-s3 overflow-hidden rounded-full border border-border-strong bg-surface-2"
      >
        <div className="ms-bar h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
