// A card on the Practice Table. All art is simple original SVG; no official card frames or symbols.
// The whole card is a button so it's tappable and keyboard-focusable, with a full text label.
import { ManaSymbol, type ManaColor } from "../../components/ManaSymbol";
import { COLOR_NAME, parseCost, type CardDef } from "../../game/cards";
import type { Permanent } from "../../game/engine";
import { power, toughness } from "../../game/engine";

const FRAME: Record<CardDef["color"], string> = {
  W: "bg-mtg-white text-mtg-white-ink",
  U: "bg-mtg-blue text-mtg-blue-ink",
  B: "bg-mtg-black text-mtg-black-ink",
  R: "bg-mtg-red text-mtg-red-ink",
  G: "bg-mtg-green text-mtg-green-ink",
};

function CostSymbols({ cost }: { cost: string | undefined }) {
  if (!cost) return null;
  const parts = (cost.match(/\d+|[WUBRG]/g) ?? []);
  return (
    <span className="inline-flex gap-[2px]">
      {parts.map((p, i) =>
        /\d/.test(p) ? (
          <span key={i} role="img" aria-label={`${p} generic mana`} className="inline-grid h-[1.1rem] w-[1.1rem] place-items-center rounded-full bg-mtg-colorless font-mono text-[0.7rem] font-bold text-mtg-colorless-ink">{p}</span>
        ) : (
          <ManaSymbol key={i} color={p as ManaColor} size={1.1} />
        ),
      )}
    </span>
  );
}

/** Simple original art per card kind: a hill for lands, a silhouette for creatures, a spark for instants. */
function Art({ card }: { card: CardDef }) {
  if (card.kind === "land") {
    return (
      <svg viewBox="0 0 60 30" className="h-8 w-full" aria-hidden="true">
        <path d="M0 30 Q15 8 30 20 T60 30 Z" fill="currentColor" opacity="0.5" />
        <circle cx="46" cy="9" r="4" fill="currentColor" opacity="0.7" />
      </svg>
    );
  }
  if (card.kind === "creature") {
    return (
      <svg viewBox="0 0 60 30" className="h-8 w-full" aria-hidden="true">
        <ellipse cx="30" cy="20" rx="14" ry="8" fill="currentColor" opacity="0.55" />
        <circle cx="42" cy="12" r="6" fill="currentColor" opacity="0.7" />
        <path d="M18 28 l-3 -8 M26 28 l-2 -8 M34 28 l2 -8 M42 28 l3 -8" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 30" className="h-8 w-full" aria-hidden="true">
      <path d="M30 3 l4 10 l10 2 l-10 2 l-4 10 l-4 -10 l-10 -2 l10 -2 Z" fill="currentColor" opacity="0.7" />
    </svg>
  );
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

export function describeCost(cost: string): string {
  const c = parseCost(cost);
  const bits: string[] = [];
  if (c.generic) bits.push(`${c.generic} generic`);
  for (const k of ["W", "U", "B", "R", "G"] as const) if (c[k]) bits.push(`${c[k]} ${COLOR_NAME[k]}`);
  return bits.join(" and ");
}

interface Props {
  card: CardDef;
  perm?: Permanent;
  /** What tapping the card does right now, read by screen readers ("Play this land"). Empty = not tappable now. */
  action?: string | undefined;
  selected?: boolean | undefined;
  /** A visible word for state, e.g. "Attacking" or "Blocks Ghoul". */
  badge?: string | undefined;
  onClick?: (() => void) | undefined;
  size?: "sm" | "md";
}

export function GameCard({ card, perm, action, selected, badge, onClick, size = "md" }: Props) {
  const tapped = perm?.tapped ?? false;
  const w = size === "sm" ? "w-[4.6rem]" : "w-[5.6rem]";
  // Screen readers get the visible card text plus this hidden detail; the name always contains the visible text.
  const detail = describeCard(card, perm).replace(`${card.name}, `, "");
  const srDetail = `, ${detail}${action ? `. ${action}` : ""}`;
  const body = (
    <span
      className={`relative grid ${w} aspect-[5/7] content-start gap-[2px] rounded-md border-2 p-[3px] text-left text-[0.62rem] leading-tight ${FRAME[card.color]} ${
        selected ? "border-focus ring-[3px] ring-focus" : "border-border-strong"
      } ${tapped ? "rotate-6" : ""}`}
    >
      <span className="flex items-start justify-between gap-1 font-bold">
        <span className="truncate">{card.name}</span>
        <CostSymbols cost={card.cost} />
      </span>
      <span className="rounded-sm bg-bg/15 px-1"><Art card={card} /></span>
      <span className="truncate text-[0.56rem] font-bold uppercase tracking-wide opacity-90">{card.kind}{card.keywords?.length ? ` · ${card.keywords.join(", ")}` : ""}</span>
      {card.kind === "instant" && <span className="line-clamp-3 opacity-90">{card.text}</span>}
      {card.kind === "creature" && (
        <span className="absolute bottom-[3px] right-[3px] rounded-sm bg-surface px-1 font-mono text-[0.7rem] font-bold text-text">
          {perm ? power(perm) : card.power}/{perm ? toughness(perm) : card.toughness}
        </span>
      )}
      {perm && perm.damage > 0 && <span className="absolute bottom-[3px] left-[3px] rounded-sm bg-surface px-1 font-mono text-[0.6rem] font-bold text-text">-{perm.damage}</span>}
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
        <span className="max-w-[6rem] rounded-sm bg-surface-2 px-1 text-center text-[0.65rem] font-bold leading-tight">{[tapped ? "Tapped" : null, badge].filter(Boolean).join(" · ")}</span>
      )}
    </span>
  );
}
