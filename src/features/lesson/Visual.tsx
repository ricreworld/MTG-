import { CARDS } from "../../game/cards";
import { GameCard } from "../practice/GameCard";
import type { Visual as VisualData } from "../../content/schema";
import { DIAGRAMS, H_VIEW, W_VIEW } from "./diagrams";

// "card" visuals render a real practice card (official Foundations art, Fan Content Policy).
// "svg" visuals come from the diagram registry (original drawings built from the app's tokens).
// Anything missing shows as a clearly labelled placeholder, so a typo never hides a lesson.
export function Visual({ visual }: { visual: VisualData }) {
  if (visual.type === "image") {
    return <img src={visual.src} alt={visual.altText} className="ms-settle max-w-full rounded-md border border-border" />;
  }
  const card = visual.type === "card" ? CARDS[visual.src] : undefined;
  if (card) {
    return (
      <figure className="ms-settle grid justify-items-start gap-s2">
        <GameCard card={card} size="lg" />
        <figcaption className="text-sm text-text-muted">{visual.altText} Art by {card.artist}. © Wizards of the Coast.</figcaption>
      </figure>
    );
  }
  const diagram = visual.type === "svg" ? DIAGRAMS[visual.src] : undefined;
  if (diagram) {
    return (
      <figure className="ms-settle grid gap-s2">
        <svg viewBox={`0 0 ${W_VIEW} ${H_VIEW}`} role="img" aria-label={visual.altText} className="diagram h-auto w-full max-w-[36rem] rounded-lg border border-border bg-surface-2">
          {diagram()}
        </svg>
        <figcaption className="text-sm text-text-muted">{visual.altText}</figcaption>
      </figure>
    );
  }
  return (
    <div className="grid min-h-[8rem] content-center gap-s1 rounded-md border-2 border-dashed border-border-strong bg-surface-2 p-s4 text-text-muted">
      <p className="text-sm font-bold">Picture coming soon</p>
      <p>{visual.type === "placeholder" ? visual.src : visual.altText}</p>
    </div>
  );
}
