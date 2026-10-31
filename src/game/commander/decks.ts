// Four honest 100-card Commander decks built from the compiled Foundations pool: one commander,
// 99 other cards, no card twice except basic lands (CR 903.5a-b), every card inside the commander's
// colour identity (CR 903.5c). The build is deterministic, so the same decks appear every time.
import { CARD_LIST, CCARDS, fitsIdentity, isBasicLand, manaValue, type CDef } from "./cards";

export interface CDeck {
  id: string;
  name: string;
  commander: string;
  identity: string;
  /** How the deck wants to play, in one plain sentence. */
  style: string;
  /** 99 card ids (basic lands may repeat). */
  cards: string[];
}

const BASIC: Record<string, string> = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };
const byName = (name: string): CDef => { const c = CARD_LIST.find((x) => x.name === name); if (!c) throw new Error(`No card named ${name}`); return c; };

function build(id: string, name: string, commanderName: string, style: string, excludeCommanders: string[]): CDeck {
  const commander = byName(commanderName);
  const identity = commander.colors;
  const pool = CARD_LIST.filter((c) => c.id !== commander.id && fitsIdentity(c, identity) && !excludeCommanders.includes(c.name));
  const nonland = pool.filter((c) => c.kind !== "land").sort((a, b) => manaValue(a.cost) - manaValue(b.cost) || a.name.localeCompare(b.name));
  // Keep the curve sane: at most ~8 cards of mana value 6+, and all the cheap ones.
  const big = nonland.filter((c) => manaValue(c.cost) >= 6).slice(0, 8);
  const rest = nonland.filter((c) => manaValue(c.cost) < 6);
  const spells = [...rest, ...big].slice(0, 63);
  const nonbasicLands = pool.filter((c) => c.kind === "land" && !isBasicLand(c) && (c.colors === "" ? true : fitsIdentity(c, identity))).filter((c) => c.name !== "Evolving Wilds" || identity.length > 1).slice(0, identity.length > 1 ? 8 : 3);
  const landsNeeded = 99 - spells.length;
  const basicsNeeded = landsNeeded - nonbasicLands.length;
  const colors = identity ? [...identity] : ["W"];
  const basics: string[] = [];
  for (let i = 0; i < basicsNeeded; i++) basics.push(byName(BASIC[colors[i % colors.length]!]!).id);
  const cards = [...spells.map((c) => c.id), ...nonbasicLands.map((c) => c.id), ...basics];
  if (cards.length !== 99) throw new Error(`${name}: ${cards.length} cards`);
  return { id, name, commander: commander.id, identity, style, cards };
}

const LEADERS = ["Lyra Dawnbringer", "Balmor, Battlemage Captain", "Ruby, Daring Tracker", "Tatyova, Benthic Druid"];

export const CDECKS: CDeck[] = [
  build("angels", "Dawn Chorus", "Lyra Dawnbringer", "White: angels, cats and soldiers that gain life and grow together.", LEADERS),
  build("storm", "Spell Storm", "Balmor, Battlemage Captain", "Blue and red: cheap spells, flyers that grow when you cast, and counterspells.", LEADERS),
  build("stampede", "Stampede", "Ruby, Daring Tracker", "Red and green: big creatures, extra mana, and attacks that trample over.", LEADERS),
  build("tide", "Rising Tide", "Tatyova, Benthic Druid", "Green and blue: lands that draw cards, growth, and bounce.", LEADERS),
];

export const cdeckById = (id: string): CDeck | undefined => CDECKS.find((d) => d.id === id);
export const deckSummary = (d: CDeck): { lands: number; creatures: number; other: number } => {
  let lands = 0, creatures = 0, other = 0;
  for (const id of d.cards) { const k = CCARDS[id]?.kind; if (k === "land") lands++; else if (k === "creature") creatures++; else other++; }
  return { lands, creatures, other };
};
