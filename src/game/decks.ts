// Ready-made decks for free play, built only from the playable Foundations cards in cards.ts.
// They're 30 cards (12-14 lands, 16-18 spells) so a learning game stays short. Real Standard decks
// have at least 60 cards (CR 100.2a); the deck picker says so.
import { CARDS, type Color } from "./cards";

export interface Deck {
  id: string;
  name: string;
  colors: Color[];
  /** The play style, in the colour pie's words. */
  style: string;
  /** One or two plain sentences on how to play it. */
  howToPlay: string;
  /** Card id -> number of copies. */
  cards: Record<string, number>;
}

export const DECKS: Deck[] = [
  {
    id: "white-legion",
    name: "Sunlit Legion",
    colors: ["W"],
    style: "Go wide: lots of small creatures, some with Flying and Lifelink.",
    howToPlay: "Play a creature every turn and attack with the ones that are safe. Lifelink creatures gain you life while they fight.",
    cards: { plains: 12, lions: 4, hawk: 4, soldier: 4, skyhunter: 3, serra: 3 },
  },
  {
    id: "blue-white-sky",
    name: "Sky Watch",
    colors: ["W", "U"],
    style: "Control: flyers, a wall, and counterspells to say no.",
    howToPlay: "Keep Islands untapped when you can, so Negate or Cancel is ready for your opponent's best spell. Win in the air with flyers.",
    cards: { plains: 7, island: 6, turtle: 3, hawk: 3, skyhunter: 3, serra: 3, negate: 3, cancel: 2 },
  },
  {
    id: "black-red-blood",
    name: "Blood and Fire",
    colors: ["B", "R"],
    style: "Midrange: strong creatures and a removal spell.",
    howToPlay: "Use Stab to destroy a small creature, then attack with Vampires and Goblins. Brazen Scourge can attack the turn it arrives.",
    cards: { swamp: 7, mountain: 6, nighthawk: 3, vampire: 3, stab: 3, goblin: 3, scourge: 3, giant: 2 },
  },
  {
    id: "red-fire",
    name: "Fast Fire",
    colors: ["R"],
    style: "Aggro: attack early and often.",
    howToPlay: "Curve out: a two-drop, then a three-drop, then keep attacking. Skyraker Giant and Fire Elemental finish the job.",
    cards: { mountain: 14, goblin: 4, scourge: 4, giant: 4, elemental: 4 },
  },
  {
    id: "green-growth",
    name: "Wild Growth",
    colors: ["G"],
    style: "Big creatures with Reach and Trample, plus a combat trick.",
    howToPlay: "Your creatures are bigger than most. Block with Reach creatures, attack with Trample, and save Giant Growth for a fight you want to win.",
    cards: { forest: 12, cub: 4, archer: 4, sentry: 4, pathwarden: 3, growth: 3 },
  },
];

export const deckById = (id: string): Deck | undefined => DECKS.find((d) => d.id === id);

export const deckSize = (d: Deck): number => Object.values(d.cards).reduce((n, c) => n + c, 0);

/** The deck as a flat list of card ids (unshuffled). */
export function deckList(d: Deck): string[] {
  const out: string[] = [];
  for (const [id, n] of Object.entries(d.cards)) {
    if (!CARDS[id]) throw new Error(`Deck ${d.id} uses unknown card ${id}`);
    for (let i = 0; i < n; i++) out.push(id);
  }
  return out;
}

/** Small seeded random generator (mulberry32), so a game can be replayed in tests. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
