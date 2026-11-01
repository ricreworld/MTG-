// Your own Commander decks: a pasted list matched against the compiled card pool, checked, and saved on this
// device. A deck can only be played on the table when the engine can run every card in it exactly as
// printed, so the check names each card it can't run and suggests playable cards with the same job.
import { classify, parseList, type DeckLine, type Role } from "../deckcheck";
import { CARD_LIST, CCARDS, fitsIdentity, isBasicLand, manaValue, subtypesOf, type CDef } from "./cards";
import { toLibraryCard } from "./decks";

export interface MyDeck { id: string; name: string; commander: string; cards: string[]; savedAt: string }

export interface ImportResult {
  name: string;
  commander: CDef | null;
  commanderProblem: string | null;
  cards: { line: DeckLine; card: CDef | null; offIdentity: boolean }[];
  total: number;
  unplayable: { name: string; qty: number; suggestions: CDef[] }[];
  problems: string[];
  playable: boolean;
  deck: MyDeck | null;
}

export const MY_DECKS_KEY = "mana-steps:my-decks";

const byName = new Map<string, CDef>();
for (const c of CARD_LIST) { const k = c.name.toLowerCase(); if (!byName.has(k)) byName.set(k, c); const front = k.split(" // ")[0]!; if (!byName.has(front)) byName.set(front, c); }
export const findCard = (name: string): CDef | undefined => byName.get(name.trim().toLowerCase());

const roleCache = new Map<string, Role[]>();
const rolesOf = (c: CDef): Role[] => { let r = roleCache.get(c.id); if (!r) { r = classify(toLibraryCard(c)); roleCache.set(c.id, r); } return r; };

/**
 * Playable cards to swap in for one the engine can't run: in the commander's colours, with the same job when we
 * know it, sharing a creature type with the commander when we can, and the most-played (EDHREC rank) first.
 */
export function suggestSwaps(name: string, identity: string, roles: Role[], mv: number, exclude: Set<string>, commander?: CDef): CDef[] {
  const want = roles.filter((r) => r !== "land");
  const subs = commander ? subtypesOf(commander) : [];
  const pool = CARD_LIST.filter((c) => c.kind !== "land" && fitsIdentity(c, identity) && !exclude.has(c.id) && c.name !== name && (c.rank ?? 0) > 0);
  const score = (c: CDef) => {
    const r = rolesOf(c);
    const hits = want.filter((x) => r.includes(x)).length;
    const tribal = subs.some((x) => subtypesOf(c).includes(x) || new RegExp(`\\b${x}s?\\b`).test(c.text)) ? 1 : 0;
    return hits * 10 + tribal * 6 - Math.abs(manaValue(c.cost) - mv) - Math.log10(c.rank ?? 10000) * 2;
  };
  return pool.map((c) => ({ c, s: score(c) })).sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name)).slice(0, 3).map((x) => x.c);
}

export function importDeck(text: string, deckName: string, commanderName?: string): ImportResult {
  const lines = parseList(text);
  const cmdLine = /\*CMDR\*/i.test(text) ? parseList(text.split("\n").find((l) => /\*CMDR\*/i.test(l)) ?? "")[0] : undefined;
  const cmdName = (commanderName?.trim() || cmdLine?.name || lines[0]?.name || "").trim();
  const commander = findCard(cmdName) ?? null;
  const cmdIndex = lines.findIndex((l) => l.name.toLowerCase() === cmdName.toLowerCase());
  const rest = lines.filter((_, i) => i !== cmdIndex);
  const problems: string[] = [];
  let commanderProblem: string | null = null;
  if (!cmdName) commanderProblem = "Name the commander, or mark it with *CMDR* in the list.";
  else if (!commander) commanderProblem = `The engine can't run ${cmdName} yet, so it can't lead a deck on the table.`;
  else if (!(commander.kind === "creature" && commander.legendary)) commanderProblem = `${commander.name} isn't a legendary creature, so it can't be a commander here.`;
  const identity = commander?.colors ?? "";
  const cards = rest.map((line) => { const card = findCard(line.name) ?? null; return { line, card, offIdentity: !!card && !!commander && !fitsIdentity(card, identity) }; });
  const total = rest.reduce((n, l) => n + l.qty, 0) + (commander ? 1 : 0);
  if (total !== 100) problems.push(`A Commander deck is exactly 100 cards counting the commander; this list has ${total}.`);
  for (const c of cards) if (c.card && c.line.qty > 1 && !isBasicLand(c.card)) problems.push(`${c.card.name} appears ${c.line.qty} times; only basic lands may repeat.`);
  const off = cards.filter((c) => c.offIdentity);
  if (off.length) problems.push(`Outside ${commander?.name}'s colours: ${off.map((c) => c.card!.name).join(", ")}.`);
  const have = new Set(cards.filter((c) => c.card).map((c) => c.card!.id));
  // Unknown cards have no text here, so each gets a different slice of the best playable cards in the commander's colours:
  // the first missing card gets the top three, the next gets the following three, and so on. Nothing repeats.
  const used = new Set<string>();
  const unplayable = cards.filter((c) => !c.card).map((c) => {
    const roles: Role[] = [];
    const picks = suggestSwaps(c.line.name, identity, roles, 3, new Set([...have, ...used]), commander ?? undefined);
    for (const p of picks) used.add(p.id);
    return { name: c.line.name, qty: c.line.qty, suggestions: picks };
  });
  const playable = !!commander && !commanderProblem && problems.length === 0 && unplayable.length === 0;
  const ids: string[] = [];
  for (const c of cards) if (c.card) for (let i = 0; i < c.line.qty; i++) ids.push(c.card.id);
  const deck: MyDeck | null = playable && commander ? { id: `my-${Date.now().toString(36)}`, name: deckName.trim() || `${commander.name} deck`, commander: commander.id, cards: ids, savedAt: new Date().toISOString() } : null;
  return { name: deckName, commander, commanderProblem, cards, total, unplayable, problems, playable, deck };
}

export function loadMyDecks(storage: Storage | null = typeof localStorage === "undefined" ? null : localStorage): MyDeck[] {
  try { const raw = storage?.getItem(MY_DECKS_KEY); const list = raw ? (JSON.parse(raw) as MyDeck[]) : []; return list.filter((d) => d && d.commander && Array.isArray(d.cards) && CCARDS[d.commander] && d.cards.every((id) => CCARDS[id])); } catch { return []; }
}
export function saveMyDecks(decks: MyDeck[], storage: Storage | null = typeof localStorage === "undefined" ? null : localStorage): void {
  try { storage?.setItem(MY_DECKS_KEY, JSON.stringify(decks)); } catch { /* ignore */ }
}
/** The deck as text, to copy it back out. */
export const myDeckText = (d: MyDeck): string => {
  const counts = new Map<string, number>();
  for (const id of d.cards) { const n = CCARDS[id]!.name; counts.set(n, (counts.get(n) ?? 0) + 1); }
  return [`1 ${CCARDS[d.commander]!.name} *CMDR*`, "", ...[...counts].map(([n, q]) => `${q} ${n}`)].join("\n");
};
