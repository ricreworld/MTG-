// The Practice Table rules engine: a pure reducer. (state, action) -> new state.
// No React, no DOM, no randomness. Every state is immutable, so Undo is just "use the previous state".
//
// It implements the beginner rules taught in the course: lands and mana (CR 305, 106), casting
// creatures and instants (CR 302, 304), the stack with responses (CR 405, 117), combat with
// attackers, one blocker per attacker, simultaneous damage, first strike, flying/reach, trample,
// deathtouch and lifelink (CR 506-510, 702), summoning sickness (CR 302.6) and lethal damage (CR 704.5g).
//
// Simplifications (on purpose, for teaching): one blocker per attacker, no multiple blockers;
// the mana pool empties only when a step changes; the opponent is scripted by the scenario.
import { CARDS, parseCost, type CardDef, type Color } from "./cards";

export type Player = "you" | "opp";
export type Step = "main1" | "attackers" | "blockers" | "damage" | "main2" | "end";

export interface Permanent {
  uid: string;
  card: string; // CardDef id
  owner: Player;
  tapped: boolean;
  /** True until the controller has started a turn with it (summoning sickness). */
  summoningSick: boolean;
  damage: number;
  /** Temporary +X/+X until end of turn. */
  pump: { power: number; toughness: number };
  /** Hit by deathtouch damage this turn. */
  deathtouched: boolean;
}

export interface StackItem {
  uid: string;
  card: string;
  caster: Player;
  target?: { kind: "permanent"; uid: string } | { kind: "player"; player: Player } | { kind: "spell"; uid: string };
}

export interface PlayerState {
  life: number;
  hand: string[]; // card uids (see state.cards)
  landPlayedThisTurn: boolean;
  pool: Partial<Record<Color, number>>;
}

export interface GameState {
  turn: Player;
  step: Step;
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
  | { type: "endTurn" };

/* ---------- helpers ---------- */

export const def = (cardId: string): CardDef => {
  const c = CARDS[cardId];
  if (!c) throw new Error(`Unknown card ${cardId}`);
  return c;
};
export const power = (p: Permanent): number => (def(p.card).power ?? 0) + p.pump.power;
export const toughness = (p: Permanent): number => (def(p.card).toughness ?? 0) + p.pump.toughness;
export const has = (p: Permanent, kw: NonNullable<CardDef["keywords"]>[number]): boolean => def(p.card).keywords?.includes(kw) ?? false;
const isLand = (p: Permanent) => def(p.card).kind === "land";
const isCreature = (p: Permanent) => def(p.card).kind === "creature";
const find = (s: GameState, uid: string) => s.battlefield.find((p) => p.uid === uid);
const handCard = (s: GameState, player: Player, uid: string): CardDef | undefined => (s[player].hand.includes(uid) ? def(s.cards[uid] ?? "") : undefined);

export function canPay(pool: PlayerState["pool"], cost: string | undefined): boolean {
  const need = parseCost(cost);
  let spare = 0;
  for (const c of ["W", "U", "B", "R", "G"] as Color[]) {
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
  for (const c of ["W", "U", "B", "R", "G"] as Color[]) next[c] = (next[c] ?? 0) - (need[c] ?? 0);
  let generic = need.generic;
  for (const c of ["W", "U", "B", "R", "G"] as Color[]) {
    while (generic > 0 && (next[c] ?? 0) > 0) { next[c] = (next[c] ?? 0) - 1; generic--; }
  }
  for (const c of Object.keys(next) as Color[]) if (!next[c]) delete next[c];
  return next;
}

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
const name = (s: GameState, uid: string) => { const p = find(s, uid); return p ? def(p.card).name : def(s.cards[uid] ?? "").name; };

let uidCounter = 0;
export const newUid = (prefix = "c") => `${prefix}${++uidCounter}`;
export const resetUids = () => { uidCounter = 0; };

/** State-based actions (CR 704): lethal damage, deathtouch, life totals. */
function checkState(s: GameState): GameState {
  let next = s;
  for (const p of s.battlefield) {
    if (isCreature(p) && (p.damage >= toughness(p) || p.deathtouched || toughness(p) <= 0)) {
      next = { ...next, battlefield: next.battlefield.filter((x) => x.uid !== p.uid) };
      next = log(next, `${def(p.card).name} is destroyed and goes to the graveyard.`);
    }
  }
  if (next.opp.life <= 0 && !next.result) next = { ...log(next, "Your opponent's life is 0. You win!"), result: "win" };
  else if (next.you.life <= 0 && !next.result) next = { ...log(next, "Your life is 0."), result: "lose" };
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
  if (card.kind === "creature") {
    next = { ...next, battlefield: [...next.battlefield, { uid: item.uid, card: item.card, owner: item.caster, tapped: false, summoningSick: true, damage: 0, pump: { power: 0, toughness: 0 }, deathtouched: false }] };
    return log(next, `${card.name} resolves and enters the battlefield.`);
  }
  const t = item.target;
  if ((card.effect === "counter" || card.effect === "counterNoncreature") && t?.kind === "spell") {
    const victim = next.stack.find((x) => x.uid === t.uid);
    if (!victim) return log(next, `${card.name} has nothing to counter any more, so it does nothing.`);
    next = { ...next, stack: next.stack.filter((x) => x.uid !== t.uid) };
    return log(next, `${card.name} resolves: ${def(victim.card).name} is countered. It goes to the graveyard without happening.`);
  }
  if (card.effect === "pump3" && t?.kind === "permanent") {
    const p = find(next, t.uid);
    if (!p) return log(next, `${card.name}'s target is gone, so it does nothing.`);
    next = { ...next, battlefield: next.battlefield.map((x) => (x.uid === p.uid ? { ...x, pump: { power: x.pump.power + 3, toughness: x.pump.toughness + 3 } } : x)) };
    const after = find(next, t.uid);
    return log(next, `${card.name} resolves: ${def(p.card).name} is ${after ? power(after) : "?"}/${after ? toughness(after) : "?"} until end of turn.`);
  }
  if (card.effect === "shrink2" && t?.kind === "permanent") {
    const p = find(next, t.uid);
    if (!p) return log(next, `${card.name}'s target is gone, so it does nothing.`);
    next = { ...next, battlefield: next.battlefield.map((x) => (x.uid === p.uid ? { ...x, pump: { power: x.pump.power - 2, toughness: x.pump.toughness - 2 } } : x)) };
    const after = find(next, t.uid);
    return checkState(log(next, `${card.name} resolves: ${def(p.card).name} is ${after ? power(after) : "?"}/${after ? toughness(after) : "?"} until end of turn.`));
  }
  return log(next, `${card.name} resolves.`);
}

function dealCombatDamage(s: GameState, firstStrikeOnly: boolean): GameState {
  let next = s;
  const defender: Player = s.turn === "you" ? "opp" : "you";
  const strikes = (p: Permanent) => (firstStrikeOnly ? has(p, "First strike") : !has(p, "First strike"));
  const dmg: Record<string, number> = {};
  const dt: Record<string, boolean> = {};
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
      } else {
        let toBlocker = p;
        if (has(a, "Trample")) {
          const lethal = has(a, "Deathtouch") ? 1 : Math.max(0, toughness(b) - b.damage - (dmg[b.uid] ?? 0));
          toBlocker = Math.min(p, lethal);
          const over = p - toBlocker;
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
      if (has(b, "Lifelink")) { /* blocker's controller gains */ next = { ...next, [defender]: { ...next[defender], life: next[defender].life + p } }; lines.push(`Lifelink: ${defender === "you" ? "you gain" : "your opponent gains"} ${p} life.`); }
    }
  }
  if (lines.length === 0) return next;
  if (firstStrikeOnly) next = log(next, "First strike damage happens first.");
  next = { ...next, battlefield: next.battlefield.map((p) => ({ ...p, damage: p.damage + (dmg[p.uid] ?? 0), deathtouched: p.deathtouched || !!dt[p.uid] })) };
  if (toPlayer > 0) next = { ...next, [defender]: { ...next[defender], life: next[defender].life - toPlayer } };
  if (lifeGain > 0) { next = { ...next, [s.turn]: { ...next[s.turn], life: next[s.turn].life + lifeGain } }; lines.push(`Lifelink: ${s.turn === "you" ? "you gain" : "your opponent gains"} ${lifeGain} life.`); }
  for (const l of lines) next = log(next, l);
  return checkState(next);
}

/* ---------- the reducer ---------- */

export function reduce(state: GameState, action: Action): GameState {
  const s: GameState = { ...state, refusal: null };
  if (s.result) return refuse(s, "This game is over. Start the scenario again to keep practising.");
  const me: Player = "you";

  switch (action.type) {
    case "playLand": {
      const card = handCard(s, me, action.uid);
      if (!card) return refuse(s, "That card isn't in your hand.");
      if (card.kind !== "land") return refuse(s, `${card.name} isn't a land. To use it, cast it (it costs mana).`);
      if (s.turn !== me || (s.step !== "main1" && s.step !== "main2")) return refuse(s, "You can only play a land during your own main phase.");
      if (s.stack.length) return refuse(s, "Something is waiting on the stack. Let it resolve first.");
      if (s.you.landPlayedThisTurn) return refuse(s, "You've already played a land this turn. It's one land per turn.");
      return log({
        ...s,
        you: { ...s.you, hand: s.you.hand.filter((u) => u !== action.uid), landPlayedThisTurn: true },
        battlefield: [...s.battlefield, { uid: action.uid, card: card.id, owner: me, tapped: false, summoningSick: false, damage: 0, pump: { power: 0, toughness: 0 }, deathtouched: false }],
      }, `You play ${card.name}.`);
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
      }, `You tap ${def(p.card).name} for one ${color === "W" ? "white" : color === "U" ? "blue" : color === "B" ? "black" : color === "R" ? "red" : "green"} mana.`);
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
        return { ...s, pendingTarget: action.uid };
      }
      if (counters) {
        const target = s.stack[s.stack.length - 1];
        if (!target || target.caster === me) return refuse(s, `${card.name} needs a spell to counter. Cast it in response, while your opponent's spell is on the stack.`);
        if (card.effect === "counterNoncreature" && def(target.card).kind === "creature") return refuse(s, `${card.name} says "noncreature spell", and ${def(target.card).name} is a creature spell. It can't counter that.`);
        const next: GameState = {
          ...s,
          you: { ...s.you, hand: s.you.hand.filter((u) => u !== action.uid), pool: pay(s.you.pool, card.cost) },
          stack: [...s.stack, { uid: action.uid, card: card.id, caster: me, target: { kind: "spell", uid: target.uid } }],
        };
        return log(next, `You cast ${card.name} in response, targeting ${def(target.card).name}. It goes on top of the stack.`);
      }
      const next: GameState = {
        ...s,
        you: { ...s.you, hand: s.you.hand.filter((u) => u !== action.uid), pool: pay(s.you.pool, card.cost) },
        stack: [...s.stack, { uid: action.uid, card: card.id, caster: me }],
      };
      return log(next, `You cast ${card.name}. It goes on the stack.`);
    }

    case "chooseTarget": {
      if (!s.pendingTarget) return refuse(s, "No spell is waiting for a target.");
      const card = handCard(s, me, s.pendingTarget);
      if (!card) return { ...s, pendingTarget: null };
      const t = action.target;
      if (t.kind === "permanent") {
        const p = find(s, t.uid);
        if (!p || !isCreature(p)) return refuse(s, `${card.name} needs a creature as its target.`);
      }
      if (t.kind === "player") return refuse(s, `${card.name} targets a creature, not a player.`);
      if (t.kind === "spell") return refuse(s, `${card.name} can't target a spell.`);
      const next: GameState = {
        ...s,
        pendingTarget: null,
        you: { ...s.you, hand: s.you.hand.filter((u) => u !== s.pendingTarget), pool: pay(s.you.pool, card.cost) },
        stack: [...s.stack, { uid: s.pendingTarget, card: card.id, caster: me, target: t }],
      };
      return log(next, `You cast ${card.name} targeting ${name(s, t.uid)}. It goes on the stack.`);
    }

    case "cancelTarget":
      return { ...s, pendingTarget: null };

    case "pass": {
      if (!s.stack.length) return refuse(s, "Nothing is on the stack right now.");
      return log(resolveTop(s), "");
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
      const attackers: Record<string, null> = {};
      for (const u of s.selectedAttackers) attackers[u] = null;
      const next: GameState = {
        ...s,
        step: "blockers",
        attackers,
        selectedAttackers: [],
        battlefield: s.battlefield.map((p) => (attackers[p.uid] !== undefined && !has(p, "Vigilance") ? { ...p, tapped: true } : p)),
      };
      return log(next, `You attack with ${s.selectedAttackers.map((u) => name(s, u)).join(" and ")}.`);
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
      let next: GameState = { ...s, pendingBlocker: null, step: "damage" };
      const blocks = Object.entries(s.attackers).filter(([, b]) => b);
      next = log(next, blocks.length ? `Blocks: ${blocks.map(([a, b]) => `${name(s, b as string)} blocks ${name(s, a)}`).join("; ")}.` : (s.turn === me ? "Your opponent doesn't block." : "You don't block."));
      next = dealCombatDamage(next, true);
      if (next.result) return next;
      next = dealCombatDamage(next, false);
      return { ...next, step: "main2", attackers: next.result ? next.attackers : {} };
    }

    case "endTurn": {
      if (s.turn !== me) return refuse(s, "It isn't your turn.");
      if (s.stack.length) return refuse(s, "Let the stack resolve first.");
      let next = emptyPools(s);
      // Cleanup: damage wears off, pumps end (CR 514.2).
      next = { ...next, battlefield: next.battlefield.map((p) => ({ ...p, damage: 0, pump: { power: 0, toughness: 0 }, deathtouched: false })), step: "end" };
      return log(next, "You end your turn. Damage wears off and until-end-of-turn effects end.");
    }
  }
}

/** Starts the learner's turn: untap, clear summoning sickness (CR 502, 302.6). The scenario script calls this. */
export function beginYourTurn(s: GameState): GameState {
  const next: GameState = {
    ...s,
    turn: "you",
    step: "main1",
    attackers: {},
    selectedAttackers: [],
    pendingBlocker: null,
    you: { ...s.you, landPlayedThisTurn: false, pool: {} },
    battlefield: s.battlefield.map((p) => (p.owner === "you" ? { ...p, tapped: false, summoningSick: false } : p)),
  };
  return log(next, "Your turn. Your cards untap.");
}

/** Builds a starting state from a simple description. */
export function makeState(init: {
  turn?: Player;
  step?: Step;
  you?: { life?: number; hand?: string[]; battlefield?: (string | { card: string; tapped?: boolean; sick?: boolean })[] };
  opp?: { life?: number; hand?: string[]; battlefield?: (string | { card: string; tapped?: boolean; sick?: boolean })[] };
}): GameState {
  const cards: Record<string, string> = {};
  const hand = (list: string[] | undefined) => (list ?? []).map((c) => { const uid = newUid("h"); cards[uid] = c; return uid; });
  const bf = (owner: Player, list: NonNullable<typeof init.you>["battlefield"]): Permanent[] =>
    (list ?? []).map((item) => {
      const spec = typeof item === "string" ? { card: item } : item;
      return { uid: newUid("p"), card: spec.card, owner, tapped: !!spec.tapped, summoningSick: !!spec.sick, damage: 0, pump: { power: 0, toughness: 0 }, deathtouched: false };
    });
  const youHand = hand(init.you?.hand);
  const oppHand = hand(init.opp?.hand);
  return {
    turn: init.turn ?? "you",
    step: init.step ?? "main1",
    you: { life: init.you?.life ?? 20, hand: youHand, landPlayedThisTurn: false, pool: {} },
    opp: { life: init.opp?.life ?? 20, hand: oppHand, landPlayedThisTurn: false, pool: {} },
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
  };
}

/** Puts an opponent's spell on the stack (the scenario script uses this for "respond" practice). */
export function opponentCasts(s: GameState, card: string, target?: StackItem["target"]): GameState {
  const uid = newUid("o");
  const item: StackItem = target ? { uid, card, caster: "opp", target } : { uid, card, caster: "opp" };
  const t = target?.kind === "permanent" ? ` targeting your ${name(s, target.uid)}` : "";
  return log({ ...s, stack: [...s.stack, item] }, `Your opponent casts ${def(card).name}${t}. It's on the stack: you can respond.`);
}

/** The opponent attacks with the given permanents (scenario script). */
export function opponentAttacks(s: GameState, uids: string[]): GameState {
  const attackers: Record<string, null> = {};
  for (const u of uids) attackers[u] = null;
  const next: GameState = {
    ...s,
    turn: "opp",
    step: "blockers",
    attackers,
    battlefield: s.battlefield.map((p) => (attackers[p.uid] !== undefined && !has(p, "Vigilance") ? { ...p, tapped: true } : p)),
  };
  return log(next, `Your opponent attacks with ${uids.map((u) => name(s, u)).join(" and ")}. Choose your blockers.`);
}
