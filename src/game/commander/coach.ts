// The coach at the four-player table: who is the threat, what to do now, and why. Plain language, one idea.
import { manaValue } from "./cards";
import { canAttack, canPlayLand, castable, commanderCost, canAfford, def, isCreature, isMain, opponentsOf, player, power, threat, toughness, type CState, type Seat } from "./engine";
import { planAdvice, planOf } from "./primer";

export interface Advice { move: string; why: string }

export function threatOrder(s: CState): Seat[] { return [...opponentsOf(s, s.human)].sort((a, b) => threat(s, b) - threat(s, a)); }

export function advise(s: CState): Advice | null {
  const base = adviseBase(s);
  if (!base) return null;
  // One deck-specific line in the "why", when the deck's plan has something to say in a main phase.
  if (s.turn === s.human && isMain(s) && !s.stack.length && !s.pending) { const extra = planAdvice(planOf(s, s.human), s, s.human); if (extra) return { ...base, why: `${base.why} ${extra}` }; }
  return base;
}

function adviseBase(s: CState): Advice | null {
  const me = s.human;
  if (s.winner || player(s, me).out) return null;
  const pl = player(s, me);
  const foes = threatOrder(s);
  const top = foes[0];
  const topName = top ? player(s, top).name : "";
  const mine = s.battlefield.filter((p) => p.controller === me);
  const myCreatures = mine.filter((p) => isCreature(s, p));
  if (s.pending) return { move: `Choose a target for ${s.pending.cardName}.`, why: "Tap a highlighted card or player. The best target is usually the biggest creature on the most dangerous side." };
  if (s.stack.length) { const topSpell = s.stack[s.stack.length - 1]!; if (topSpell.caster !== me) return { move: `Let ${def(s, topSpell.card).name} happen unless you hold a counterspell you can afford.`, why: "Counterspells are precious with three opponents. Save them for a commander or a big spell." }; return { move: "Continue to let your spell happen.", why: "Nobody responded, so it resolves." }; }
  if (s.turn !== me) {
    if (s.step === "blockers" && Object.values(s.attackers).some((a) => a.defender === me)) return { move: "Block when one of your creatures can destroy the attacker and survive. Otherwise take the damage.", why: "You start at 40 life, so small hits are fine. Losing a creature for nothing is not." };
    return { move: "Watch the other players. Your turn comes round clockwise.", why: "With four players, think about who is winning while you wait." };
  }
  if (s.step === "main1" || s.step === "main2") {
    const lands = pl.hand.filter((u) => def(s, s.cards[u] ?? "").kind === "land");
    if (lands.length && canPlayLand(s, me)) return { move: "Play a land first.", why: "One land per turn, and every land is more mana for the rest of the game." };
    const cz = pl.commandZone;
    const cost = commanderCost(s, me);
    if (cz.inZone && cost !== null && canAfford(s, me, cost) && !s.stack.length) return { move: `Cast your commander, ${def(s, cz.card).name}.`, why: "It's the strongest card you always have access to, and attacking with it threatens commander damage." };
    const can = castable(s, me).filter((u) => def(s, s.cards[u] ?? "").kind !== "land").sort((a, b) => manaValue(def(s, s.cards[b] ?? "").cost) - manaValue(def(s, s.cards[a] ?? "").cost));
    if (can.length) { const d = def(s, s.cards[can[0]!] ?? ""); return { move: `Cast ${d.name}.`, why: d.kind === "creature" ? "More creatures on the table means more attacks and more blockers." : "Use your mana every turn; unspent mana is wasted." }; }
    if (s.step === "main1") {
      const ready = myCreatures.filter((p) => canAttack(s, p));
      if (ready.length && top) {
        const theirBlockers = s.battlefield.filter((p) => p.controller === top && isCreature(s, p) && !p.tapped);
        const safe = ready.filter((a) => !theirBlockers.some((b) => power(s, b) >= toughness(s, a) && toughness(s, b) > power(s, a)));
        if (safe.length) return { move: `Go to combat and attack ${topName} with ${safe.map((p) => def(s, p.card).name).join(", ")}.`, why: `${topName} looks closest to winning right now (board and life together). Attack the leader, not the person next to you.` };
        return { move: "Skip combat this turn.", why: `${topName}'s blockers would destroy your attackers and survive. Build up first.` };
      }
      return { move: "End your turn.", why: "Nothing useful is left to do." };
    }
    return { move: "End your turn.", why: "Nothing useful is left to do." };
  }
  if (s.step === "attackers") {
    if (!s.selectedAttackers.length && !Object.keys(s.attackers).length) return { move: `Tap the creatures that should attack, then tap ${topName} to send them there.`, why: "Each attacker can go at a different opponent, but focusing one player ends threats faster." };
    if (s.selectedAttackers.length) return { move: `Now tap the player they should attack: ${topName} is the biggest threat.`, why: "Attack the player who is winning." };
    return { move: "Confirm the attack.", why: "The chosen creatures tap and attack (vigilance creatures stay untapped)." };
  }
  if (s.step === "blockers" || s.step === "damage") return { move: "Continue to see the damage.", why: "Blocks are set; damage happens all at once (first strike first)." };
  return null;
}

/** Short threat summary per opponent for the seat cards. */
export function threatLabel(s: CState, seat: Seat): string {
  const order = threatOrder(s);
  const i = order.indexOf(seat);
  if (player(s, seat).out) return "Out of the game";
  if (i === 0 && order.length > 1) return "Biggest threat";
  if (i === order.length - 1 && order.length > 1) return "Least threatening";
  return "";
}

export { isMain };
