import { CARDS } from "../../game/cards";
import { GameCard } from "../practice/GameCard";
import type { Visual as VisualData } from "../../content/schema";

// "card" visuals render a real practice card (official Foundations art, Fan Content Policy).
// "svg" visuals come from a diagram registry added with the curriculum (Phase 5).
// Until a diagram exists, every visual shows as a clearly labelled placeholder.
export function Visual({ visual }: { visual: VisualData }) {
  if (visual.type === "image") {
    return <img src={visual.src} alt={visual.altText} className="max-w-full rounded-md border border-border" />;
  }
  const card = visual.type === "card" ? CARDS[visual.src] : undefined;
  if (card) {
    return (
      <figure className="grid justify-items-start gap-s2">
        <GameCard card={card} size="lg" />
        <figcaption className="text-sm text-text-muted">{visual.altText} Art by {card.artist}. © Wizards of the Coast.</figcaption>
      </figure>
    );
  }
  return (
    // The placeholder is text, so it's read as text (no image role needed).
    <div className="grid min-h-[8rem] content-center gap-s1 rounded-md border-2 border-dashed border-border-strong bg-surface-2 p-s4 text-text-muted">
      <p className="text-sm font-bold">Picture coming soon</p>
      <p>{visual.type === "placeholder" ? visual.src : visual.altText}</p>
    </div>
  );
}
