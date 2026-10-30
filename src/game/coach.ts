// The free-play coach: before each decision it suggests a move and says why; after a move it points out
// a clearly weaker choice (never a scolding, always with Undo available). Pure functions over GameState.
import { manaValue } from "./cards";
import {
  availableMana,
  canBlock,
  canPay,
  def,
  has,
  isCreature,
  power,
  toughness,
  type Action,
  type GameState,
  type Permanent,
} from "./engine";

export interface Advice {
  move: string;
  why: string;
}

const yours = (s: GameState) => s.battlefield.filter((p) => p.owner === "you");
const theirs = (s: GameState) => s.battlefield.filter((p) => p.owner === "opp");
const creatures = (list: Permanent[]) => list.filter(isCreature);
const hand = (s: GameState) => s.you.hand.map((uid) => ({ uid, card: def(s.cards[uid] ?? "") }));
const kills = (a: Permanent, b: Permanent) => power(a) > 0 && (has(a, "Deathtouch") || power(a) >= toughness(b) - b.damage);
const survives = (a: Permanent, b: Permanent) => (has(a, "First strike") && !has(b, "First strike") && kills(a, b)) || !kills(b, a);
const names = (list: Permanent[]) => list.map((p) => def(p.card).name).join(" and ");

/** Creatures of yours that can attack without being blocked and killed for free. */
export function safeAttackers(s: GameState): Permanent[] {
  const ready = creatures(yours(s)).filter((p) => !p.tapped && (!p.summoningSick || has(p, "Haste")));
  const blockers = creatures(theirs(s)).filter((p) => !p.tapped);
  return ready.filter((a) => !blockers.some((b) => canBlock(b, a) && kills(b, a) && survives(b, a)));
}

/** The best block for each attacker: kill and survive, else a fair trade, else a chump block only if facing lethal. */
export function suggestedBlocks(s: GameState): { attacker: Permanent; blocker: Permanent | null; why: string }[] {
  const attackers = Object.keys(s.attackers).map((uid) => s.battlefield.find((p) => p.uid === uid)).filter((p): p is Permanent => !!p);
  const free = creatures(yours(s)).filter((p) => !p.tapped);
  const used = new Set<string>();
  const incoming = attackers.reduce((n, a) => n + power(a), 0);
  const lethal = incoming >= s.you.life;
  return [...attackers].sort((x, y) => power(y) - power(x)).map((a) => {
    const options = free.filter((b) => !used.has(b.uid) && canBlock(b, a));
    const good = options.find((b) => kills(b, a) && survives(b, a));
    const trade = options.find((b) => kills(b, a) && manaValue(def(a.card).cost) >= manaValue(def(b.card).cost));
    const chump = lethal ? [...options].sort((x, y) => manaValue(def(x.card).cost) - manaValue(def(y.card).cost))[0] : undefined;
    const pick = good ?? trade ?? chump ?? null;
    if (pick) used.add(pick.uid);
    const why = good ? `${def(good.card).name} destroys ${def(a.card).name} and survives.`
      : trade ? `${def(trade.card).name} and ${def(a.card).name} destroy each other: a fair trade.`
      : chump ? `You'd lose the game otherwise, so ${def(chump.card).name} blocks to soak up the damage.`
      : options.length ? `No block wins here. Take ${power(a)} damage rather than lose a creature for nothing.`
      : `Nothing of yours can block ${def(a.card).name}${has(a, "Flying") ? " (it has Flying)" : ""}.`;
    return { attacker: a, blocker: pick, why };
  });
}

/** What the coach suggests right now, or null when there's nothing to decide. */
export function advise(s: GameState): Advice | null {
  if (s.result) return null;
  const top = s.stack[s.stack.length - 1];
  if (top) {
    if (top.caster === "you") return { move: "Pass, so your spell resolves.", why: "Your opponent didn't respond. Passing lets the top of the stack happen." };
    const spell = def(top.card);
    const counter = hand(s).find((h) => (h.card.effect === "counter" || (h.card.effect === "counterNoncreature" && spell.kind !== "creature")) && canPay(availableMana(s, "you"), h.card.cost));
    const t = top.target;
    const target = t?.kind === "permanent" ? s.battlefield.find((p) => p.uid === t.uid) : undefined;
    const hurts = (target && target.owner === "you") || (spell.kind === "creature" && manaValue(spell.cost) >= 3);
    if (counter && hurts) return { move: `Counter ${spell.name} with ${counter.card.name}.`, why: target ? `${spell.name} is aimed at your ${def(target.card).name}. Tap your lands, cast ${counter.card.name}, then pass so it resolves first.` : `${spell.name} is a strong card. Stopping it now is worth a card.` };
    return { move: `Pass, and let ${spell.name} resolve.`, why: counter ? `You could counter it, but save ${counter.card.name} for something bigger.` : "You have no instant that helps here, so passing is fine." };
  }
  if (s.turn === "opp") {
    if (s.step === "blockers") {
      const plan = suggestedBlocks(s);
      const blocks = plan.filter((b) => b.blocker);
      const move = blocks.length ? blocks.map((b) => `${def(b.blocker!.card).name} blocks ${def(b.attacker.card).name}`).join("; ") + "." : "No blocks this time.";
      return { move, why: plan.map((b) => b.why).join(" ") };
    }
    return null;
  }
  const mana = availableMana(s, "you");
  const cards = hand(s);
  if (s.step === "main1" || s.step === "main2") {
    const land = cards.find((h) => h.card.kind === "land");
    if (land && !s.you.landPlayedThisTurn) return { move: `Play ${land.card.name}.`, why: "One land per turn is free, and more lands mean bigger spells later. Do this before anything else." };
    const castable = cards.filter((h) => h.card.kind === "creature" && canPay(mana, h.card.cost)).sort((a, b) => manaValue(b.card.cost) - manaValue(a.card.cost));
    if (castable[0]) return { move: `Cast ${castable[0].card.name}.`, why: `It's the biggest creature you can afford (${castable[0].card.cost}). Unused mana does nothing, so spend it.${s.step === "main1" && safeAttackers(s).length ? " You can attack first and cast it after combat, which hides your plan." : ""}` };
    if (s.step === "main1") {
      const safe = safeAttackers(s);
      const ready = creatures(yours(s)).filter((p) => !p.tapped && (!p.summoningSick || has(p, "Haste")));
      if (safe.length) return { move: `Go to combat and attack with ${names(safe)}.`, why: safe.length === ready.length ? "No blocker of theirs can destroy these and survive, so attacking is free damage." : `The rest would be blocked and destroyed for nothing, so keep them home.` };
      if (ready.length) return { move: "Skip combat this turn.", why: "Each of your creatures would be blocked and destroyed without winning the fight. Build up first." };
      return { move: "Skip combat, then end your turn.", why: "No creature of yours can attack yet." };
    }
    return { move: "End your turn.", why: "Nothing more to do this turn. Your creatures untap at the start of your next one." };
  }
  if (s.step === "attackers") {
    const safe = safeAttackers(s);
    if (!safe.length) return { move: "Don't attack.", why: "Every attack here loses a creature for nothing." };
    return { move: `Attack with ${names(safe)}.`, why: "These can't be blocked and destroyed for free." };
  }
  if (s.step === "blockers") return { move: "Continue to damage.", why: "Their blocks are set. If you have Giant Growth and the mana, you could cast it on a blocked creature first." };
  if (s.step === "damage") return { move: "Continue to damage.", why: "Combat damage happens now." };
  return null;
}

/** After a legal move: a short note when it was clearly weaker than the alternative, or null. */
export function critique(before: GameState, after: GameState, action: Action): string | null {
  if (before.result || after.result) return null;
  if (action.type === "endTurn" || action.type === "goToCombat" || action.type === "skipCombat") {
    const land = hand(before).find((h) => h.card.kind === "land");
    if (land && !before.you.landPlayedThisTurn && action.type === "endTurn") return `You ended the turn with ${land.card.name} still in hand. A land each turn is free and is how you grow. Undo and play it first.`;
  }
  if (action.type === "endTurn") {
    const mana = availableMana(before, "you");
    const castable = hand(before).filter((h) => h.card.kind === "creature" && canPay(mana, h.card.cost));
    if (castable[0]) return `You could still cast ${castable[0].card.name} this turn. Mana you don't use is wasted. Undo and cast it.`;
  }
  if (action.type === "declareAttackers") {
    const chosen = before.selectedAttackers.map((uid) => before.battlefield.find((p) => p.uid === uid)).filter((p): p is Permanent => !!p);
    const safe = new Set(safeAttackers(before).map((p) => p.uid));
    const risky = chosen.filter((p) => !safe.has(p.uid));
    const lethal = chosen.reduce((n, p) => n + power(p), 0) >= before.opp.life;
    if (risky.length && !lethal) return `${names(risky)} can be blocked and destroyed without taking a blocker with it. Undo if you'd rather keep it home.`;
    const missed = safeAttackers(before).filter((p) => !chosen.some((c) => c.uid === p.uid));
    if (missed.length && chosen.length < safeAttackers(before).length) return `${names(missed)} could attack safely too. Undo to add it, or keep it back as a blocker if you're worried about their attack.`;
  }
  if (action.type === "declareBlockers") {
    for (const [a, b] of Object.entries(before.attackers)) {
      if (!b) continue;
      const attacker = before.battlefield.find((p) => p.uid === a)!;
      const blocker = before.battlefield.find((p) => p.uid === b)!;
      const incoming = Object.keys(before.attackers).reduce((n, uid) => n + power(before.battlefield.find((p) => p.uid === uid)!), 0);
      if (kills(attacker, blocker) && !kills(blocker, attacker) && incoming < before.you.life) return `${def(blocker.card).name} would be destroyed by ${def(attacker.card).name} without destroying it. Undo and let that one through, or block with something stronger.`;
    }
    const plan = suggestedBlocks(before);
    const missedGood = plan.filter((p) => p.blocker && !before.attackers[p.attacker.uid] && kills(p.blocker, p.attacker) && survives(p.blocker, p.attacker));
    if (missedGood[0]) return `${def(missedGood[0].blocker!.card).name} could block ${def(missedGood[0].attacker.card).name}, destroy it and survive. Undo to set that block.`;
  }
  if (action.type === "pass" && before.stack.length === 1 && before.stack[0]?.caster === "opp") {
    const a = advise(before);
    if (a && a.move.startsWith("Counter")) return `${a.move} ${a.why} Undo if you'd like to.`;
  }
  return null;
}
