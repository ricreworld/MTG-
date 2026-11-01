// The signature element: an original example card (invented names, CSS/SVG art, our own frame and
// symbols). Three shapes: a creature, a planeswalker, a land. Each part is a Hotspot; the one being
// taught lights up. Nothing here copies an official frame, symbol or illustration.
import { ManaSymbol, type ManaColor } from "../ManaSymbol";
import { Hotspot } from "./Hotspot";

export type CardShape = "creature" | "planeswalker" | "land";
export type ZoneId = "name" | "cost" | "art" | "type" | "set" | "rules" | "flavor" | "pt" | "loyalty" | "mana-ability";

export interface ExampleCardData {
  shape: CardShape;
  name: string;
  cost: { color: ManaColor; n?: number }[];
  color: ManaColor;
  typeLine: string;
  rarity: "common" | "uncommon" | "rare" | "mythic";
  rules: string[];
  flavor?: string;
  power?: number;
  toughness?: number;
  loyalty?: number;
  loyaltyAbilities?: { change: string; text: string }[];
}

/** Original example cards. Names and art are invented. */
export const EXAMPLE_CARDS: Record<CardShape, ExampleCardData> = {
  creature: { shape: "creature", name: "Lantern Fox", cost: [{ color: "C", n: 1 }, { color: "G" }], color: "G", typeLine: "Creature — Fox Spirit", rarity: "uncommon", rules: ["Vigilance (attacking doesn't cause this creature to tap)", "When Lantern Fox enters, you gain 2 life."], flavor: "It carries a small light so nobody walks the wood alone.", power: 2, toughness: 2 },
  planeswalker: { shape: "planeswalker", name: "Mira of the Tidepools", cost: [{ color: "C", n: 2 }, { color: "U" }], color: "U", typeLine: "Legendary Planeswalker — Mira", rarity: "mythic", rules: [], loyalty: 4, loyaltyAbilities: [{ change: "+1", text: "Draw a card, then discard a card." }, { change: "−3", text: "Return target creature to its owner's hand." }] },
  land: { shape: "land", name: "Mossgrove", cost: [], color: "G", typeLine: "Basic Land — Forest", rarity: "common", rules: ["Tap: add one green mana."] },
};

const FRAME: Record<ManaColor, string> = { W: "bg-mtg-white text-mtg-white-ink", U: "bg-mtg-blue text-mtg-blue-ink", B: "bg-mtg-black text-mtg-black-ink", R: "bg-mtg-red text-mtg-red-ink", G: "bg-mtg-green text-mtg-green-ink", C: "bg-mtg-colorless text-mtg-colorless-ink" };
const RARITY_SHAPE: Record<ExampleCardData["rarity"], { word: string; path: string }> = {
  common: { word: "common", path: "M12 4 L20 12 L12 20 L4 12 Z" },
  uncommon: { word: "uncommon", path: "M4 8 L12 4 L20 8 L20 16 L12 20 L4 16 Z" },
  rare: { word: "rare", path: "M12 3 L15 9 L21 10 L16.5 14.5 L18 21 L12 18 L6 21 L7.5 14.5 L3 10 L9 9 Z" },
  mythic: { word: "mythic rare", path: "M12 2 C15 8 20 9 20 14 A8 8 0 0 1 4 14 C4 9 9 8 12 2 Z" },
};

/** Original, abstract art drawn in SVG: shapes in the card's colour, different per card. */
function Art({ shape, color }: { shape: CardShape; color: ManaColor }) {
  const ink = `rgb(var(--mtg-${{ W: "white", U: "blue", B: "black", R: "red", G: "green", C: "colorless" }[color]}-ink))`;
  return (
    <svg viewBox="0 0 120 70" className="h-full w-full" aria-hidden="true">
      <rect width="120" height="70" fill="currentColor" opacity="0.25" />
      {shape === "creature" && <g fill={ink} opacity="0.8"><ellipse cx="60" cy="50" rx="26" ry="12" /><circle cx="60" cy="30" r="12" /><path d="M48 22 L52 8 L58 20 Z" /><path d="M72 22 L68 8 L62 20 Z" /><circle cx="86" cy="20" r="6" opacity="0.6" /></g>}
      {shape === "planeswalker" && <g fill={ink} opacity="0.8"><path d="M20 60 Q40 10 60 40 Q80 70 100 20" fill="none" stroke={ink} strokeWidth="4" /><circle cx="60" cy="40" r="7" /><circle cx="30" cy="30" r="3" /><circle cx="92" cy="48" r="3" /></g>}
      {shape === "land" && <g fill={ink} opacity="0.8"><path d="M0 70 L30 25 L55 55 L75 20 L120 70 Z" /><circle cx="95" cy="18" r="8" opacity="0.5" /></g>}
    </svg>
  );
}

interface Props {
  card: ExampleCardData;
  lit: ZoneId | null;
  onPick: (zone: ZoneId) => void;
  /** Compact strip when the reader scrolls on. */
  compact?: boolean;
  /** Called when the reader asks to see the full card again from the strip. */
  onExpand?: (() => void) | undefined;
}

export const ZONE_LABEL: Record<ZoneId, string> = { name: "Name", cost: "Mana cost", art: "Art", type: "Type line", set: "Set symbol and rarity", rules: "Rules text", flavor: "Flavour text", pt: "Power and toughness", loyalty: "Loyalty", "mana-ability": "Mana ability" };

export function ExampleCard({ card, lit, onPick, compact = false, onExpand }: Props) {
  const pick = (id: string) => onPick(id as ZoneId);
  const rar = RARITY_SHAPE[card.rarity];
  if (compact) {
    // The strip keeps the lit zone visible by name and is itself the way back to the full card.
    return (
      <button type="button" onClick={onExpand} data-zone={lit ?? ""} data-lit={lit !== null} aria-label={`${card.name}, the example card${lit ? `, showing ${ZONE_LABEL[lit]}` : ""}. Open the full card.`} className={`card-zone flex min-h-tap w-full items-center gap-s2 rounded-md border-2 border-border-strong p-s2 text-left ${FRAME[card.color]}`}>
        <span className="h-10 w-14 shrink-0 overflow-hidden rounded-sm"><Art shape={card.shape} color={card.color} /></span>
        <span className="grid min-w-0"><span className="truncate font-display font-bold">{card.name}</span>{lit && <span className="truncate text-sm">Showing: {ZONE_LABEL[lit]}</span>}</span>
        <span className="ml-auto shrink-0 rounded-sm bg-surface px-s2 py-s1 text-sm font-bold text-text">Open card</span>
      </button>
    );
  }
  return (
    <div className={`mx-auto grid w-full max-w-[22rem] grid-rows-[auto_auto_auto_1fr_auto] gap-s1 rounded-lg border-[6px] border-border-strong p-s2 ${FRAME[card.color]}`} role="group" aria-label={`${card.name}, the example card. Tap a part to learn about it.`}>
      {/* name and cost */}
      <div className="grid grid-cols-[1fr_auto] gap-s2">
        <Hotspot id="name" label={`${card.name}, the name`} lit={lit === "name"} onPick={pick} className="rounded-sm bg-surface px-s2 py-s1 font-display text-lg font-bold text-text">{card.name}</Hotspot>
        {card.cost.length > 0 && (
          <Hotspot id="cost" label="Mana cost" lit={lit === "cost"} onPick={pick} className="flex w-auto items-center gap-[2px] rounded-full bg-surface px-s2">
            {card.cost.map((c, i) => c.n !== undefined ? <span key={i} className="inline-grid h-7 w-7 place-items-center rounded-full bg-mtg-colorless font-mono font-bold text-mtg-colorless-ink">{c.n}</span> : <ManaSymbol key={i} color={c.color} size={1.6} />)}
          </Hotspot>
        )}
      </div>
      {/* art */}
      <Hotspot id="art" label="Art" lit={lit === "art"} onPick={pick} className="aspect-[12/7] overflow-hidden rounded-sm border-2 border-border-strong"><Art shape={card.shape} color={card.color} /></Hotspot>
      {/* type line, set symbol and rarity */}
      <div className="grid grid-cols-[1fr_auto] gap-s2">
        <Hotspot id="type" label={`${card.typeLine}, the type line`} lit={lit === "type"} onPick={pick} className="rounded-sm bg-surface px-s2 py-s1 font-bold text-text">{card.typeLine}</Hotspot>
        <Hotspot id="set" label={`Set symbol, rarity ${rar.word}`} lit={lit === "set"} onPick={pick} className="grid w-auto place-items-center rounded-sm bg-surface px-s2">
          <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true"><path d={rar.path} fill="rgb(var(--color-accent))" stroke="rgb(var(--color-text))" strokeWidth="1.2" /></svg>
        </Hotspot>
      </div>
      {/* rules and flavour, or loyalty abilities */}
      <div className="grid gap-s1 rounded-sm bg-surface p-s2 text-text">
        {card.shape === "planeswalker" ? (
          <Hotspot id="rules" label="Loyalty abilities" lit={lit === "rules"} onPick={pick} className="grid gap-s1">
            {card.loyaltyAbilities?.map((a) => <span key={a.change} className="grid grid-cols-[2.6rem_1fr] items-start gap-s2"><span className="rounded-sm bg-accent px-1 text-center font-mono font-bold text-accent-ink">{a.change}</span><span>{a.text}</span></span>)}
          </Hotspot>
        ) : (
          <Hotspot id={card.shape === "land" ? "mana-ability" : "rules"} label="Rules text" lit={lit === "rules" || lit === "mana-ability"} onPick={pick} className="grid gap-s1">
            {card.rules.map((r) => <span key={r}>{r}</span>)}
          </Hotspot>
        )}
        {card.flavor && <Hotspot id="flavor" label="Flavour text" lit={lit === "flavor"} onPick={pick} className="border-t border-border pt-s1 text-sm text-text-muted">{card.flavor}</Hotspot>}
      </div>
      {/* power/toughness or loyalty */}
      <div className="flex justify-end">
        {card.shape === "creature" && <Hotspot id="pt" label={`${card.power}/${card.toughness}, power and toughness`} lit={lit === "pt"} onPick={pick} className="w-auto rounded-sm border-2 border-border-strong bg-surface px-s3 font-mono text-lg font-bold text-text">{card.power}/{card.toughness}</Hotspot>}
        {card.shape === "planeswalker" && <Hotspot id="loyalty" label={`Loyalty ${card.loyalty}`} lit={lit === "loyalty"} onPick={pick} className="w-auto rounded-sm border-2 border-border-strong bg-surface px-s3 font-mono text-lg font-bold text-text">Loyalty {card.loyalty}</Hotspot>}
      </div>
    </div>
  );
}
