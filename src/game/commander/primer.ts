// "How to play this deck", written by the app from the cards themselves (no internet, no skills): the plan,
// the key cards, what to keep in an opening hand, early / middle / late turns, weak spots, and one line per card.
// Also: deck goals to tick off while playing, and the plan the table coach uses to give deck-specific advice.
import { classify, type Role } from "../deckcheck";
import { CCARDS, manaValue, subtypesOf, type CDef } from "./cards";
import { autoVocabulary, contactsWith, toLibraryCard } from "./decks";
import type { CState, Seat } from "./engine";
import { player } from "./engine";

export type Plan = "combat" | "voltron" | "tokens" | "drain" | "lifegain" | "spells" | "lands" | "counters" | "control";

export interface DeckGuide {
  commander: CDef;
  plan: Plan;
  secondPlan: Plan | null;
  planText: string;
  keyCards: { card: CDef; why: string }[];
  openingHand: string;
  early: string;
  mid: string;
  late: string;
  weakSpots: string[];
  shape: { lands: number; ramp: number; draw: number; interaction: number; wipes: number; creatures: number; avgMv: number };
  /** Every card, grouped by its main job, one line each. */
  groups: { title: string; cards: { card: CDef; line: string }[] }[];
}

const PLAN_WORDS: Record<Plan, string> = {
  combat: "attacking with creatures", voltron: "one huge commander", tokens: "going wide with tokens", drain: "draining life as creatures enter and die",
  lifegain: "gaining life and turning it into power", spells: "casting many instants and sorceries", lands: "extra lands and the cards they draw", counters: "growing creatures with +1/+1 counters", control: "answering everything and winning late",
};

function rolesOf(c: CDef): Role[] { return classify(toLibraryCard(c)); }

/** Reads the plan from the commander and the 99. */
export function readPlan(commander: CDef, cards: CDef[]): { plan: Plan; second: Plan | null; scores: Record<Plan, number> } {
  const all = [commander, ...cards];
  const t = (c: CDef) => c.text;
  const count = (re: RegExp) => all.filter((c) => re.test(t(c))).length;
  const roles = cards.map(rolesOf);
  const scores: Record<Plan, number> = {
    combat: cards.filter((c) => c.kind === "creature").length / 4,
    voltron: (cards.filter((c) => c.abilities.some((a) => a.kind === "enchant" || a.kind === "equip")).length) * 1.5 + ((commander.power ?? 0) >= 4 ? 3 : 0),
    tokens: roles.filter((r) => r.includes("tokens")).length * 1.4 + (/token/i.test(commander.text) ? 4 : 0),
    drain: count(/each opponent loses \d+ life|whenever .* dies/i) * 2 + (/loses \d+ life|dies/i.test(commander.text) ? 7 : 0),
    lifegain: roles.filter((r) => r.includes("lifegain")).length * 1.2 + (/gain \d+ life|lifelink|whenever you gain life/i.test(commander.text) ? 4 : 0),
    spells: cards.filter((c) => c.kind === "instant" || c.kind === "sorcery").length / 1.5 + (/instant or sorcery|noncreature spell/i.test(commander.text) ? 10 : 0),
    lands: count(/landfall|whenever a land/i) * 2 + roles.filter((r) => r.includes("ramp")).length / 3 + (/landfall|a land you control enters|additional land/i.test(commander.text) ? 5 : 0),
    counters: roles.filter((r) => r.includes("counters")).length * 1.3 + (/\+1\/\+1 counter/i.test(commander.text) ? 4 : 0),
    control: roles.filter((r) => r.includes("removal") || r.includes("wipe")).length / 2 + count(/counter target spell/i),
  };
  const order = (Object.keys(scores) as Plan[]).sort((a, b) => scores[b] - scores[a]);
  return { plan: order[0]!, second: scores[order[1]!] >= scores[order[0]!] * 0.6 ? order[1]! : null, scores };
}

const describeRole = (r: Role[]): string => {
  if (r.includes("wipe")) return "board wipe";
  if (r.includes("removal")) return "answer";
  if (r.includes("ramp")) return "extra mana";
  if (r.includes("draw")) return "card draw";
  if (r.includes("finisher")) return "finisher";
  if (r.includes("tokens")) return "token maker";
  if (r.includes("lifegain")) return "life gain";
  if (r.includes("counters")) return "+1/+1 counters";
  if (r.includes("recursion")) return "brings cards back";
  if (r.includes("protection")) return "protection";
  if (r.includes("land")) return "land";
  return "";
};

const firstSentence = (text: string): string => { const s = text.replace(/\([^)]*\)/g, "").split(/\n|(?<=\.)\s/)[0] ?? ""; return s.length > 110 ? `${s.slice(0, 107)}…` : s; };

export function writeGuide(commanderId: string, cardIds: string[]): DeckGuide {
  const commander = CCARDS[commanderId]!;
  const cards = cardIds.map((id) => CCARDS[id]!).filter(Boolean);
  const { plan, second } = readPlan(commander, cards);
  const vocab = autoVocabulary(commander);
  const unique = [...new Map(cards.map((c) => [c.id, c])).values()];
  const roles = new Map(unique.map((c) => [c.id, rolesOf(c)]));
  const lands = cards.filter((c) => c.kind === "land").length;
  const nonland = cards.filter((c) => c.kind !== "land");
  const avgMv = nonland.length ? Math.round((nonland.reduce((n, c) => n + manaValue(c.cost), 0) / nonland.length) * 10) / 10 : 0;
  const shape = { lands, ramp: cards.filter((c) => roles.get(c.id)?.includes("ramp")).length, draw: cards.filter((c) => roles.get(c.id)?.includes("draw")).length, interaction: cards.filter((c) => roles.get(c.id)?.includes("removal") || roles.get(c.id)?.includes("wipe")).length, wipes: cards.filter((c) => roles.get(c.id)?.includes("wipe")).length, creatures: cards.filter((c) => c.kind === "creature").length, avgMv };
  // Key cards: the ones with the most points of contact with the commander, the engine pieces.
  const scored = unique.filter((c) => c.kind !== "land").map((c) => ({ c, n: contactsWith(c, vocab), r: roles.get(c.id) ?? [] })).sort((a, b) => b.n - a.n || (a.c.rank ?? 99999) - (b.c.rank ?? 99999));
  const keyCards = scored.slice(0, 6).map(({ c, n, r }) => ({ card: c, why: n >= 2 ? `Works with ${commander.name.split(",")[0]} in ${n} ways${describeRole(r) ? `; also ${describeRole(r)}` : ""}.` : describeRole(r) ? `${describeRole(r)[0]!.toUpperCase()}${describeRole(r).slice(1)}.` : firstSentence(c.text) }));
  const cheap = nonland.filter((c) => manaValue(c.cost) <= 2 && c.kind !== "instant").slice(0, 3).map((c) => c.name);
  const planText = `${commander.name} wants ${PLAN_WORDS[plan]}${second ? `, with ${PLAN_WORDS[second]} as the backup` : ""}. ${planHow(plan, commander, scored.slice(0, 3).map((x) => x.c.name))}`;
  const openingHand = `Keep a hand with 3 or 4 lands${shape.ramp >= 8 ? " or 2 lands and a mana rock" : ""}, plus something to do on turn 2 or 3${cheap.length ? ` (${cheap.join(", ")})` : ""}. Send back hands with no lands or only expensive cards.`;
  const cmdMv = manaValue(commander.cost);
  const early = `Turns 1 to 3: lands every turn, ${shape.ramp >= 8 ? "mana rocks and mana creatures first, " : ""}cheap creatures${plan === "spells" ? " and card draw" : ""}. Aim to cast ${commander.name.split(",")[0]} on turn ${cmdMv <= 2 ? "2" : cmdMv <= 4 ? "3 or 4" : cmdMv <= 5 ? "4 or 5" : "5 or 6"}.`;
  const mid = planMid(plan, commander, shape);
  const late = planLate(plan, shape);
  const weakSpots: string[] = [];
  if (shape.interaction < 8) weakSpots.push(`Only ${shape.interaction} answers: you can't deal with everything, so save them for the card that beats you.`);
  if (shape.wipes === 0) weakSpots.push("No board wipe: if the table gets wide, you can't reset it. Race instead.");
  if (shape.draw < 10) weakSpots.push(`Only ${shape.draw} card-draw cards: you may run out of gas. Don't dump your hand early.`);
  if (shape.ramp < 8) weakSpots.push(`Only ${shape.ramp} ramp cards: land drops matter every turn.`);
  if (!cards.some((c) => /counter target spell/i.test(c.text))) weakSpots.push("No counterspells: you can't stop a game-ending spell, so keep pressure on instead.");
  if (plan === "voltron" || plan === "combat") weakSpots.push("Board wipes hurt: keep one or two creatures in hand after you have a good board.");
  if (plan === "lifegain" || plan === "drain") weakSpots.push("Cards that stop life gain shut the engine down; plan a second way to win.");
  // Groups: by main job.
  const titles: [string, (r: Role[], c: CDef) => boolean][] = [
    ["Finishers and threats", (r, c) => r.includes("finisher") || (c.kind === "creature" && (c.power ?? 0) >= 4)],
    ["Engine pieces", (_r, c) => contactsWith(c, vocab) >= 2 && c.kind !== "land"],
    ["Extra mana", (r) => r.includes("ramp")],
    ["Card draw", (r) => r.includes("draw")],
    ["Answers and board wipes", (r) => r.includes("removal") || r.includes("wipe")],
    ["Protection and recursion", (r) => r.includes("protection") || r.includes("recursion")],
    ["Other creatures and spells", (_r, c) => c.kind !== "land"],
    ["Lands", (r) => r.includes("land")],
  ];
  const placed = new Set<string>();
  const groups = titles.map(([title, test]) => {
    const list = unique.filter((c) => !placed.has(c.id) && test(roles.get(c.id) ?? [], c));
    for (const c of list) placed.add(c.id);
    const counts = new Map<string, number>(); for (const id of cardIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    return { title, cards: list.map((c) => ({ card: c, line: `${(counts.get(c.id) ?? 1) > 1 ? `${counts.get(c.id)} × ` : ""}${c.name}: ${[describeRole(roles.get(c.id) ?? []), c.kind === "land" ? "" : firstSentence(c.text)].filter(Boolean).join(". ") || c.type}` })) };
  }).filter((g) => g.cards.length);
  return { commander, plan, secondPlan: second, planText, keyCards, openingHand, early, mid, late, weakSpots, shape, groups };
}

function planHow(plan: Plan, cmd: CDef, key: string[]): string {
  const k = key.length ? ` Key pieces: ${key.join(", ")}.` : "";
  switch (plan) {
    case "combat": return `Put creatures on the table every turn and attack the player who is winning. ${cmd.name.split(",")[0]} leads the charge.${k}`;
    case "voltron": return `Load ${cmd.name.split(",")[0]} with auras and equipment and attack one player at a time: 21 commander damage ends them.${k}`;
    case "tokens": return `Make lots of small creatures, then make them bigger together with anthems and overrun effects.${k}`;
    case "drain": return `Creatures entering and dying cost your opponents life a point at a time; sacrifice outlets and token makers keep it going.${k}`;
    case "lifegain": return `Gain life every turn; the deck's payoffs turn each gain into creatures, cards or counters, and lifelink attackers put you out of reach.${k}`;
    case "spells": return `Cast cheap instants and sorceries; each one triggers your payoffs. Hold counterspells for the one spell that matters.${k}`;
    case "lands": return `Play extra lands and fetch more; each land triggers draws or tokens, so you out-draw the table and finish big.${k}`;
    case "counters": return `Stack +1/+1 counters on your creatures until they are too big to block or race.${k}`;
    case "control": return `Answer every real threat, keep your life high, and win late with a few big cards.${k}`;
  }
}
function planMid(plan: Plan, cmd: CDef, shape: DeckGuide["shape"]): string {
  const name = cmd.name.split(",")[0];
  const base = `Turns 4 to 7: cast ${name} and protect it. `;
  switch (plan) {
    case "voltron": return `${base}Attach your best aura or equipment, attack the player with the fewest blockers, and keep a protection spell ready.`;
    case "tokens": return `${base}Add a token maker every turn and an anthem when you have five or more creatures. Hold the team home until it's big enough to swing at everyone.`;
    case "drain": return `${base}Get an engine piece and a sacrifice outlet out together. Then every creature you play is a drain.`;
    case "lifegain": return `${base}Attack with lifelink creatures and let the payoffs make tokens, counters or cards. Gain life on your own turn so end-step payoffs count it.`;
    case "spells": return `${base}Chain two or three cheap spells on your own turn, then attack with the pumped team.`;
    case "lands": return `${base}Play two lands a turn when you can; cast ramp spells after ${name} so each land triggers.`;
    case "counters": return `${base}Put counters on one or two evasive creatures rather than spreading them thin.`;
    case "control": return `${base}Answer the scariest permanent at the table each turn and ${shape.wipes ? "wipe the board when two opponents are wide" : "keep your life total healthy"}.`;
    default: return `${base}Cast your biggest creature each turn and attack whoever has the fewest untapped blockers.`;
  }
}
function planLate(plan: Plan, shape: DeckGuide["shape"]): string {
  switch (plan) {
    case "voltron": return "Turn 8 on: pick one player and finish them with commander damage. Then repeat.";
    case "tokens": return "Turn 8 on: one big overrun turn at the player who can't block; keep one anthem for after a board wipe.";
    case "drain": return "Turn 8 on: with the engine running, a board wipe that kills your own tokens drains everyone at once.";
    case "lifegain": return "Turn 8 on: your life total should be out of reach; close with flyers and lifelink attacks.";
    case "spells": return "Turn 8 on: one big turn of spells and an alpha strike with the whole team.";
    case "lands": return "Turn 8 on: you should have more lands and cards than anyone; cast two threats a turn and let them deal with it.";
    case "counters": return "Turn 8 on: swing with the biggest creature; trample and evasion finish it.";
    case "control": return `Turn 8 on: land your finishers one at a time${shape.wipes ? ", wiping the board first if needed" : ""}.`;
    default: return "Turn 8 on: attack every turn with everything that can attack safely; keep one blocker home if two players can hit back.";
  }
}

/* ------------------------------------------------------------------ deck goals and the plan at the table */

export interface DeckGoal { id: string; label: string; check: (s: CState, seat: Seat) => boolean }

export function deckGoals(plan: Plan, commander: CDef): DeckGoal[] {
  const name = commander.name.split(",")[0]!;
  const cmdOut = (s: CState, seat: Seat) => s.battlefield.some((p) => p.controller === seat && p.isCommander);
  const mine = (s: CState, seat: Seat) => s.battlefield.filter((p) => p.controller === seat);
  const generic: DeckGoal[] = [
    { id: "commander", label: `Get ${name} onto the battlefield`, check: cmdOut },
    { id: "board", label: "Have four creatures on the battlefield at once", check: (s, seat) => mine(s, seat).filter((p) => CCARDS[p.card]?.kind === "creature" || s.tokens[p.card]?.kind === "creature").length >= 4 },
    { id: "lands", label: "Have six lands on the battlefield", check: (s, seat) => mine(s, seat).filter((p) => (CCARDS[p.card] ?? s.tokens[p.card])?.kind === "land").length >= 6 },
    { id: "pressure", label: "Bring an opponent below 20 life", check: (s, seat) => s.seats.some((o) => o !== seat && !player(s, o).out && player(s, o).life < 20) },
    { id: "win", label: "Win a game", check: (s, seat) => s.winner === seat },
  ];
  const specific: Partial<Record<Plan, DeckGoal>> = {
    tokens: { id: "tokens", label: "Control three creature tokens at once", check: (s, seat) => mine(s, seat).filter((p) => s.tokens[p.card]?.kind === "creature").length >= 3 },
    lifegain: { id: "life", label: "Reach 50 life", check: (s, seat) => player(s, seat).life >= 50 },
    drain: { id: "drain", label: "Have every opponent below 35 life", check: (s, seat) => s.seats.filter((o) => o !== seat && !player(s, o).out).every((o) => player(s, o).life < 35) },
    lands: { id: "eightlands", label: "Have eight lands on the battlefield", check: (s, seat) => mine(s, seat).filter((p) => (CCARDS[p.card] ?? s.tokens[p.card])?.kind === "land").length >= 8 },
    counters: { id: "counters", label: "Have a creature with three or more +1/+1 counters", check: (s, seat) => mine(s, seat).some((p) => p.counters >= 3) },
    voltron: { id: "cmddmg", label: `Deal 10 commander damage to one player with ${name}`, check: (s) => s.seats.some((o) => Object.values(player(s, o).commanderDamage).some((n) => n >= 10)) },
    spells: { id: "spells", label: "Have three or more instants and sorceries in your graveyard", check: (s, seat) => player(s, seat).graveyard.filter((c) => ["instant", "sorcery"].includes(CCARDS[c]?.kind ?? "")).length >= 3 },
    control: { id: "answers", label: "Destroy or exile three opposing permanents in one game", check: (s) => s.log.filter((l) => /^You cast .* (destroys|exiles)|^.* destroys .*|^.* exiles .*/.test(l) && /^(?!Mara|Theo|Ines)/.test(l)).length >= 3 },
  };
  const extra = specific[plan];
  return extra ? [generic[0]!, generic[1]!, extra, generic[3]!, generic[4]!] : generic;
}

const planCache = new Map<string, Plan>();
/** The plan of a seat's deck, read from every card they own in the game (cached by commander + library size). */
export function planOf(s: CState, seat: Seat): Plan {
  const pl = player(s, seat);
  const key = `${pl.commandZone.card}:${s.seats.length}`;
  const hit = planCache.get(key);
  if (hit) return hit;
  const ids = [...pl.library, ...pl.graveyard, ...pl.hand.map((u) => s.cards[u] ?? ""), ...s.battlefield.filter((p) => p.controller === seat).map((p) => p.card)].filter((id) => CCARDS[id]);
  const cmd = CCARDS[pl.commandZone.card];
  const plan = cmd ? readPlan(cmd, ids.map((id) => CCARDS[id]!)).plan : "combat";
  planCache.set(key, plan);
  return plan;
}

/** One deck-specific line of advice for the coach, or null. */
export function planAdvice(plan: Plan, s: CState, seat: Seat): string | null {
  const pl = player(s, seat);
  const mine = s.battlefield.filter((p) => p.controller === seat);
  switch (plan) {
    case "voltron": return "Your deck wins with commander damage: aim your commander at one player and keep protection ready.";
    case "tokens": return mine.filter((p) => s.tokens[p.card]).length >= 3 ? "You're wide: an anthem or an overrun effect now wins combats." : "Your deck wins by going wide: make tokens before you attack.";
    case "drain": return "Your deck drains: every creature entering or dying costs opponents life, so cheap creatures beat big ones.";
    case "lifegain": return (pl.lifeGainedThisTurn ?? 0) > 0 ? "You've gained life this turn: your payoffs may trigger at the end step." : "Your deck wants life gain each turn: attack with lifelink creatures when it's safe.";
    case "spells": return "Your deck wants spells on your own turn, so your creatures get pumped before combat.";
    case "lands": return "Your deck wants a land every turn, and extra ones: play ramp spells after your commander is out.";
    case "counters": return "Stack counters on one evasive creature rather than spreading them.";
    case "control": return "Your deck wins late: answer the scariest permanent and keep your life high.";
    default: return null;
  }
}

/** Which plan a list of card ids describes, for the deck tile. */
export const planLabel = (plan: Plan): string => PLAN_WORDS[plan];
export const subtypeWords = (c: CDef): string => subtypesOf(c).join(" ");
