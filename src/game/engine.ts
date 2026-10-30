// The Practice Table rules engine: a pure reducer. (state, action) -> new state.
// No React, no DOM, no randomness. Every state is immutable, so Undo is just "use the previous state".
//
// It implements the beginner rules taught in the course: lands and mana (CR 305, 106), casting
// creatures and instants (CR 302, 304), the stack with responses (CR 405, 117), combat with
// attackers, one blocker per attacker, simultaneous damage, first strike, flying/reach, trample,
// deathtouch and lifelink (CR 506-510, 702), summoning sickness (CR 302.6), lethal damage and
// toughness 0 (CR 704.5f-g), drawing from an empty library (CR 704.5b) and the turn cycle (CR 500).
//
// Simplifications (on purpose, for teaching): one blocker per attacker, no multiple blockers;
// the mana pool empties only when a step changes; no mulligans; the opponent is scripted
// (scenarios) or driven by the simple computer player in ai.ts.
import { CARDS, parseCost, type CardDef, type Color } from "./cards";

export type Player = "you" | "opp";
export type Step = "main1" | "attackers" | "blockers" | "damage" | "main2" | "end";

export interface Permanent {
  uid: string;
  card: string; // CardDef id
  owner: Player;
  /** True for a commander on the battlefield (Commander games). */
  isCommander?: boolean;
  /** Continuous +X/+X from other permanents' static abilities (recomputed by the engine). */
  bonus?: { power: number; toughness: number };
  tapped: boolean;
  /** True until the controller has started a turn with it (summoning sickness). */
  summoningSick: boolean;
  damage: number;
  /** Temporary +X/+X (or -X/-X) until end of turn. */
  pump: { power: number; toughness: number };
  /** Hit by deathtouch damage this turn. */
  deathtouched: boolean;
}

export interface StackItem {
  uid: string;
  card: string;
  caster: Player;
  /** Cast from the command zone (Commander games). */
  fromCommandZone?: boolean;
  target?: { kind: "permanent"; uid: string } | { kind: "player"; player: Player } | { kind: "spell"; uid: string };
}

export interface PlayerState {
  life: number;
  hand: string[]; // card uids (see state.cards)
  /** Card ids, top of the library first. Empty in scenarios that don't draw. */
  library: string[];
  graveyard: string[]; // card ids
  landPlayedThisTurn: boolean;
  pool: Partial<Record<Color, number>>;
  /** Commander games: the player's commander, whether it's in the command zone now, and how often it was cast from there. */
  commandZone?: { card: string; casts: number; inZone: boolean } | null;
  /** Commander games: combat damage taken from each commander (by card id), for the 21-damage rule. */
  commanderDamage?: Record<string, number>;
}

export interface GameState {
  /** "commander": 40 life, command zone, commander tax and commander damage (CR 903). */
  mode?: "standard" | "commander";
  turn: Player;
  step: Step;
  /** 1 on the first turn of the game; the first player skips their first draw (CR 103.8a). */
  turnNumber: number;
  you: PlayerState;
  opp: PlayerState;
  battlefield: Permanent[];
  stack: StackItem[];
  /** Which cards the uids refer to, for cards in hands. */
  cards: Record<string, string>;
  /** Attack declarations this combat: attacker uid -> blocker uid (or null when unblocked). */
  attackers: Record<string, string | null>;
  /** The learner's pending choices. */
  selectedAttackers: string[];
  pendingBlocker: string | null;
  /** Spell waiting for a target: the hand uid. */
  pendingTarget: string | null;
  /** Plain-language log, newest last. */
  log: string[];
  /** Why the last action wasn't allowed (null when it was). */
  refusal: string | null;
  /** Set when the game has a result; the UI shows it calmly. */
  result: "win" | "lose" | null;
}

export type Action =
  | { type: "playLand"; uid: string }
  | { type: "tapForMana"; uid: string }
  | { type: "cast"; uid: string } // from hand; instants with a target go to pendingTarget first
  | { type: "castCommander" } // from the command zone (Commander games)
  | { type: "chooseTarget"; target: NonNullable<StackItem["target"]> }
  | { type: "cancelTarget" }
  | { type: "pass" } // pass priority: resolve the top of the stack
  | { type: "toggleAttacker"; uid: string }
  | { type: "declareAttackers" }
  | { type: "goToCombat" }
  | { type: "skipCombat" }
  | { type: "pickBlocker"; uid: string }
  | { type: "assignBlock"; attackerUid: string }
  | { type: "declareBlockers" }
  | { type: "dealDamage" }
  | { type: "endTurn" };

/* ---------- helpers ---------- */

export const def = (cardId: string): CardDef => {
  const c = CARDS[cardId];
  if (!c) throw new Error(`Unknown card ${cardId}`);
  return c;
};
export const power = (p: Permanent): number => (def(p.card).power ?? 0) + p.pump.power + (p.bonus?.power ?? 0);
export const toughness = (p: Permanent): number => (def(p.card).toughness ?? 0) + p.pump.toughness + (p.bonus?.toughness ?? 0);
export const hasAbility = (p: Permanent, a: NonNullable<CardDef["abilities"]>[number]): boolean => def(p.card).abilities?.includes(a) ?? false;
export const hasSubtype = (p: Permanent, sub: string): boolean => new RegExp(`\\b${sub}\\b`).test(def(p.card).type.split("—")[1] ?? "");

/** Recomputes continuous +X/+X bonuses from static abilities (CR 611.3), e.g. "Other Elf creatures you control get +1/+1". */
export function refreshStatics(s: GameState): GameState {
  return {
    ...s,
    battlefield: s.battlefield.map((p) => {
      let bonus = 0;
      if (isCreature(p)) {
        for (const src of s.battlefield) {
          if (src.uid !== p.uid && src.owner === p.owner && hasAbility(src, "dwynen-elves") && hasSubtype(p, "Elf")) bonus += 1;
        }
      }
      return bonus || p.bonus ? { ...p, bonus: { power: bonus, toughness: bonus } } : p;
    }),
  };
}

/** The cost to cast a commander from the command zone right now: its cost plus {2} per earlier cast (CR 903.8). */
export function commanderCost(s: GameState, player: Player): string | null {
  const cz = s[player].commandZone;
  if (!cz || !cz.inZone) return null;
  const base = def(cz.card).cost ?? "";
  const need = parseCost(base);
  const generic = need.generic + 2 * cz.casts;
  const colored = base.replace(/\d+/g, "");
  return `${generic || ""}${colored}` || "0";
}
export const has = (p: Permanent, kw: NonNullable<CardDef["keywords"]>[number]): boolean => def(p.card).keywords?.includes(kw) ?? false;
export const isLand = (p: Permanent) => def(p.card).kind === "land";
export const isCreature = (p: Permanent) => def(p.card).kind === "creature";
export const other = (p: Player): Player => (p === "you" ? "opp" : "you");
const find = (s: GameState, uid: string) => s.battlefield.find((p) => p.uid === uid);
const handCard = (s: GameState, player: Player, uid: string): CardDef | undefined => (s[player].hand.includes(uid) ? def(s.cards[uid] ?? "") : undefined);
const COLORS: Color[] = ["W", "U", "B", "R", "G"];
export const colorName = (c: Color) => (c === "W" ? "white" : c === "U" ? "blue" : c === "B" ? "black" : c === "R" ? "red" : "green");

export function canPay(pool: PlayerState["pool"], cost: string | undefined): boolean {
  const need = parseCost(cost);
  let spare = 0;
  for (const c of COLORS) {
    const have = pool[c] ?? 0;
    const want = need[c] ?? 0;
    if (have < want) return false;
    spare += have - want;
  }
  return spare >= need.generic;
}

function pay(pool: PlayerState["pool"], cost: string | undefined): PlayerState["pool"] {
  const next = { ...pool };
  const need = parseCost(cost);
  for (const c of COLORS) next[c] = (next[c] ?? 0) - (need[c] ?? 0);
  let generic = need.generic;
  for (const c of COLORS) {
    while (generic > 0 && (next[c] ?? 0) > 0) { next[c] = (next[c] ?? 0) - 1; generic--; }
  }
  for (const c of Object.keys(next) as Color[]) if (!next[c]) delete next[c];
  return next;
}

/** Mana in the pool plus what untapped lands could add. */
export const availableMana = (s: GameState, player: Player): PlayerState["pool"] => {
  const pool = { ...s[player].pool };
  for (const p of s.battlefield) if (p.owner === player && isLand(p) && !p.tapped) pool[def(p.card).color] = (pool[def(p.card).color] ?? 0) + 1;
  return pool;
};

export const canBlock = (blocker: Permanent, attacker: Permanent): boolean =>
  !(has(attacker, "Flying") && !has(blocker, "Flying") && !has(blocker, "Reach"));

export const canAttack = (p: Permanent, s: GameState): boolean =>
  p.owner === s.turn && isCreature(p) && !p.tapped && (!p.summoningSick || has(p, "Haste"));

const refuse = (s: GameState, why: string): GameState => ({ ...s, refusal: why });
const log = (s: GameState, line: string): GameState => ({ ...s, log: [...s.log, line] });
const name = (s: GameState, uid: string) => { const p = find(s, uid); if (p) return def(p.card).name; const item = s.stack.find((x) => x.uid === uid); if (item) return def(item.card).name; const id = s.cards[uid]; return id ? def(id).name : "a card"; };
const who = (p: Player) => (p === "you" ? "You" : "Your opponent");
const whose = (p: Player) => (p === "you" ? "your" : "their");

let uidCounter = 0;
export const newUid = (prefix = "c") => `${prefix}${++uidCounter}`;
export const resetUids = () => { uidCounter = 0; };

const newPermanent = (uid: string, card: string, owner: Player, sick: boolean): Permanent => ({ uid, card, owner, tapped: false, summoningSick: sick, damage: 0, pump: { power: 0, toughness: 0 }, deathtouched: false });

/** State-based actions (CR 704): lethal damage, deathtouch, toughness 0, life totals. */
export function checkState(s: GameState): GameState {
  let next = refreshStatics(s);
  for (const p of next.battlefield) {
    if (isCreature(p) && (p.damage >= toughness(p) || p.deathtouched || toughness(p) <= 0)) {
      const wasAttacking = next.attackers[p.uid] !== undefined && (next.step === "damage" || next.step === "blockers");
      next = { ...next, battlefield: next.battlefield.filter((x) => x.uid !== p.uid) };
      if (p.isCommander) {
        // CR 903.9a: the owner may put the commander into the command zone instead. On this table they always do.
        const cz = next[p.owner].commandZone;
        next = { ...next, [p.owner]: { ...next[p.owner], commandZone: { card: p.card, casts: cz?.casts ?? 0, inZone: true } } };
        next = log(next, `${def(p.card).name} is destroyed. It goes back to the command zone instead of the graveyard.`);
      } else {
        next = { ...next, [p.owner]: { ...next[p.owner], graveyard: [...next[p.owner].graveyard, p.card] } };
        next = log(next, `${def(p.card).name} is destroyed and goes to the graveyard.`);
      }
      // Garna: "Whenever another creature you control dies, draw a card if it was attacking. Otherwise, Garna deals 1 damage to each opponent."
      for (const g of next.battlefield.filter((x) => x.owner === p.owner && hasAbility(x, "garna-death"))) {
        if (wasAttacking) next = drawCards(log(next, `${def(g.card).name} triggers: that creature was attacking, so ${p.owner === "you" ? "you draw" : "your opponent draws"} a card.`), p.owner, 1);
        else { const foe = other(p.owner); next = log({ ...next, [foe]: { ...next[foe], life: next[foe].life - 1 } }, `${def(g.card).name} triggers: 1 damage to ${foe === "you" ? "you" : "your opponent"}.`); }
      }
      next = refreshStatics(next);
    }
  }
  if (next.opp.life <= 0 && !next.result) next = { ...log(next, "Your opponent's life is 0. You win!"), result: "win" };
  else if (next.you.life <= 0 && !next.result) next = { ...log(next, "Your life is 0."), result: "lose" };
  for (const pl of ["you", "opp"] as Player[]) {
    for (const [card, dmg] of Object.entries(next[pl].commanderDamage ?? {})) {
      if (dmg >= 21 && !next.result) next = { ...log(next, `${def(card).name} has dealt ${pl === "you" ? "you" : "your opponent"} ${dmg} combat damage in total. 21 or more from one commander loses the game.`), result: pl === "you" ? "lose" : "win" };
    }
  }
  return next;
}

function emptyPools(s: GameState): GameState {
  return { ...s, you: { ...s.you, pool: {} }, opp: { ...s.opp, pool: {} } };
}

function resolveTop(s: GameState): GameState {
  const item = s.stack[s.stack.length - 1];
  if (!item) return s;
  let next: GameState = { ...s, stack: s.stack.slice(0, -1) };
  const card = def(item.card);
  const toGrave = (st: GameState): GameState => ({ ...st, [item.caster]: { ...st[item.caster], graveyard: [...st[item.caster].graveyard, item.card] } });
  if (card.kind === "creature") {
    next = { ...next, battlefield: [...next.battlefield, { ...newPermanent(item.uid, item.card, item.caster, true), ...(item.fromCommandZone ? { isCommander: true } : {}) }] };
    return refreshStatics(log(next, `${card.name} resolves and enters the battlefield${item.caster === "opp" ? " on your opponent's side" : ""}.`));
  }
  next = toGrave(next);
  const t = item.target;
  if ((card.effect === "counter" || card.effect === "counterNoncreature") && t?.kind === "spell") {
    const victim = next.stack.find((x) => x.uid === t.uid);
    if (!victim) return log(next, `${card.name} has nothing to counter any more, so it does nothing.`);
    next = { ...next, stack: next.stack.filter((x) => x.uid !== t.uid) };
    if (victim.fromCommandZone) {
      next = { ...next, [victim.caster]: { ...next[victim.caster], commandZone: { card: victim.card, casts: next[victim.caster].commandZone?.casts ?? 0, inZone: true } } };
      return log(next, `${card.name} resolves: ${def(victim.card).name} is countered. It goes back to the command zone.`);
    }
    next = { ...next, [victim.caster]: { ...next[victim.caster], graveyard: [...next[victim.caster].graveyard, victim.card] } };
    return log(next, `${card.name} resolves: ${def(victim.card).name} is countered. It goes to the graveyard without happening.`);
  }
  if ((card.effect === "pump3" || card.effect === "shrink2") && t?.kind === "permanent") {
    const p = find(next, t.uid);
    if (!p) return log(next, `${card.name}'s target is gone, so it does nothing.`);
    const d = card.effect === "pump3" ? 3 : -2;
    next = { ...next, battlefield: next.battlefield.map((x) => (x.uid === p.uid ? { ...x, pump: { power: x.pump.power + d, toughness: x.pump.toughness + d } } : x)) };
    const after = find(next, t.uid);
    return checkState(log(next, `${card.name} resolves: ${def(p.card).name} is ${after ? power(after) : "?"}/${after ? toughness(after) : "?"} until end of turn.`));
  }
  return log(next, `${card.name} resolves.`);
}

function dealCombatDamage(s: GameState, firstStrikeOnly: boolean): GameState {
  let next = s;
  const defender: Player = other(s.turn);
  const strikes = (p: Permanent) => (firstStrikeOnly ? has(p, "First strike") : !has(p, "First strike"));
  const dmg: Record<string, number> = {};
  const dt: Record<string, boolean> = {};
  const cmdDmg: Record<string, number> = {};
  let toPlayer = 0;
  let lifeGain = 0;
  const lines: string[] = [];
  for (const [aUid, bUid] of Object.entries(s.attackers)) {
    const a = find(s, aUid);
    if (!a) continue;
    const b = bUid ? find(s, bUid) : undefined;
    if (strikes(a)) {
      const p = power(a);
      if (!b) {
        toPlayer += p;
        lines.push(`${def(a.card).name} is unblocked and deals ${p} damage to ${defender === "you" ? "you" : "your opponent"}.`);
        if (a.isCommander && p > 0) cmdDmg[a.card] = (cmdDmg[a.card] ?? 0) + p;
      } else {
        let toBlocker = p;
        if (has(a, "Trample")) {
          const lethal = has(a, "Deathtouch") ? 1 : Math.max(0, toughness(b) - b.damage - (dmg[b.uid] ?? 0));
          toBlocker = Math.min(p, lethal);
          const over = p - toBlocker;
          if (over > 0 && a.isCommander) cmdDmg[a.card] = (cmdDmg[a.card] ?? 0) + over;
          if (over > 0) { toPlayer += over; lines.push(`${def(a.card).name} tramples over: ${toBlocker} to ${def(b.card).name}, ${over} to ${defender === "you" ? "you" : "your opponent"}.`); }
          else lines.push(`${def(a.card).name} deals ${toBlocker} damage to ${def(b.card).name}.`);
        } else lines.push(`${def(a.card).name} deals ${toBlocker} damage to ${def(b.card).name}.`);
        dmg[b.uid] = (dmg[b.uid] ?? 0) + toBlocker;
        if (has(a, "Deathtouch") && toBlocker > 0) dt[b.uid] = true;
      }
      if (has(a, "Lifelink")) lifeGain += p;
    }
    if (b && strikes(b)) {
      const p = power(b);
      dmg[a.uid] = (dmg[a.uid] ?? 0) + p;
      if (has(b, "Deathtouch") && p > 0) dt[a.uid] = true;
      lines.push(`${def(b.card).name} deals ${p} damage to ${def(a.card).name}.`);
      if (has(b, "Lifelink") && p > 0) { next = { ...next, [defender]: { ...next[defender], life: next[defender].life + p } }; lines.push(`Lifelink: ${defender === "you" ? "you gain" : "your opponent gains"} ${p} life.`); }
    }
  }
  if (lines.length === 0) return next;
  if (firstStrikeOnly) next = log(next, "First strike damage happens first.");
  next = { ...next, battlefield: next.battlefield.map((p) => ({ ...p, damage: p.damage + (dmg[p.uid] ?? 0), deathtouched: p.deathtouched || !!dt[p.uid] })) };
  if (toPlayer > 0) next = { ...next, [defender]: { ...next[defender], life: next[defender].life - toPlayer } };
  for (const [card, d] of Object.entries(cmdDmg)) {
    const total = (next[defender].commanderDamage?.[card] ?? 0) + d;
    next = { ...next, [defender]: { ...next[defender], commanderDamage: { ...next[defender].commanderDamage, [card]: total } } };
    lines.push(`Commander damage from ${def(card).name} to ${defender === "you" ? "you" : "your opponent"}: ${total} of 21.`);
  }
  if (lifeGain > 0) { next = { ...next, [s.turn]: { ...next[s.turn], life: next[s.turn].life + lifeGain } }; lines.push(`Lifelink: ${s.turn === "you" ? "you gain" : "your opponent gains"} ${lifeGain} life.`); }
  for (const l of lines) next = log(next, l);
  return checkState(next);
}

/* ---------- player-generic moves (used by the reducer for the learner and by ai.ts for the opponent) ---------- */

/** Draws cards from the top of the library. Drawing from an empty library loses the game (CR 704.5b). */
export function drawCards(s: GameState, player: Player, n: number): GameState {
  let next = s;
  for (let i = 0; i < n; i++) {
    const [top, ...rest] = next[player].library;
    if (!top) {
      next = log(next, `${who(player)} must draw from an empty library.`);
      return { ...next, result: player === "you" ? "lose" : "win", log: [...next.log, player === "you" ? "You can't draw, so you lose this game. That's a real rule, and it happens to everyone." : "Your opponent can't draw a card, so you win!"] };
    }
    const uid = newUid("h");
    next = { ...next, cards: { ...next.cards, [uid]: top }, [player]: { ...next[player], library: rest, hand: [...next[player].hand, uid] } };
  }
  return n > 0 ? log(next, `${who(player)} draw${player === "you" ? "" : "s"} ${n === 1 ? "a card" : `${n} cards`}.`) : next;
}

/** Starts a player's turn: untap, clear summoning sickness, draw (CR 502, 504, 302.6). */
export function beginTurn(s: GameState, player: Player): GameState {
  const turnNumber = player === "you" ? s.turnNumber + 1 : s.turnNumber;
  let next: GameState = {
    ...emptyPools(s),
    turn: player,
    step: "main1",
    turnNumber,
    attackers: {},
    selectedAttackers: [],
    pendingBlocker: null,
    pendingTarget: null,
    battlefield: s.battlefield.map((p) => (p.owner === player ? { ...p, tapped: false, summoningSick: false } : p)),
  };
  next = { ...next, [player]: { ...next[player], landPlayedThisTurn: false, pool: {} } };
  next = refreshStatics(log(next, player === "you" ? "Your turn. Your cards untap." : "Your opponent's turn. Their cards untap."));
  // The player who goes first skips the draw on the very first turn of the game (CR 103.8a).
  const skipDraw = player === "you" && s.turnNumber === 0;
  if (!skipDraw) next = drawCards(next, player, 1);
  return next;
}

export function playLandFor(s: GameState, player: Player, uid: string): GameState {
  const card = handCard(s, player, uid);
  if (!card || card.kind !== "land") return s;
  return log({
    ...s,
    [player]: { ...s[player], hand: s[player].hand.filter((u) => u !== uid), landPlayedThisTurn: true },
    battlefield: [...s.battlefield, newPermanent(uid, card.id, player, false)],
  }, `${who(player)} play${player === "you" ? "" : "s"} ${card.name}.`);
}

/** Taps untapped lands until the cost can be paid from the pool. Returns null if it can't be paid. */
export function tapLandsFor(s: GameState, player: Player, cost: string | undefined): GameState | null {
  if (canPay(s[player].pool, cost)) return s;
  if (!canPay(availableMana(s, player), cost)) return null;
  const need = parseCost(cost);
  let next = s;
  const pool = { ...s[player].pool };
  const tappedNow = new Set<string>();
  const untapped = () => s.battlefield.filter((p) => p.owner === player && isLand(p) && !p.tapped && !tappedNow.has(p.uid));
  const tap = (p: Permanent) => {
    const c = def(p.card).color;
    pool[c] = (pool[c] ?? 0) + 1;
    tappedNow.add(p.uid);
    next = { ...next, battlefield: next.battlefield.map((x) => (x.uid === p.uid ? { ...x, tapped: true } : x)) };
    next = log(next, `${who(player)} tap${player === "you" ? "" : "s"} ${def(p.card).name} for one ${colorName(c)} mana.`);
  };
  // Coloured requirements first, then anything for generic.
  for (const c of COLORS) {
    while ((pool[c] ?? 0) < (need[c] ?? 0)) { const l = untapped().find((p) => def(p.card).color === c); if (!l) return null; tap(l); }
  }
  const required = COLORS.reduce((n, c) => n + (need[c] ?? 0), 0) + need.generic;
  while (COLORS.reduce((n, c) => n + (pool[c] ?? 0), 0) < required) { const l = untapped()[0]; if (!l) return null; tap(l); }
  next = { ...next, [player]: { ...next[player], pool } };
  return canPay(pool, cost) ? next : null;
}

/** Casts a card from hand (paying from the pool) onto the stack. The caller has checked legality. */
export function castFor(s: GameState, player: Player, uid: string, target?: StackItem["target"]): GameState {
  const card = handCard(s, player, uid);
  if (!card) return s;
  const item: StackItem = target ? { uid, card: card.id, caster: player, target } : { uid, card: card.id, caster: player };
  const next: GameState = {
    ...s,
    [player]: { ...s[player], hand: s[player].hand.filter((u) => u !== uid), pool: pay(s[player].pool, card.cost) },
    stack: [...s.stack, item],
  };
  const tgt = target?.kind === "permanent" ? ` targeting ${name(s, target.uid)}` : target?.kind === "spell" ? ` in response, targeting ${name(s, target.uid)}` : "";
  return log(next, `${who(player)} cast${player === "you" ? "" : "s"} ${card.name}${tgt}. It goes on the stack.`);
}

export const resolveStackTop = (s: GameState): GameState => resolveTop(s);

/** Locks in the current blocks and moves to the damage step (both players may still cast instants). */
export function lockBlocks(s: GameState): GameState {
  const blocks = Object.entries(s.attackers).filter(([, b]) => b);
  const next: GameState = { ...s, pendingBlocker: null, step: "damage" };
  return log(next, blocks.length ? `Blocks: ${blocks.map(([a, b]) => `${name(s, b as string)} blocks ${name(s, a)}`).join("; ")}.` : (s.turn === "you" ? "Your opponent doesn't block." : "You don't block."));
}

/** Deals combat damage (first strike, then regular) and moves to the second main phase. */
export function dealDamage(s: GameState): GameState {
  let next = dealCombatDamage(s, true);
  if (next.result) return next;
  next = dealCombatDamage(next, false);
  return { ...emptyPools(next), step: "main2", attackers: next.result ? next.attackers : {} };
}

/** Ends a player's turn: cleanup (CR 514). */
export function endTurnFor(s: GameState, player: Player): GameState {
  let next = emptyPools(s);
  next = { ...next, battlefield: next.battlefield.map((p) => ({ ...p, damage: 0, pump: { power: 0, toughness: 0 }, deathtouched: false })), step: "end", attackers: {}, selectedAttackers: [], pendingBlocker: null, pendingTarget: null };
  return log(next, `${who(player)} end${player === "you" ? "" : "s"} ${whose(player)} turn. Damage wears off and until-end-of-turn effects end.`);
}

/** A player attacks with the given creatures: they tap (unless Vigilance) and the defender chooses blocks. */
export function attackWith(s: GameState, player: Player, uids: string[]): GameState {
  const attackers: Record<string, null> = {};
  for (const u of uids) attackers[u] = null;
  const next: GameState = {
    ...emptyPools(s),
    turn: player,
    step: "blockers",
    attackers,
    selectedAttackers: [],
    pendingBlocker: null,
    battlefield: s.battlefield.map((p) => (attackers[p.uid] !== undefined && !has(p, "Vigilance") ? { ...p, tapped: true } : p)),
  };
  let out = log(next, `${who(player)} attack${player === "you" ? "" : "s"} with ${uids.map((u) => name(s, u)).join(" and ")}.${player === "opp" ? " Choose your blockers." : ""}`);
  // Attack triggers (resolved right away on this table; in a real game they use the stack).
  const atk = out.battlefield.filter((p) => attackers[p.uid] !== undefined);
  for (const p of out.battlefield.filter((x) => x.owner === player)) {
    if (hasAbility(p, "linden-lifegain")) {
      const n = atk.filter((a) => def(a.card).color === "W").length;
      if (n) out = log({ ...out, [player]: { ...out[player], life: out[player].life + n } }, `${def(p.card).name} triggers ${n} time${n === 1 ? "" : "s"}: ${player === "you" ? "you gain" : "your opponent gains"} ${n} life.`);
    }
  }
  for (const a of atk) {
    if (hasAbility(a, "syralin-anthem")) {
      out = { ...out, battlefield: out.battlefield.map((x) => (x.owner === player && x.uid !== a.uid && isCreature(x) ? { ...x, pump: { power: x.pump.power + 1, toughness: x.pump.toughness + 1 } } : x)) };
      out = log(out, `${def(a.card).name} triggers: ${player === "you" ? "your" : "their"} other creatures get +1/+1 until end of turn.`);
    }
    if (hasAbility(a, "dwynen-lifegain")) {
      const n = atk.filter((x) => hasSubtype(x, "Elf")).length;
      out = log({ ...out, [player]: { ...out[player], life: out[player].life + n } }, `${def(a.card).name} triggers: ${n} attacking Elf${n === 1 ? "" : "s"}, so ${player === "you" ? "you gain" : "your opponent gains"} ${n} life.`);
    }
  }
  return out;
}

/** Casts a player's commander from the command zone, paying the taxed cost from the pool (CR 903.8). */
export function castCommanderFor(s: GameState, player: Player): GameState {
  const cz = s[player].commandZone;
  if (!cz || !cz.inZone) return s;
  const cost = commanderCost(s, player) ?? "";
  const uid = newUid("cmd");
  const item: StackItem = { uid, card: cz.card, caster: player, fromCommandZone: true };
  const next: GameState = {
    ...s,
    cards: { ...s.cards, [uid]: cz.card },
    [player]: { ...s[player], pool: pay(s[player].pool, cost), commandZone: { card: cz.card, casts: cz.casts + 1, inZone: false } },
    stack: [...s.stack, item],
  };
  return log(next, `${who(player)} cast${player === "you" ? "" : "s"} ${def(cz.card).name} from the command zone for ${cost}${cz.casts ? ` (commander tax: ${2 * cz.casts} extra)` : ""}. It goes on the stack.`);
}

/* ---------- the reducer (the learner's actions) ---------- */

export function reduce(state: GameState, action: Action): GameState {
  const s: GameState = { ...state, refusal: null };
  if (s.result) return refuse(s, "This game is over. Start again to keep practising.");
  const me: Player = "you";

  switch (action.type) {
    case "playLand": {
      const card = handCard(s, me, action.uid);
      if (!card) return refuse(s, "That card isn't in your hand.");
      if (card.kind !== "land") return refuse(s, `${card.name} isn't a land. To use it, cast it (it costs mana).`);
      if (s.turn !== me || (s.step !== "main1" && s.step !== "main2")) return refuse(s, "You can only play a land during your own main phase.");
      if (s.stack.length) return refuse(s, "Something is waiting on the stack. Let it resolve first.");
      if (s.you.landPlayedThisTurn) return refuse(s, "You've already played a land this turn. It's one land per turn.");
      return playLandFor(s, me, action.uid);
    }

    case "tapForMana": {
      const p = find(s, action.uid);
      if (!p || p.owner !== me) return refuse(s, "That isn't one of your cards.");
      if (!isLand(p)) return refuse(s, `${def(p.card).name} isn't a land, so it doesn't make mana.`);
      if (p.tapped) return refuse(s, `${def(p.card).name} is already tapped. It untaps at the start of your next turn.`);
      const color = def(p.card).color;
      return log({
        ...s,
        battlefield: s.battlefield.map((x) => (x.uid === p.uid ? { ...x, tapped: true } : x)),
        you: { ...s.you, pool: { ...s.you.pool, [color]: (s.you.pool[color] ?? 0) + 1 } },
      }, `You tap ${def(p.card).name} for one ${colorName(color)} mana.`);
    }

    case "cast": {
      const card = handCard(s, me, action.uid);
      if (!card) return refuse(s, "That card isn't in your hand.");
      if (card.kind === "land") return refuse(s, `${card.name} is a land. You play lands; you don't cast them. Tap it in your hand to play it.`);
      if (card.kind === "creature") {
        if (s.turn !== me || (s.step !== "main1" && s.step !== "main2")) return refuse(s, "Creatures can only be cast during your own main phase.");
        if (s.stack.length) return refuse(s, "Something is waiting on the stack. Creatures can only be cast when the stack is empty.");
      }
      if (!canPay(s.you.pool, card.cost)) {
        const could = canPay(availableMana(s, me), card.cost);
        return refuse(s, could
          ? `${card.name} costs ${card.cost}. Tap your lands first to put mana in your pool, then cast it.`
          : `You don't have enough mana for ${card.name} (it costs ${card.cost}). You need more lands, or lands of the right colour.`);
      }
      const counters = card.effect === "counter" || card.effect === "counterNoncreature";
      if (card.kind === "instant" && !counters && !s.pendingTarget) {
        if (!s.battlefield.some(isCreature)) return refuse(s, `${card.name} needs a creature to target, and there are no creatures on the battlefield.`);
        return { ...s, pendingTarget: action.uid };
      }
      if (counters) {
        const target = s.stack[s.stack.length - 1];
        if (!target || target.caster === me) return refuse(s, `${card.name} needs a spell to counter. Cast it in response, while your opponent's spell is on the stack.`);
        if (card.effect === "counterNoncreature" && def(target.card).kind === "creature") return refuse(s, `${card.name} says "noncreature spell", and ${def(target.card).name} is a creature spell. It can't counter that.`);
        return castFor(s, me, action.uid, { kind: "spell", uid: target.uid });
      }
      return castFor(s, me, action.uid);
    }

    case "castCommander": {
      const cz = s.you.commandZone;
      if (!cz || !cz.inZone) return refuse(s, "Your commander isn't in the command zone right now.");
      if (s.turn !== me || (s.step !== "main1" && s.step !== "main2")) return refuse(s, "Creatures, including your commander, can only be cast during your own main phase.");
      if (s.stack.length) return refuse(s, "Something is waiting on the stack. Creatures can only be cast when the stack is empty.");
      const cost = commanderCost(s, me) ?? "";
      if (!canPay(s.you.pool, cost)) {
        const could = canPay(availableMana(s, me), cost);
        return refuse(s, could
          ? `${def(cz.card).name} costs ${cost} right now${cz.casts ? ` (that includes the commander tax of ${2 * cz.casts})` : ""}. Tap your lands first, then cast it.`
          : `You don't have enough mana for ${def(cz.card).name}. It costs ${cost} right now${cz.casts ? `, because of the commander tax` : ""}.`);
      }
      return castCommanderFor(s, me);
    }

    case "chooseTarget": {
      if (!s.pendingTarget) return refuse(s, "No spell is waiting for a target.");
      const card = handCard(s, me, s.pendingTarget);
      if (!card) return { ...s, pendingTarget: null };
      const t = action.target;
      if (t.kind !== "permanent") return refuse(s, `${card.name} targets a creature.`);
      const p = find(s, t.uid);
      if (!p || !isCreature(p)) return refuse(s, `${card.name} needs a creature as its target.`);
      return castFor({ ...s, pendingTarget: null }, me, s.pendingTarget, t);
    }

    case "cancelTarget":
      return { ...s, pendingTarget: null };

    case "pass": {
      if (!s.stack.length) return refuse(s, "Nothing is on the stack right now.");
      return resolveTop(s);
    }

    case "goToCombat": {
      if (s.turn !== me || s.step !== "main1") return refuse(s, "You can only move to combat from your first main phase, on your turn.");
      if (s.stack.length) return refuse(s, "Let the stack resolve first.");
      return log({ ...emptyPools(s), step: "attackers", selectedAttackers: [] }, "Combat begins. Choose your attackers.");
    }

    case "toggleAttacker": {
      if (s.step !== "attackers" || s.turn !== me) return refuse(s, "You choose attackers during your declare-attackers step.");
      const p = find(s, action.uid);
      if (!p || p.owner !== me) return refuse(s, "That isn't one of your creatures.");
      if (!isCreature(p)) return refuse(s, `${def(p.card).name} isn't a creature, so it can't attack.`);
      if (s.selectedAttackers.includes(p.uid)) return { ...s, selectedAttackers: s.selectedAttackers.filter((u) => u !== p.uid) };
      if (p.tapped) return refuse(s, `${def(p.card).name} is tapped. Tapped creatures can't attack.`);
      if (p.summoningSick && !has(p, "Haste")) return refuse(s, `${def(p.card).name} has summoning sickness: it arrived this turn, so it can't attack yet. (Haste would let it.)`);
      return { ...s, selectedAttackers: [...s.selectedAttackers, p.uid] };
    }

    case "declareAttackers": {
      if (s.step !== "attackers" || s.turn !== me) return refuse(s, "It isn't the declare-attackers step.");
      if (s.selectedAttackers.length === 0) return log({ ...s, step: "main2", attackers: {} }, "You don't attack this turn.");
      return attackWith(s, me, s.selectedAttackers);
    }

    case "skipCombat": {
      if (s.turn !== me || s.step !== "main1") return refuse(s, "You can only skip combat from your first main phase.");
      return log({ ...emptyPools(s), step: "main2" }, "You skip combat this turn.");
    }

    case "pickBlocker": {
      if (s.step !== "blockers" || s.turn === me) return refuse(s, "You choose blockers when your opponent attacks you.");
      const p = find(s, action.uid);
      if (!p || p.owner !== me || !isCreature(p)) return refuse(s, "That isn't one of your creatures.");
      if (p.tapped) return refuse(s, `${def(p.card).name} is tapped. Only untapped creatures can block.`);
      const already = Object.entries(s.attackers).find(([, b]) => b === p.uid);
      if (already) {
        return { ...s, attackers: { ...s.attackers, [already[0]]: null }, pendingBlocker: null };
      }
      return { ...s, pendingBlocker: s.pendingBlocker === p.uid ? null : p.uid };
    }

    case "assignBlock": {
      if (s.step !== "blockers" || s.turn === me) return refuse(s, "You choose blockers when your opponent attacks you.");
      if (!s.pendingBlocker) return refuse(s, "First tap one of your untapped creatures, then tap the attacker it should block.");
      const b = find(s, s.pendingBlocker);
      const a = find(s, action.attackerUid);
      if (!b || !a || s.attackers[a.uid] === undefined) return refuse(s, "Tap an attacking creature to block it.");
      if (!canBlock(b, a)) return refuse(s, `${def(a.card).name} has Flying. Only creatures with Flying or Reach can block it.`);
      if (s.attackers[a.uid]) return refuse(s, `${def(a.card).name} is already blocked. (On this table, one blocker per attacker.)`);
      return { ...s, attackers: { ...s.attackers, [a.uid]: b.uid }, pendingBlocker: null };
    }

    case "declareBlockers": {
      if (s.step !== "blockers") return refuse(s, "It isn't the declare-blockers step.");
      return lockBlocks(s);
    }

    case "dealDamage": {
      if (s.step !== "damage") return refuse(s, "It isn't the combat damage step.");
      if (s.stack.length) return refuse(s, "Let the stack resolve first.");
      return dealDamage(s);
    }

    case "endTurn": {
      if (s.turn !== me) return refuse(s, "It isn't your turn.");
      if (s.stack.length) return refuse(s, "Let the stack resolve first.");
      if (s.step === "attackers" || s.step === "blockers" || s.step === "damage") return refuse(s, "Finish combat first.");
      return endTurnFor(s, me);
    }
  }
}

/** Starts the learner's turn (scenario scripts and the match runner call this). */
export const beginYourTurn = (s: GameState): GameState => beginTurn(s, "you");

const emptyPlayer = (life: number, hand: string[], library: string[]): PlayerState => ({ life, hand, library, graveyard: [], landPlayedThisTurn: false, pool: {} });

/** Builds a starting state from a simple description. */
export function makeState(init: {
  turn?: Player;
  step?: Step;
  turnNumber?: number;
  you?: { life?: number; hand?: string[]; library?: string[]; battlefield?: (string | { card: string; tapped?: boolean; sick?: boolean })[] };
  opp?: { life?: number; hand?: string[]; library?: string[]; battlefield?: (string | { card: string; tapped?: boolean; sick?: boolean })[] };
}): GameState {
  const cards: Record<string, string> = {};
  const hand = (list: string[] | undefined) => (list ?? []).map((c) => { const uid = newUid("h"); cards[uid] = c; return uid; });
  const bf = (owner: Player, list: NonNullable<typeof init.you>["battlefield"]): Permanent[] =>
    (list ?? []).map((item) => {
      const spec = typeof item === "string" ? { card: item } : item;
      return { ...newPermanent(newUid("p"), spec.card, owner, !!spec.sick), tapped: !!spec.tapped };
    });
  const youHand = hand(init.you?.hand);
  const oppHand = hand(init.opp?.hand);
  return refreshStatics({
    turn: init.turn ?? "you",
    step: init.step ?? "main1",
    turnNumber: init.turnNumber ?? 1,
    you: emptyPlayer(init.you?.life ?? 20, youHand, init.you?.library ?? []),
    opp: emptyPlayer(init.opp?.life ?? 20, oppHand, init.opp?.library ?? []),
    battlefield: [...bf("you", init.you?.battlefield), ...bf("opp", init.opp?.battlefield)],
    stack: [],
    cards,
    attackers: {},
    selectedAttackers: [],
    pendingBlocker: null,
    pendingTarget: null,
    log: [],
    refusal: null,
    result: null,
  });
}

/** Puts an opponent's spell on the stack from nowhere (scenario scripts use this for "respond" practice). */
export function opponentCasts(s: GameState, card: string, target?: StackItem["target"]): GameState {
  const uid = newUid("o");
  const item: StackItem = target ? { uid, card, caster: "opp", target } : { uid, card, caster: "opp" };
  const t = target?.kind === "permanent" ? ` targeting your ${name(s, target.uid)}` : "";
  return log({ ...s, stack: [...s.stack, item] }, `Your opponent casts ${def(card).name}${t}. It's on the stack: you can respond.`);
}

/** The opponent attacks with the given permanents (scenario scripts and ai.ts). */
export const opponentAttacks = (s: GameState, uids: string[]): GameState => attackWith(s, "opp", uids);
