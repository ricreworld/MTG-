// The Practice Table's cards: real Magic: The Gathering cards from the Foundations set (FDN),
// used under the Wizards of the Coast Fan Content Policy (free, non-commercial, unofficial).
// Names, costs, type lines, rules text and stats are copied exactly from the official Oracle text
// (via Scryfall, reminder text in parentheses removed). Art crops live in public/art/<id>.jpg.
// Only cards the engine can run exactly as printed are included: basic lands, keyword-only creatures,
// and instants with one simple effect.

export type Color = "W" | "U" | "B" | "R" | "G";
export type Keyword = "Flying" | "Reach" | "Haste" | "Trample" | "Deathtouch" | "First strike" | "Vigilance" | "Lifelink";
export type Effect = "pump3" | "shrink2" | "counter" | "counterNoncreature";

export interface CardDef {
  id: string;
  name: string;
  kind: "land" | "creature" | "instant";
  /** Colour of the mana a land makes, or the card's colour. */
  color: Color;
  /** Mana cost as symbols, e.g. "1R". Lands have none. */
  cost?: string;
  /** The printed type line. */
  type: string;
  power?: number;
  toughness?: number;
  keywords?: Keyword[];
  /** Instants: what they do, as the engine understands it. */
  effect?: Effect;
  /** Official rules text (reminder text removed). */
  text: string;
  /** Illustrator, credited in the app. */
  artist: string;
  /** Collector number in Foundations. */
  num: string;
}

const land = (id: string, name: string, color: Color, artist: string, num: string): CardDef => ({ id, name, kind: "land", color, type: `Basic Land — ${name}`, text: `{T}: Add {${color}}.`, artist, num });

export const CARDS: Record<string, CardDef> = {
  plains: land("plains", "Plains", "W", "Rebecca Guay", "272"),
  island: land("island", "Island", "U", "John Avon", "274"),
  swamp: land("swamp", "Swamp", "B", "Mike Bierek", "276"),
  mountain: land("mountain", "Mountain", "R", "Piotr Dura", "278"),
  forest: land("forest", "Forest", "G", "Rebecca Guay", "280"),

  lions: { id: "lions", name: "Savannah Lions", kind: "creature", color: "W", cost: "W", type: "Creature — Cat", power: 2, toughness: 1, text: "", artist: "Winona Nelson", num: "146" },
  hawk: { id: "hawk", name: "Healer's Hawk", kind: "creature", color: "W", cost: "W", type: "Creature — Bird", power: 1, toughness: 1, keywords: ["Flying", "Lifelink"], text: "Flying\nLifelink", artist: "Milivoj Ćeran", num: "734" },
  soldier: { id: "soldier", name: "Bishop's Soldier", kind: "creature", color: "W", cost: "1W", type: "Creature — Vampire Soldier", power: 2, toughness: 2, keywords: ["Lifelink"], text: "Lifelink", artist: "Scott Murphy", num: "491" },
  skyhunter: { id: "skyhunter", name: "Leonin Skyhunter", kind: "creature", color: "W", cost: "WW", type: "Creature — Cat Knight", power: 2, toughness: 2, keywords: ["Flying"], text: "Flying", artist: "Kev Walker", num: "498" },
  serra: { id: "serra", name: "Serra Angel", kind: "creature", color: "W", cost: "3WW", type: "Creature — Angel", power: 4, toughness: 4, keywords: ["Flying", "Vigilance"], text: "Flying\nVigilance", artist: "Greg Staples", num: "740" },
  turtle: { id: "turtle", name: "Aegis Turtle", kind: "creature", color: "U", cost: "U", type: "Creature — Turtle", power: 0, toughness: 5, text: "", artist: "Milivoj Ćeran", num: "150" },
  nighthawk: { id: "nighthawk", name: "Vampire Nighthawk", kind: "creature", color: "B", cost: "1BB", type: "Creature — Vampire Shaman", power: 2, toughness: 3, keywords: ["Flying", "Deathtouch", "Lifelink"], text: "Flying\nDeathtouch\nLifelink", artist: "Jason Chan", num: "757" },
  vampire: { id: "vampire", name: "Highborn Vampire", kind: "creature", color: "B", cost: "3B", type: "Creature — Vampire Warrior", power: 4, toughness: 3, text: "", artist: "Denman Rooke", num: "522" },
  goblin: { id: "goblin", name: "Swab Goblin", kind: "creature", color: "R", cost: "1R", type: "Creature — Goblin Pirate", power: 2, toughness: 2, text: "", artist: "Josu Hernaiz", num: "548" },
  scourge: { id: "scourge", name: "Brazen Scourge", kind: "creature", color: "R", cost: "1RR", type: "Creature — Gremlin", power: 3, toughness: 3, keywords: ["Haste"], text: "Haste", artist: "Kev Walker", num: "191" },
  giant: { id: "giant", name: "Skyraker Giant", kind: "creature", color: "R", cost: "2RR", type: "Creature — Giant", power: 4, toughness: 3, keywords: ["Reach"], text: "Reach", artist: "Anastasia Ovchinnikova", num: "547" },
  elemental: { id: "elemental", name: "Fire Elemental", kind: "creature", color: "R", cost: "3RR", type: "Creature — Elemental", power: 5, toughness: 4, text: "", artist: "Joe Slucher", num: "538" },
  cub: { id: "cub", name: "Bear Cub", kind: "creature", color: "G", cost: "1G", type: "Creature — Bear", power: 2, toughness: 2, text: "", artist: "Ron Spencer", num: "552" },
  archer: { id: "archer", name: "Thornweald Archer", kind: "creature", color: "G", cost: "1G", type: "Creature — Elf Archer", power: 2, toughness: 1, keywords: ["Reach", "Deathtouch"], text: "Reach\nDeathtouch", artist: "Dave Kendall", num: "559" },
  sentry: { id: "sentry", name: "Magnigoth Sentry", kind: "creature", color: "G", cost: "3G", type: "Creature — Treefolk", power: 4, toughness: 4, keywords: ["Reach"], text: "Reach", artist: "Dave Kendall", num: "556" },
  pathwarden: { id: "pathwarden", name: "Tajuru Pathwarden", kind: "creature", color: "G", cost: "4G", type: "Creature — Elf Warrior Ally", power: 5, toughness: 4, keywords: ["Vigilance", "Trample"], text: "Vigilance\nTrample", artist: "Victor Adame Minguez", num: "558" },

  growth: { id: "growth", name: "Giant Growth", kind: "instant", color: "G", cost: "G", type: "Instant", effect: "pump3", text: "Target creature gets +3/+3 until end of turn.", artist: "Matt Cavotta", num: "223" },
  stab: { id: "stab", name: "Stab", kind: "instant", color: "B", cost: "B", type: "Instant", effect: "shrink2", text: "Target creature gets -2/-2 until end of turn.", artist: "Milivoj Ćeran", num: "71" },
  negate: { id: "negate", name: "Negate", kind: "instant", color: "U", cost: "1U", type: "Instant", effect: "counterNoncreature", text: "Counter target noncreature spell.", artist: "Magali Villeneuve", num: "710" },
  cancel: { id: "cancel", name: "Cancel", kind: "instant", color: "U", cost: "1UU", type: "Instant", effect: "counter", text: "Counter target spell.", artist: "Mathias Kollros", num: "505" },
};

/** Where a card's official art crop lives (bundled with the app, so it works offline). */
export const artUrl = (id: string): string => `./art/${id}.jpg`;

export const COLOR_NAME: Record<Color, string> = { W: "white", U: "blue", B: "black", R: "red", G: "green" };

/** Parses a cost like "2GG" into { generic: 2, G: 2 }. */
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
  return c.generic + (["W", "U", "B", "R", "G"] as Color[]).reduce((n, k) => n + (c[k] ?? 0), 0);
}
