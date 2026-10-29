import type { Visual as VisualData } from "../../content/schema";

// "svg" visuals come from a diagram registry added with the curriculum (Phase 5).
// Until a diagram exists, every visual shows as a clearly labelled placeholder.
export function Visual({ visual }: { visual: VisualData }) {
  if (visual.type === "image") {
    return <img src={visual.src} alt={visual.altText} className="max-w-full rounded-md border border-border" />;
  }
  return (
    <figure
      role="img"
      aria-label={visual.altText}
      className="grid min-h-[8rem] content-center rounded-md border-2 border-dashed border-border-strong bg-surface-2 p-s4"
    >
      <figcaption className="grid gap-s1 text-text-muted">
        <span className="text-sm font-bold">Picture coming soon</span>
        <span>{visual.type === "placeholder" ? visual.src : visual.altText}</span>
      </figcaption>
    </figure>
  );
}
