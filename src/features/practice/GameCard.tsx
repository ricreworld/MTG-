// A card on the Practice Table, laid out like a real card: name bar with cost, art box, type line,
// text box, and a power/toughness box. The frame colour matches the card's colour.
// Everything is original (own frame design and own art). The whole card is a button, so it's
// tappable and keyboard-focusable; its accessible name is the visible text plus hidden detail.
import { ManaSymbol, type ManaColor } from "../../components/ManaSymbol";
import { COLOR_NAME, parseCost, type CardDef } from "../../game/cards";
import type { Permanent } from "../../game/engine";
import { power, toughness } from "../../game/engine";
import { CardArt } from "./CardArt";

/** Frame fill + ink per colour (contrast of ink on fill is checked in tokens.css). */
const FRAME: Record<CardDef["color"], string> = {
  W: "bg-mtg-white text-mtg-white-ink",
  U: "bg-mtg-blue text-mtg-blue-ink",
  B: "bg-mtg-black text-mtg-black-ink",
  R: "bg-mtg-red text-mtg-red-ink",
  G: "bg-mtg-green text-mtg-green-ink",
};

function CostSymbols({ cost, size }: { cost: string | undefined; size: number }) {
  if (!cost) return null;
  const parts = cost.match(/\d+|[WUBRG]/g) ?? [];
  return (
    <span className="inline-flex shrink-0 gap-[1px]">
      {parts.map((p, i) =>
        /\d/.test(p) ? (
          <span key={i} role="img" aria-label={`${p} generic mana`} style={{ width: `${size}rem`, height: `${size}rem` }} className="inline-grid place-items-center rounded-full bg-mtg-colorless font-mono text-[0.7em] font-bold text-mtg-colorless-ink">{p}</span>
        ) : (
          <ManaSymbol key={i} color={p as ManaColor} size={size} />
        ),
      )}
    </span>
  );
}

export function describeCost(cost: string): string {
  const c = parseCost(cost);
  const bits: string[] = [];
  if (c.generic) bits.push(`${c.generic} generic`);
  for (const k of ["W", "U", "B", "R", "G"] as const) if (c[k]) bits.push(`${c[k]} ${COLOR_NAME[k]}`);
  return bits.join(" and ");
}

export function describeCard(card: CardDef, perm?: Permanent): string {
  const parts = [card.name];
  if (card.cost) parts.push(`costs ${describeCost(card.cost)}`);
  parts.push(card.kind === "land" ? `${COLOR_NAME[card.color]} land` : card.kind);
  if (perm && card.kind === "creature") parts.push(`${power(perm)} power, ${toughness(perm)} toughness`);
  else if (card.kind === "creature") parts.push(`${card.power} power, ${card.toughness} toughness`);
  if (card.keywords?.length) parts.push(card.keywords.join(", "));
  if (card.kind === "instant") parts.push(card.text);
  if (perm?.tapped) parts.push("tapped");
  if (perm?.summoningSick && card.kind === "creature" && !card.keywords?.includes("Haste")) parts.push("arrived this turn");
  if (perm && perm.damage > 0) parts.push(`${perm.damage} damage marked`);
  return parts.join(", ");
}

const typeLine = (card: CardDef): string => {
  if (card.kind === "land") return "Basic Land";
  if (card.kind === "creature") return "Creature";
  return "Instant";
};

interface Props {
  card: CardDef;
  perm?: Permanent;
  /** What tapping the card does right now, read by screen readers ("Play this land"). */
  action?: string | undefined;
  selected?: boolean | undefined;
  /** A visible word for state, e.g. "Attacking" or "Blocks Ghoul". */
  badge?: string | undefined;
  onClick?: (() => void) | undefined;
  size?: "sm" | "md";
}

export function GameCard({ card, perm, action, selected, badge, onClick, size = "md" }: Props) {
  const tapped = perm?.tapped ?? false;
  const sm = size === "sm";
  const detail = describeCard(card, perm).replace(`${card.name}, `, "");
  const srDetail = `, ${detail}${action ? `. ${action}` : ""}`;
  const pt = card.kind === "creature" ? `${perm ? power(perm) : card.power}/${perm ? toughness(perm) : card.toughness}` : null;
  const rules = card.kind === "creature" ? (card.keywords?.join(", ") ?? "") : card.text;

  const body = (
    <span
      className={`relative grid ${sm ? "w-[4.8rem] text-[0.55rem]" : "w-[6.6rem] text-[0.62rem]"} aspect-[5/7] grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto_auto] gap-[2px] rounded-[0.45rem] border-[3px] p-[3px] text-left leading-tight ${FRAME[card.color]} ${
        selected ? "border-focus ring-[3px] ring-focus" : "border-border-strong"
      } ${tapped ? "rotate-6" : ""}`}
    >
      {/* Name bar */}
      <span className="min-w-0 rounded-[3px] bg-surface px-1 py-[2px] font-bold leading-[1.1] text-text">{card.name}</span>
      {/* Art box, with the mana cost pinned in its top-right corner */}
      <span className="relative min-h-0 overflow-hidden rounded-[3px] border border-border-strong bg-bg/20 p-[2px]">
        <CardArt cardId={card.id} />
        {card.cost && (
          <span className="absolute right-[1px] top-[1px] rounded-full bg-surface p-[1px]">
            <CostSymbols cost={card.cost} size={sm ? 0.75 : 0.85} />
          </span>
        )}
      </span>
      {/* Type line */}
      <span className="truncate rounded-[3px] bg-surface px-1 py-[1px] text-[0.9em] font-bold text-text">{typeLine(card)}</span>
      {/* Text box */}
      <span className={`${sm ? "min-h-[1.4em]" : "min-h-[2.6em]"} rounded-[3px] bg-surface px-1 py-[2px] text-text`}>
        <span className={`${card.kind === "instant" ? "line-clamp-3" : "line-clamp-2"} ${card.kind === "creature" ? "font-bold" : ""}`}>{rules || " "}</span>
      </span>
      {pt && (
        <span className="absolute bottom-[-3px] right-[-3px] rounded-[4px] border-[2px] border-border-strong bg-surface px-1 font-mono text-[0.95em] font-bold text-text">{pt}</span>
      )}
      {perm && perm.damage > 0 && (
        <span className="absolute bottom-[-3px] left-[-3px] rounded-[4px] border-[2px] border-border-strong bg-surface px-1 font-mono text-[0.85em] font-bold text-text">−{perm.damage}</span>
      )}
    </span>
  );

  return (
    <span className="grid justify-items-center gap-1">
      {onClick ? (
        <button type="button" onClick={onClick} aria-pressed={selected} className="rounded-md">
          {body}
          <span className="sr-only">{srDetail}</span>
        </button>
      ) : (
        <span>{body}<span className="sr-only">{srDetail}</span></span>
      )}
      {(badge || tapped) && (
        <span className="max-w-[7rem] rounded-sm bg-surface-2 px-1 text-center text-[0.65rem] font-bold leading-tight">{[tapped ? "Tapped" : null, badge].filter(Boolean).join(" · ")}</span>
      )}
    </span>
  );
}
