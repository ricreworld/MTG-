// A card from the Commander pool, laid out like a real card: name bar, art with the cost, type line,
// rules text, power/toughness. One colour fills the frame; two colours split it; colourless is grey.
// Tokens have no official art, so they show a plain coloured panel. The frame is ours; the art is the
// official Wizards of the Coast illustration (Fan Content Policy).
import { ManaSymbol, type ManaColor } from "../../components/ManaSymbol";
import { cardArt, COLOR_WORD, keywordsOf, parseCost, type CDef, type Color } from "../../game/commander/cards";
import { power, toughness, type CState, type Perm } from "../../game/commander/engine";

const FRAME: Record<string, string> = {
  W: "bg-mtg-white text-mtg-white-ink", U: "bg-mtg-blue text-mtg-blue-ink", B: "bg-mtg-black text-mtg-black-ink", R: "bg-mtg-red text-mtg-red-ink", G: "bg-mtg-green text-mtg-green-ink",
};
const FROM: Record<string, string> = { W: "from-mtg-white", U: "from-mtg-blue", B: "from-mtg-black", R: "from-mtg-red", G: "from-mtg-green" };
const TO: Record<string, string> = { W: "to-mtg-white", U: "to-mtg-blue", B: "to-mtg-black", R: "to-mtg-red", G: "to-mtg-green" };

export function frameClass(colors: string): string {
  if (colors.length === 1) return FRAME[colors]!;
  if (colors.length >= 2) return `bg-gradient-to-r ${FROM[colors[0]!]} ${TO[colors[1]!]} text-text`;
  return "bg-mtg-colorless text-mtg-colorless-ink";
}

function CostSymbols({ cost, size }: { cost: string; size: number }) {
  if (!cost) return null;
  const parts = cost.match(/\d+|[WUBRG]/g) ?? [];
  return (
    <span className="inline-flex shrink-0 gap-[1px]">
      {parts.map((p, i) => /\d/.test(p)
        ? <span key={i} role="img" aria-label={`${p} generic mana`} style={{ width: `${size}rem`, height: `${size}rem` }} className="inline-grid place-items-center rounded-full bg-mtg-colorless font-mono text-[0.7em] font-bold text-mtg-colorless-ink">{p}</span>
        : <ManaSymbol key={i} color={p as ManaColor} size={size} />)}
    </span>
  );
}

export function describeCost(cost: string): string {
  const c = parseCost(cost);
  const bits: string[] = [];
  if (c.generic) bits.push(`${c.generic} generic`);
  for (const k of ["W", "U", "B", "R", "G"] as Color[]) if (c[k]) bits.push(`${c[k]} ${COLOR_WORD[k]}`);
  return bits.join(" and ") || "nothing";
}

export function describeCCard(card: CDef, s?: CState, perm?: Perm): string {
  const parts = [card.name];
  if (card.cost) parts.push(`costs ${describeCost(card.cost)}`);
  parts.push(card.type);
  if (card.kind === "creature") parts.push(s && perm ? `${power(s, perm)} power, ${toughness(s, perm)} toughness` : `${card.power} power, ${card.toughness} toughness`);
  if (card.text) parts.push(card.text.replace(/\n/g, ". "));
  if (perm?.tapped) parts.push("tapped");
  if (perm?.summoningSick && card.kind === "creature" && !keywordsOf(card).includes("Haste")) parts.push("arrived this turn");
  if (perm && perm.damage > 0) parts.push(`${perm.damage} damage marked`);
  if (perm && perm.counters > 0) parts.push(`${perm.counters} +1/+1 counters`);
  if (perm?.isCommander) parts.push("commander");
  if (card.artist) parts.push(`art by ${card.artist}`);
  return parts.join(", ");
}

interface Props {
  card: CDef;
  state?: CState | undefined;
  perm?: Perm | undefined;
  action?: string | undefined;
  selected?: boolean | undefined;
  badge?: string | undefined;
  onClick?: (() => void) | undefined;
  size?: "sm" | "md" | "lg";
  highlight?: string | undefined;
}

export function CommanderCard({ card, state, perm, action, selected, badge, onClick, size = "md", highlight }: Props) {
  const tapped = perm?.tapped ?? false;
  const sm = size === "sm", lg = size === "lg";
  const dims = sm ? "w-[4.8rem] text-[0.55rem]" : lg ? "w-[15rem] text-[1rem]" : "w-[6.6rem] text-[0.62rem]";
  const srDetail = `, ${describeCCard(card, state, perm).replace(`${card.name}, `, "")}${action ? `. ${action}` : ""}`;
  const pt = card.kind === "creature" ? `${state && perm ? power(state, perm) : card.power}/${state && perm ? toughness(state, perm) : card.toughness}` : null;
  const rules = card.text.replace(/\{T\}/g, "Tap");
  const body = (
    <span className={`relative grid ${dims} aspect-[5/7] grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto_auto] gap-[2px] rounded-[0.45rem] border-[3px] p-[3px] text-left leading-tight ${frameClass(card.colors)} ${selected ? "border-focus ring-[3px] ring-focus" : highlight ? "border-accent ring-[3px] ring-accent" : "border-border-strong"} ${tapped ? "rotate-6" : ""}`}>
      <span className="min-w-0 rounded-[3px] bg-surface px-1 py-[2px] font-bold leading-[1.1] text-text">{card.name}</span>
      <span className="relative min-h-0 overflow-hidden rounded-[3px] border border-border-strong bg-bg/20">
        {card.token ? <span className="grid h-full w-full place-items-center bg-surface text-center font-bold text-text">{card.name}<br />token</span> : <img src={cardArt(card.id)} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />}
        {card.cost && <span className="absolute right-[1px] top-[1px] rounded-full bg-surface p-[1px]"><CostSymbols cost={card.cost} size={sm ? 0.75 : lg ? 1.4 : 0.85} /></span>}
      </span>
      <span className="truncate rounded-[3px] bg-surface px-1 py-[1px] text-[0.9em] font-bold text-text">{card.type}</span>
      <span className={`${sm ? "min-h-[1.4em]" : "min-h-[2.6em]"} ${lg ? "whitespace-pre-line" : ""} rounded-[3px] bg-surface px-1 py-[2px] text-text`}>
        <span className={lg ? "" : "line-clamp-3"}>{rules || " "}</span>
      </span>
      {pt && <span className="absolute bottom-[-3px] right-[-3px] rounded-[4px] border-[2px] border-border-strong bg-surface px-1 font-mono text-[0.95em] font-bold text-text">{pt}</span>}
      {perm && perm.damage > 0 && <span className="absolute bottom-[-3px] left-[-3px] rounded-[4px] border-[2px] border-border-strong bg-surface px-1 font-mono text-[0.85em] font-bold text-text">−{perm.damage}</span>}
      {perm && perm.counters > 0 && <span className="absolute left-[-3px] top-[1.3em] rounded-[4px] border-[2px] border-border-strong bg-surface px-1 font-mono text-[0.8em] font-bold text-text">+{perm.counters}</span>}
    </span>
  );
  return (
    <span className="grid justify-items-center gap-1">
      {onClick ? <button type="button" onClick={onClick} aria-pressed={selected} className="rounded-md">{body}<span className="sr-only">{srDetail}</span></button> : <span>{body}<span className="sr-only">{srDetail}</span></span>}
      {highlight && !badge && !tapped && <span className="max-w-[7rem] rounded-sm bg-accent px-1 text-center text-[0.65rem] font-bold leading-tight text-accent-ink">{highlight}</span>}
      {(badge || tapped) && <span className="max-w-[7rem] rounded-sm bg-surface-2 px-1 text-center text-[0.65rem] font-bold leading-tight text-text">{[tapped ? "Tapped" : null, badge].filter(Boolean).join(", ")}</span>}
    </span>
  );
}
