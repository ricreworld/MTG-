// The computer opponent for free play. Simple, readable rules of thumb, no randomness, no look-ahead:
// play a land, cast the biggest creature it can afford, remove a small creature, attack when it's safe,
// block sensibly, and use a combat trick or a counterspell when it clearly helps.
// Every decision is explained in the game log so the learner can see why it happened.
import { manaValue } from "./cards";
import {
  attackWith,
  availableMana,
  beginTurn,
  canBlock,
  canPay,
  castCommanderFor,
  castFor,
  commanderCost,
  dealDamage,
  def,
  endTurnFor,
  has,
  isCreature,
  playLandFor,
  power,
  tapLandsFor,
  toughness,
  type GameState,
  type Permanent,
} from "./engine";

const opp = "opp" as const;
const log = (s: GameState, line: string): GameState => ({ ...s, log: [...s.log, line] });
const handOf = (s: GameState) => s.opp.hand.map((uid) => ({ uid, card: def(s.cards[uid] ?? "") }));
const mine = (s: GameState) => s.battlefield.filter((p) => p.owner === opp);
const yours = (s: GameState) => s.battlefield.filter((p) => p.owner === "you");
const creatures = (list: Permanent[]) => list.filter(isCreature);

/** Would `a` kill `b` in a fight? (Combat damage, deathtouch, first strike.) */
function kills(a: Permanent, b: Permanent): boolean {
  if (power(a) <= 0) return false;
  return has(a, "Deathtouch") || power(a) >= toughness(b) - b.damage;
}
/** Does `a` survive a fight with `b`? */
function survives(a: Permanent, b: Permanent): boolean {
  if (has(a, "First strike") && !has(b, "First strike") && kills(a, b)) return true;
  return !kills(b, a);
}

/** Casts the one most useful spell it can afford in a main phase, or returns null when there's nothing worth casting. */
function castSomething(s: GameState): GameState | null {
  const mana = availableMana(s, opp);
  const hand = handOf(s);
  // Removal first when a small target exists (Stab kills toughness 2 or less).
  const stab = hand.find((h) => h.card.effect === "shrink2" && canPay(mana, h.card.cost));
  const victim = creatures(yours(s)).filter((p) => toughness(p) <= 2).sort((a, b) => power(b) - power(a))[0];
  if (stab && victim) {
    const tapped = tapLandsFor(s, opp, stab.card.cost);
    if (tapped) return log(castFor(tapped, opp, stab.uid, { kind: "permanent", uid: victim.uid }), `(Why: ${def(victim.card).name} has only ${toughness(victim)} toughness, so Stab destroys it.)`);
  }
  // Then the biggest creature it can afford, counting the commander in the command zone (with its tax).
  const cmdCost = commanderCost(s, opp);
  const creature = hand
    .filter((h) => h.card.kind === "creature" && canPay(mana, h.card.cost))
    .sort((a, b) => manaValue(b.card.cost) - manaValue(a.card.cost))[0];
  if (cmdCost && canPay(mana, cmdCost) && (!creature || manaValue(cmdCost) >= manaValue(creature.card.cost))) {
    const tapped = tapLandsFor(s, opp, cmdCost);
    if (tapped) return castCommanderFor(tapped, opp);
  }
  if (creature) {
    const tapped = tapLandsFor(s, opp, creature.card.cost);
    if (tapped) return castFor(tapped, opp, creature.uid);
  }
  return null;
}

/** Chooses attackers: creatures that can't be blocked and killed for free, or everything if that's lethal. */
function chooseAttackers(s: GameState): string[] {
  const attackers = creatures(mine(s)).filter((p) => !p.tapped && (!p.summoningSick || has(p, "Haste")));
  const blockers = creatures(yours(s)).filter((p) => !p.tapped);
  const totalPower = attackers.reduce((n, p) => n + power(p), 0);
  if (attackers.length && totalPower >= s.you.life && blockers.length < attackers.length) return attackers.map((p) => p.uid);
  return attackers
    .filter((a) => !blockers.some((b) => canBlock(b, a) && kills(b, a) && survives(b, a)))
    .map((p) => p.uid);
}

/** The opponent's blocks when the learner attacks: attacker uid -> blocker uid. */
export function chooseBlocks(s: GameState): Record<string, string> {
  const attackers = Object.keys(s.attackers).map((uid) => s.battlefield.find((p) => p.uid === uid)).filter((p): p is Permanent => !!p);
  const free = creatures(mine(s)).filter((p) => !p.tapped);
  const blocks: Record<string, string> = {};
  const incoming = attackers.reduce((n, a) => n + power(a), 0);
  const lethal = incoming >= s.opp.life;
  for (const a of [...attackers].sort((x, y) => power(y) - power(x))) {
    const options = free.filter((b) => !Object.values(blocks).includes(b.uid) && canBlock(b, a));
    // Best: kill it and survive. Next: trade when the attacker is worth at least as much. Last: chump block only when facing lethal.
    const good = options.find((b) => kills(b, a) && survives(b, a));
    const trade = options.find((b) => kills(b, a) && manaValue(def(a.card).cost) >= manaValue(def(b.card).cost));
    const chump = lethal ? options.sort((x, y) => manaValue(def(x.card).cost) - manaValue(def(y.card).cost))[0] : undefined;
    const pick = good ?? trade ?? chump;
    if (pick) blocks[a.uid] = pick.uid;
  }
  return blocks;
}

/** In the damage step: cast Giant Growth on its own creature if that turns a losing fight into a winning one. */
function combatTrick(s: GameState): GameState | null {
  const growth = handOf(s).find((h) => h.card.effect === "pump3");
  if (!growth || !canPay(availableMana(s, opp), growth.card.cost)) return null;
  for (const [aUid, bUid] of Object.entries(s.attackers)) {
    if (!bUid) continue;
    const a = s.battlefield.find((p) => p.uid === aUid);
    const b = s.battlefield.find((p) => p.uid === bUid);
    if (!a || !b) continue;
    const ours = a.owner === opp ? a : b.owner === opp ? b : null;
    const theirs = ours === a ? b : a;
    if (!ours) continue;
    const pumped: Permanent = { ...ours, pump: { power: ours.pump.power + 3, toughness: ours.pump.toughness + 3 } };
    const before = survives(ours, theirs) && kills(ours, theirs);
    const after = survives(pumped, theirs) && kills(pumped, theirs);
    if (!before && after) {
      const tapped = tapLandsFor(s, opp, growth.card.cost);
      if (tapped) return log(castFor(tapped, opp, growth.uid, { kind: "permanent", uid: ours.uid }), `(Why: with +3/+3, ${def(ours.card).name} wins its fight with ${def(theirs.card).name}.)`);
    }
  }
  return null;
}

/** When the learner casts a spell: counter it if that's clearly worth a card. */
export function maybeCounter(s: GameState): GameState {
  const top = s.stack[s.stack.length - 1];
  if (!top || top.caster !== "you") return s;
  const spell = def(top.card);
  const mana = availableMana(s, opp);
  const counters = handOf(s).filter((h) => (h.card.effect === "counter" || (h.card.effect === "counterNoncreature" && spell.kind !== "creature")) && canPay(mana, h.card.cost));
  if (!counters.length) return s;
  const t = top.target;
  const aimedAtUs = t?.kind === "permanent" && s.battlefield.find((p) => p.uid === t.uid)?.owner === opp;
  const worthIt = (spell.kind === "creature" && manaValue(spell.cost) >= 3) || (spell.kind === "instant" && aimedAtUs) || spell.effect === "counter" || spell.effect === "counterNoncreature";
  if (!worthIt) return s;
  const pick = counters.sort((a, b) => manaValue(a.card.cost) - manaValue(b.card.cost))[0]!;
  const tapped = tapLandsFor(s, opp, pick.card.cost);
  if (!tapped) return s;
  return log(castFor(tapped, opp, pick.uid, { kind: "spell", uid: top.uid }), `(Why: ${spell.name} is worth stopping, and ${pick.card.name} was ready.)`);
}

/**
 * Runs the opponent until the learner has something to decide: a spell to respond to (stack not empty),
 * blockers to choose, or the learner's own turn. Each loop step makes progress, so it always ends.
 */
export function runOpponent(input: GameState): GameState {
  let s = input;
  for (let guard = 0; guard < 60 && !s.result; guard++) {
    if (s.stack.length) return s; // the learner holds priority
    if (s.turn === "you") {
      if (s.step === "damage") {
        const trick = combatTrick(s);
        if (trick) return trick;
        s = dealDamage(s);
      }
      return s;
    }
    // Opponent's turn.
    switch (s.step) {
      case "end":
        return s;
      case "main1": {
        const land = handOf(s).find((h) => h.card.kind === "land");
        if (land && !s.opp.landPlayedThisTurn) { s = playLandFor(s, opp, land.uid); continue; }
        const cast = castSomething(s);
        if (cast) { s = cast; continue; }
        const attackers = chooseAttackers(s);
        if (attackers.length) { s = attackWith(s, opp, attackers); return s; } // learner chooses blocks
        s = log({ ...s, step: "main2" }, "Your opponent doesn't attack this turn.");
        continue;
      }
      case "blockers":
        return s; // waiting for the learner's blocks
      case "damage": {
        const trick = combatTrick(s);
        if (trick) return trick;
        s = dealDamage(s);
        continue;
      }
      case "attackers":
        s = { ...s, step: "main2" };
        continue;
      case "main2": {
        const cast = castSomething(s);
        if (cast) { s = cast; continue; }
        s = endTurnFor(s, opp);
        if (s.result) return s;
        s = beginTurn(s, "you");
        return s;
      }
    }
  }
  return s;
}
