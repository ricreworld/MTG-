// Always-visible "where am I": a row of dots, the current one filled, with words beside it.
export function ProgressMarker({ label, index, total }: { label: string; index: number; total: number }) {
  return (
    <div className="flex items-center gap-s3" aria-label={`${label}: part ${index + 1} of ${total}`} role="group">
      <ol className="flex items-center gap-s1" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => <li key={i} className={`h-2.5 rounded-full transition-all duration-motion ${i === index ? "w-6 bg-accent" : i < index ? "w-2.5 bg-success" : "w-2.5 bg-border-strong"}`} />)}
      </ol>
      <span className="text-sm font-bold"><span className="font-display">{label}</span> <span className="text-text-muted">{index + 1} of {total}</span></span>
    </div>
  );
}
