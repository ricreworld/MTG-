// The Practice Table's cards. All ORIGINAL, fictional cards (no real names, costs or Oracle text).
// Each follows the card design rules in src/content/README.md: one idea per card, colour-appropriate.

export type Color = "W" | "U" | "B" | "R" | "G";
export type Keyword = "Flying" | "Reach" | "Haste" | "Trample" | "Deathtouch" | "First strike" | "Vigilance" | "Lifelink";

export interface CardDef {
  id: string;
  name: string;
  kind: "land" | "creature" | "instant";
  /** Colour of the mana a land makes, or the card's colour. */
  color: Color;
  /** Mana cost as symbols, e.g. "1R". Lands have none. */
  cost?: string;
  power?: number;
  toughness?: number;
  keywords?: Keyword[];
  /** Instants: what they do. */
  effect?: "pump3" | "damage3" | "counter";
  /** Plain-language rules text, shown on the card. */
  text: string;
}

export const CARDS: Record<string, CardDef> = {
  forest: { id: "forest", name: "Forest", kind: "land", color: "G", text: "Tap: add {G}." },
  mountain: { id: "mountain", name: "Mountain", kind: "land", color: "R", text: "Tap: add {R}." },
  island: { id: "island", name: "Island", kind: "land", color: "U", text: "Tap: add {U}." },
  plains: { id: "plains", name: "Plains", kind: "land", color: "W", text: "Tap: add {W}." },
  swamp: { id: "swamp", name: "Swamp", kind: "land", color: "B", text: "Tap: add {B}." },

  pup: { id: "pup", name: "Emberclaw Pup", kind: "creature", color: "R", cost: "1R", power: 2, toughness: 1, keywords: ["Haste"], text: "Haste" },
  boar: { id: "boar", name: "Mossback Boar", kind: "creature", color: "G", cost: "1G", power: 2, toughness: 2, text: "" },
  viper: { id: "viper", name: "Duskfang Viper", kind: "creature", color: "G", cost: "G", power: 1, toughness: 1, keywords: ["Deathtouch"], text: "Deathtouch" },
  spider: { id: "spider", name: "Canopy Spider", kind: "creature", color: "G", cost: "1G", power: 1, toughness: 3, keywords: ["Reach"], text: "Reach" },
  rhino: { id: "rhino", name: "Thornback Rhino", kind: "creature", color: "G", cost: "2GG", power: 4, toughness: 4, keywords: ["Trample"], text: "Trample" },
  guard: { id: "guard", name: "Village Guard", kind: "creature", color: "W", cost: "1W", power: 2, toughness: 2, text: "" },
  knight: { id: "knight", name: "Sunlit Knight", kind: "creature", color: "W", cost: "2W", power: 2, toughness: 2, keywords: ["First strike", "Lifelink"], text: "First strike, lifelink" },
  bat: { id: "bat", name: "Night Bat", kind: "creature", color: "B", cost: "1B", power: 1, toughness: 1, keywords: ["Flying"], text: "Flying" },
  ghoul: { id: "ghoul", name: "Crypt Ghoul", kind: "creature", color: "B", cost: "2B", power: 3, toughness: 2, text: "" },

  surge: { id: "surge", name: "Wild Surge", kind: "instant", color: "G", cost: "G", effect: "pump3", text: "Target creature gets +3/+3 until end of turn." },
  jolt: { id: "jolt", name: "Spark Jolt", kind: "instant", color: "R", cost: "R", effect: "damage3", text: "Spark Jolt deals 3 damage to any target." },
  denial: { id: "denial", name: "Quick Denial", kind: "instant", color: "U", cost: "UU", effect: "counter", text: "Counter target spell." },
};

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
