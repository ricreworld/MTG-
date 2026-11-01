// Four honest 100-card Commander decks built from the compiled Foundations pool: one commander, 99 other
// cards, no card twice except basic lands (CR 903.5a-b), every card inside the commander's colour identity
// (CR 903.5c). The builder follows the deck-building method from the claude-mtg-skills kit: fill the
// structural roles first (lands, ramp, card advantage, interaction, board wipes), keep the curve sane
// (few cards at mana value 6+), then prefer cards with the most "points of contact" with the commander's
// plan. The build is deterministic, so the same decks appear every time. The pool is what it is: a
// 245-card Foundations pool can't always reach every target, and the deck doctor says so honestly.
import { classify, type LibraryCard, type Role } from "../deckcheck";
import { CARD_LIST, CCARDS, fitsIdentity, isBasicLand, manaValue, subtypesOf, type CDef } from "./cards";

export interface Primer { wins: string; early: string; mid: string; late: string; misplays: string }

export interface CDeck {
  id: string;
  name: string;
  commander: string;
  identity: string;
  /** "starter": Foundations only (art bundled); "full": built from every playable card. */
  pool: "starter" | "full";
  /** How the deck wants to play, in one plain sentence. */
  style: string;
  /** 99 card ids (basic lands may repeat). */
  cards: string[];
  primer: Primer;
}

const BASIC: Record<string, string> = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };
const byName = (name: string): CDef => { const c = CARD_LIST.find((x) => x.name === name); if (!c) throw new Error(`No card named ${name}`); return c; };

/** The compiled card in the shape the deck doctor reads. */
export const toLibraryCard = (d: CDef): LibraryCard => ({
  id: d.id, name: d.name, type: d.type, text: d.text, rarity: d.rarity,
  cost: (d.cost.match(/\d+|[WUBRG]/g) ?? []).map((s) => `{${s}}`).join(""),
  ...(d.kind === "creature" ? { pt: `${d.power ?? 0}/${d.toughness ?? 0}` } : {}),
});

/** What the commander cares about: subtypes, keywords, and ability shapes. Each hit is one point of contact. */
interface Vocabulary { subtypes: string[]; keywords: string[]; textHits: RegExp[]; kinds: string[]; bigPower?: boolean; lands?: boolean }

function contacts(d: CDef, v: Vocabulary): number {
  let n = 0;
  const subs = subtypesOf(d);
  if (v.subtypes.some((s) => subs.includes(s))) n++;
  if (v.keywords.some((k) => d.abilities.some((a) => a.kind === "keyword" && a.name === k))) n++;
  for (const re of v.textHits) if (re.test(d.text)) n++;
  if (v.kinds.includes(d.kind)) n++;
  if (v.bigPower && (d.power ?? 0) >= 4) n++;
  if (v.lands && d.kind === "land") n++;
  return n;
}

const QUOTAS: { role: Role; n: number }[] = [{ role: "ramp", n: 10 }, { role: "draw", n: 12 }, { role: "wipe", n: 2 }, { role: "removal", n: 9 }, { role: "finisher", n: 5 }];

/** What a commander cares about, read from its own text: creature types, keywords, the things it triggers on. */
export function autoVocabulary(commander: CDef): Vocabulary {
  const t = commander.text;
  const hits: RegExp[] = [];
  if (/gain life|lifelink|life total/i.test(t)) hits.push(/gain \d+ life|whenever you gain life|lifelink/i);
  if (/instant or sorcery|noncreature spell/i.test(t)) hits.push(/whenever you cast (an instant or sorcery|a noncreature) spell/i, /instant and sorcery spells you cast cost/i);
  if (/landfall|a land you control enters|additional land/i.test(t)) hits.push(/landfall|whenever a land/i, /search your library for .*land/i);
  if (/\+1\/\+1 counter/i.test(t)) hits.push(/\+1\/\+1 counter/);
  if (/token/i.test(t)) hits.push(/create .* token/i);
  if (/draw a card|whenever you draw/i.test(t)) hits.push(/draw a card/i);
  if (/dies|sacrifice/i.test(t)) hits.push(/whenever .* dies|sacrifice/i);
  if (/enters/i.test(t) && /another creature/i.test(t)) hits.push(/when this creature enters/i);
  const kinds: string[] = /instant or sorcery|noncreature spell/i.test(t) ? ["instant", "sorcery"] : [];
  return { subtypes: subtypesOf(commander).filter((x) => !["Legendary"].includes(x)), keywords: commander.abilities.filter((a) => a.kind === "keyword").map((a) => a.name ?? ""), textHits: hits, kinds, ...(/power 4 or greater/i.test(t) ? { bigPower: true } : {}), ...(/landfall|a land you control enters/i.test(t) ? { lands: true } : {}) };
}

function build(id: string, name: string, commanderName: string, style: string, vocab: Vocabulary, excludeCommanders: string[], primer: Primer, poolKind: "starter" | "full" = "starter"): CDeck {
  const commander = byName(commanderName);
  const identity = commander.colors;
  // Starter decks are built from Foundations only: their art is bundled for offline play and their primers describe them.
  const pool = CARD_LIST.filter((c) => (poolKind === "full" || c.set === "fdn") && c.id !== commander.id && fitsIdentity(c, identity) && !excludeCommanders.includes(c.name) && !(poolKind === "full" && c.kind === "creature" && c.legendary && (c.rank ?? 0) < 1500 && false));
  const roleOf = new Map<string, Role[]>(pool.map((c) => [c.id, classify(toLibraryCard(c))]));
  // Points of contact first; among equals, the most-played card (EDHREC rank) and the cheaper one.
  const score = (c: CDef) => contacts(c, vocab) * 3 - manaValue(c.cost) * 0.25 + (c.kind === "creature" ? 0.5 : 0) + (poolKind === "full" && c.rank ? Math.max(0, 2 - Math.log10(c.rank) * 0.5) : 0);
  const nonland = pool.filter((c) => c.kind !== "land").sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  const chosen: CDef[] = [];
  const taken = new Set<string>();
  let big = 0;
  const take = (c: CDef) => { if (taken.has(c.id)) return; if (manaValue(c.cost) >= 6) { if (big >= 5) return; big++; } taken.add(c.id); chosen.push(c); };
  // 1. Structural roles first, best synergy inside each role.
  for (const q of QUOTAS) {
    let have = chosen.filter((c) => roleOf.get(c.id)?.includes(q.role)).length;
    for (const c of nonland) { if (have >= q.n) break; if (roleOf.get(c.id)?.includes(q.role) && !taken.has(c.id)) { take(c); have++; } }
  }
  // 2. Then the densest synergy cards until 62 nonland cards.
  for (const c of nonland) { if (chosen.length >= 62) break; take(c); }
  const spells = chosen.slice(0, 62);
  // 3. 37 lands: the nonbasics in identity, then basics split by the deck's colour needs.
  const nonbasic = pool.filter((c) => c.kind === "land" && !isBasicLand(c) && (c.colors === "" ? identity.length > 1 || c.name !== "Evolving Wilds" : true)).slice(0, identity.length > 1 ? 9 : 4);
  const landsNeeded = 99 - spells.length;
  const basicsNeeded = landsNeeded - nonbasic.length;
  const colors = identity ? [...identity] : ["W"];
  const weight = colors.map((col) => spells.reduce((n, c) => n + (c.cost.split(col).length - 1), 0) || 1);
  const totalWeight = weight.reduce((a, b) => a + b, 0);
  const basics: string[] = [];
  const counts = colors.map((_, i) => Math.round((basicsNeeded * weight[i]!) / totalWeight));
  while (counts.reduce((a, b) => a + b, 0) > basicsNeeded) counts[counts.indexOf(Math.max(...counts))]! -= 1;
  while (counts.reduce((a, b) => a + b, 0) < basicsNeeded) counts[counts.indexOf(Math.min(...counts))]! += 1;
  colors.forEach((col, i) => { for (let k = 0; k < counts[i]!; k++) basics.push(byName(BASIC[col]!).id); });
  const cards = [...spells.map((c) => c.id), ...nonbasic.map((c) => c.id), ...basics];
  if (cards.length !== 99) throw new Error(`${name}: ${cards.length} cards`);
  return { id, name, commander: commander.id, identity, pool: poolKind, style, cards, primer };
}

const LEADERS = ["Lyra Dawnbringer", "Balmor, Battlemage Captain", "Ruby, Daring Tracker", "Tatyova, Benthic Druid"];

export const CDECKS: CDeck[] = [
  build("angels", "Dawn Chorus", "Lyra Dawnbringer", "White: angels, cats and soldiers that gain life and grow together.",
    { subtypes: ["Angel", "Cat"], keywords: ["Flying", "Lifelink"], textHits: [/gain \d+ life|whenever you gain life|lifelink/i, /\+1\/\+1 counter/], kinds: [] }, LEADERS,
    { wins: "Combat in the air. Lyra gives every other Angel +1/+1 and lifelink, so a few flyers hit hard while your life climbs out of reach. Life-gain triggers (Ajani's Pridemate style) turn each hit into +1/+1 counters.", early: "Play a land every turn and a cheap creature or a mana rock. Keep a hand with three or four lands.", mid: "Cast Lyra when you have five mana and protect her: she is the engine. Attack the player with the fewest flyers.", late: "Swing with everything evasive; use a board wipe only when you are behind on the ground, since your flyers often survive the race anyway.", misplays: "Casting Lyra into open blue mana with a counterspell waiting, and attacking the strongest player just because they sit next to you." }),
  build("storm", "Spell Storm", "Balmor, Battlemage Captain", "Blue and red: cheap spells, flyers that grow when you cast, and counterspells.",
    { subtypes: ["Wizard"], keywords: ["Flying", "Prowess"], textHits: [/whenever you cast (an instant or sorcery|a noncreature) spell/i, /instant and sorcery spells you cast cost/i], kinds: ["instant", "sorcery"] }, LEADERS,
    { wins: "Many small spells in one turn. Each instant or sorcery gives your whole team +1/+0 and trample through Balmor, and prowess creatures grow with every spell. Draw spells keep the chain going.", early: "Lands, then Balmor on turn two. Cast cheap draw spells to find more lands and keep your hand full.", mid: "Build a board of two or three evasive creatures, then spend a turn casting three or four spells before combat.", late: "Hold a counterspell for the one spell that would end the game, usually a board wipe or a commander.", misplays: "Casting spells on other players' turns when they would have pumped your attackers on yours." }),
  build("stampede", "Stampede", "Ruby, Daring Tracker", "Red and green: big creatures, extra mana, and attacks that trample over.",
    { subtypes: ["Elf", "Dragon"], keywords: ["Trample", "Haste"], textHits: [/power 4 or greater/i, /add \{/i, /trample/i], kinds: [], bigPower: true }, LEADERS,
    { wins: "Big creatures attacking. Ruby taps for mana early and grows when you control a creature with power 4 or more, which this deck has plenty of. Trample pushes damage through chump blocks.", early: "Ruby on turn two is also a mana creature: use her to reach four and five mana a turn early.", mid: "One big creature a turn. Attack the player who has the fewest blockers, not the one with the most life.", late: "Overrun effects and trample close games; keep one creature home if two opponents can swing back.", misplays: "Attacking Ruby into a bigger blocker before you have a creature with power 4, and running out of cards: cast your draw spells." }),
  build("tide", "Rising Tide", "Tatyova, Benthic Druid", "Green and blue: lands that draw cards, growth, and bounce.",
    { subtypes: ["Merfolk", "Elf"], keywords: ["Flying"], textHits: [/landfall|whenever a land/i, /search your library for .*land/i, /draw/i], kinds: [], lands: true }, LEADERS,
    { wins: "Card advantage first, then a wide board. Tatyova turns every land into a card and a life, land-fetching spells trigger her twice, and the extra cards become creatures and answers. Flyers and growth finish.", early: "Ramp spells and mana creatures. Hold land drops when Tatyova is one turn away so each land draws a card.", mid: "Cast Tatyova, then play lands and ramp spells: three cards a turn is normal. Bounce the scariest permanent at the table.", late: "Outvalue the table; a board wipe when everyone else is wide, then rebuild faster than they can.", misplays: "Playing all your lands before Tatyova is out, and forgetting that counterspells need untapped blue mana." }),
];

const FULL_LEADERS = ["Elas il-Kor, Sadistic Pilgrim", "Talrand, Sky Summoner", "Aesi, Tyrant of Gyre Strait", "Urabrask the Hidden"];
/** Four computer decks built from every playable card, around popular commanders. */
export const FULL_DECKS: CDeck[] = [
  build("elas", "Pilgrim's Toll", "Elas il-Kor, Sadistic Pilgrim", "Black and white: creatures entering gain you life, creatures leaving drain your opponents.", autoVocabulary(byName("Elas il-Kor, Sadistic Pilgrim")), [...LEADERS, ...FULL_LEADERS],
    { wins: "Drain. Every creature that enters gains a life and every one that dies costs each opponent a life, so a stream of cheap creatures and tokens bleeds the table while you climb out of reach.", early: "Lands, mana rocks, and cheap creatures. Elas on turn two or three starts the engine.", mid: "Add token makers and sacrifice outlets; each creature in and out is a drain trigger.", late: "Finish with a board wipe that kills your own tokens too, draining everyone at once.", misplays: "Casting big creatures instead of many small ones; the engine wants bodies, not size." }, "full"),
  build("talrand", "Drake Storm", "Talrand, Sky Summoner", "Blue: every instant and sorcery makes a 2/2 flying Drake.", autoVocabulary(byName("Talrand, Sky Summoner")), [...LEADERS, ...FULL_LEADERS],
    { wins: "Flying tokens. Talrand turns each instant and sorcery into a 2/2 Drake with flying, and cheap draw and counterspells keep the spells coming.", early: "Lands and mana rocks; hold cheap spells rather than casting them before Talrand.", mid: "Cast Talrand, then chain cheap spells on your own turn for Drakes. Counter the one spell that matters.", late: "Swing with a flock of Drakes; bounce blockers the turn you alpha strike.", misplays: "Casting spells before Talrand is out, and tapping out when a counterspell would save the game." }, "full"),
  build("aesi", "Tide Serpent", "Aesi, Tyrant of Gyre Strait", "Green and blue: extra land drops that draw cards, ramp, and big sea creatures.", autoVocabulary(byName("Aesi, Tyrant of Gyre Strait")), [...LEADERS, ...FULL_LEADERS],
    { wins: "Card advantage into big creatures. Aesi lets you play two lands a turn and each land draws a card, so you out-draw the table and finish with large tramplers.", early: "Ramp spells and mana creatures; keep land drops coming.", mid: "Cast Aesi, then play two lands a turn and draw into more lands and threats.", late: "Overwhelm with big creatures and bounce whatever blocks.", misplays: "Playing all your lands from hand before Aesi is on the table." }, "full"),
  build("urabrask", "Red Haste", "Urabrask the Hidden", "Red: your creatures have haste and theirs enter tapped.", autoVocabulary(byName("Urabrask the Hidden")), [...LEADERS, ...FULL_LEADERS],
    { wins: "Fast combat. Urabrask gives every creature haste and makes opposing creatures enter tapped, so your attackers hit before blockers are ready. Burn clears the rest.", early: "Cheap creatures and burn on blockers. Attack the player with the fewest untapped creatures.", mid: "Cast Urabrask, then every creature attacks the turn it arrives.", late: "Finish with big haste creatures and damage spells aimed at the leader.", misplays: "Attacking into a board that can block and kill, and burning creatures instead of players when players are in reach." }, "full"),
];
export const ALL_DECKS: CDeck[] = [...CDECKS, ...FULL_DECKS];
export const cdeckById = (id: string): CDeck | undefined => ALL_DECKS.find((d) => d.id === id);
export const deckSummary = (d: CDeck): { lands: number; creatures: number; other: number } => {
  let lands = 0, creatures = 0, other = 0;
  for (const id of d.cards) { const k = CCARDS[id]?.kind; if (k === "land") lands++; else if (k === "creature") creatures++; else other++; }
  return { lands, creatures, other };
};
/** The deck as "1 Card Name" lines, for the deck doctor and for copying out. */
export const deckListText = (d: CDeck): string => {
  const counts = new Map<string, number>();
  for (const id of d.cards) { const n = CCARDS[id]!.name; counts.set(n, (counts.get(n) ?? 0) + 1); }
  return [`1 ${CCARDS[d.commander]!.name} *CMDR*`, "", ...[...counts].map(([n, q]) => `${q} ${n}`)].join("\n");
};
