// The four-player Commander table's card pool: every Foundations card the compiler
// (tools/compile-cards.py) could express exactly as printed, loaded from cards.generated.json.
// Each card carries its official name, cost, type line, rules text, artist and collector number,
// plus `abilities`: a small structured form of its rules text that engine.ts interprets.
// Used under the Wizards of the Coast Fan Content Policy (free, non-commercial, unofficial).
import raw from "../cards.generated.json";
import bundledArt from "../art-bundled.json";

export type Color = "W" | "U" | "B" | "R" | "G";
export const COLORS: Color[] = ["W", "U", "B", "R", "G"];
export const COLOR_WORD: Record<Color, string> = { W: "white", U: "blue", B: "black", R: "red", G: "green" };

export type Kind = "land" | "creature" | "instant" | "sorcery" | "enchantment" | "artifact";

export interface Effect {
  op: string;
  target?: string;
  target2?: string;
  who?: string;
  filter?: string;
  n?: number;
  p?: number;
  t?: number;
  keywords?: string[];
  effects?: Effect[];
  if?: string;
  optional?: boolean;
  per?: string;
  perAttacking?: boolean;
  cond?: { toughnessAtLeast?: number; powerAtLeast?: number; colors?: string };
  what?: string;
  maxMv?: number;
  color?: string;
  subtype?: string;
  subtypes?: string[];
  artifact?: string;
  colors?: string[];
  payOptional?: string;
  then?: Effect[];
  ifNot?: string;
  basic?: boolean;
  basicType?: string;
  sameType?: boolean;
  chosenType?: boolean;
  monarchAlt?: { p: number; t: number; color: string; subtype: string; keywords: string[] };
  cost?: string;
  minMv?: number;
  toHand?: boolean;
  name?: string;
  rider?: string;
  maxPer?: string;
}

export interface AbilityCost { tap?: boolean; mana?: string; sacrificeSelf?: boolean; sacrificeCreature?: "any" | "another"; life?: number }

export interface Ability {
  kind: "keyword" | "static" | "triggered" | "activated" | "spell" | "enchant" | "equip" | "entersTapped" | "protection" | "cycling" | "chooseType" | "modal" | "embalm" | "noteLife" | "altCost";
  /** altCost: "You may pay {W} and tap four untapped creatures with flying rather than pay this spell's mana cost." */
  mana?: string;
  tapCreatures?: { n: number; keyword: string };
  /** costLess by several subtypes, per +1/+1 counter on the holder. */
  subtypes?: string[];
  perCounter?: boolean;
  per?: string;
  /** protection: the qualities it protects from, e.g. ["Demons", "Dragons"], ["white"], ["the chosen card type"]. */
  from?: string[];
  /** entersTapped: unless you control a land of this basic type. */
  unless?: string;
  /** modal: how many modes to choose, and the modes. */
  choices?: Effect[][];
  subtype2?: string;
  color?: string;
  /** keyword */
  name?: string;
  /** static */
  op?: string;
  filter?: { subtype?: string; other?: boolean; flying?: boolean; namedCounter?: string; anyPermanent?: boolean };
  p?: number;
  t?: number;
  keywords?: string[];
  cond?: string;
  what?: string;
  n?: number;
  pacify?: boolean;
  /** triggered */
  when?: string;
  subtype?: string;
  /** triggered, activated, spell */
  effects?: Effect[];
  /** activated: cost object; equip: cost string */
  cost?: AbilityCost | string;
  restriction?: string;
  /** spell: paid on casting, e.g. { discard: 1 } or { sacrificeCreature: "any" }. */
  additionalCost?: { discard?: number; sacrificeCreature?: "any" | "another" };
}

export interface CDef {
  id: string;
  name: string;
  kind: Kind;
  type: string;
  cost: string;
  /** Colour identity letters, e.g. "GW"; "" for colourless. */
  colors: string;
  text: string;
  artist: string;
  num: string;
  rarity: string;
  legendary: boolean;
  abilities: Ability[];
  power?: number;
  toughness?: number;
  /** True for tokens the engine created during a game. */
  token?: boolean;
  /** Set code of the printing, e.g. "fdn". */
  set?: string;
  /** EDHREC popularity rank (lower is more played); 0 when unknown. */
  rank?: number;
}

interface RawCard { id: string; name: string; kind: string; type: string; cost: string; colors: string; text: string; artist: string; num: string; rarity: string; legendary: boolean; abilities: Record<string, unknown>[]; power?: string; toughness?: string; set?: string; rank?: number }

/** Older compiler output spelled two statics as their own kinds; fold them into "static". */
function normaliseAbility(a: Record<string, unknown>): Ability {
  const kind = a.kind as string;
  if (kind === "auraStatic" || kind === "equipStatic") return { ...(a as unknown as Ability), kind: "static", op: kind };
  return a as unknown as Ability;
}

export const CCARDS: Record<string, CDef> = Object.fromEntries(
  (raw as RawCard[]).map((c) => {
    const d: CDef = {
      id: c.id, name: c.name, kind: c.kind as Kind, type: c.type, cost: c.cost ?? "", colors: c.colors ?? "", text: c.text, artist: c.artist, num: c.num, rarity: c.rarity,
      legendary: !!c.legendary, abilities: c.abilities.map(normaliseAbility), set: c.set ?? "", rank: c.rank ?? 0,
    };
    if (c.power !== undefined) d.power = Number(c.power) || 0;
    if (c.toughness !== undefined) d.toughness = Number(c.toughness) || 0;
    return [c.id, d];
  }),
);

export const CARD_LIST: CDef[] = Object.values(CCARDS).sort((a, b) => Number(a.num) - Number(b.num));

/** Art crops for the Foundations cards are bundled (offline); every other card's art comes from Scryfall when online. */
const BUNDLED_ART = new Set<string>(bundledArt as string[]);
export const cardArt = (id: string): string => (BUNDLED_ART.has(id) ? `./art/${id}.jpg` : `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`);

/** Parses "2GG" into { generic: 2, G: 2 }. */
export function parseCost(cost: string | undefined): { generic: number } & Partial<Record<Color, number>> {
  const out: { generic: number } & Partial<Record<Color, number>> = { generic: 0 };
  for (const sym of (cost ?? "").match(/\d+|[WUBRG]/g) ?? []) {
    if (/\d/.test(sym)) out.generic += Number(sym);
    else out[sym as Color] = (out[sym as Color] ?? 0) + 1;
  }
  return out;
}

export function manaValue(cost: string | undefined): number {
  const c = parseCost(cost);
  return c.generic + COLORS.reduce((n, k) => n + (c[k] ?? 0), 0);
}

export const keywordsOf = (d: CDef): string[] => d.abilities.filter((a) => a.kind === "keyword").map((a) => a.name ?? "");
export const isBasicLand = (d: CDef): boolean => d.type.startsWith("Basic Land");
export const subtypesOf = (d: CDef): string[] => (d.type.split("—")[1] ?? "").trim().split(/\s+/).filter(Boolean);
export const isAura = (d: CDef): boolean => d.abilities.some((a) => a.kind === "enchant");
export const isEquipment = (d: CDef): boolean => d.abilities.some((a) => a.kind === "equip");
export const hasFlash = (d: CDef): boolean => keywordsOf(d).includes("Flash");
/** Legendary creatures that can lead a deck, with their colour identity. */
export const COMMANDERS: CDef[] = CARD_LIST.filter((c) => c.kind === "creature" && c.legendary);
/** The colour identity (letters) of a card. */
export const identity = (d: CDef): string => d.colors;
/** True when a card may go in a deck led by a commander with this identity. */
export const fitsIdentity = (d: CDef, id: string): boolean => [...d.colors].every((c) => id.includes(c));
