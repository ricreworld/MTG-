// The three computer players. Simple, readable rules of thumb and no look-ahead: play a land, cast the
// commander or the best creature, remove the scariest creature, attack the player who is winning when it
// is safe, block sensibly. Each turn runs one step at a time (aiStep), so the table can pause whenever
// the human may respond or has to block. Every decision is written to the game log with a "Why".
import { hasFlash, isAura, isEquipment, manaValue, type CDef } from "./cards";
import {
  activated, activateFor, allBlocksIn, autoTargets, blockWith, canActivate, canAfford, canAttack, canBlock, candidates, castFor, commanderCost, dealDamage, def, endTurnFor, find, has, isCreature, isLand, isMain, log, opponentsOf, player, playLandFor, power, resolveTop, targetSpecs, threat, toughness, attackWith, type CState, type Perm, type Seat,
} from "./engine";

const why = (s: CState, text: string): CState => log(s, `(Why: ${text})`);
const mine = (s: CState, seat: Seat) => s.battlefield.filter((p) => p.controller === seat);
const creatures = (s: CState, list: Perm[]) => list.filter((p) => isCreature(s, p));
const handOf = (s: CState, seat: Seat) => player(s, seat).hand.map((uid) => ({ uid, card: def(s, s.cards[uid] ?? "") }));

function kills(s: CState, a: Perm, b: Perm): boolean { if (power(s, a) <= 0) return false; if (has(s, b, "Indestructible")) return false; return has(s, a, "Deathtouch") || power(s, a) >= toughness(s, b) - b.damage; }
function survives(s: CState, a: Perm, b: Perm): boolean { if ((has(s, a, "First strike") || has(s, a, "Double strike")) && !has(s, b, "First strike") && !has(s, b, "Double strike") && kills(s, a, b)) return true; return !kills(s, b, a); }

/** The opponent this seat should pressure: the biggest threat, or anyone it can finish. */
export function pickDefender(s: CState, seat: Seat, incoming: number): Seat {
  const foes = opponentsOf(s, seat);
  const finish = foes.find((f) => player(s, f).life <= incoming);
  if (finish) return finish;
  return [...foes].sort((a, b) => threat(s, b) - threat(s, a))[0]!;
}

/** Play a land: one that adds a colour we're missing, else any. */
function playLand(s: CState, seat: Seat): CState | null {
  const hand = handOf(s, seat).filter((h) => h.card.kind === "land");
  if (!hand.length || player(s, seat).landsPlayed >= 1) return null;
  const have = new Set(mine(s, seat).flatMap((p) => def(s, p.card).abilities.flatMap((a) => a.effects?.[0]?.colors ?? [])));
  const identity = def(s, player(s, seat).commandZone.card).colors;
  const score = (c: CDef) => { const cols = c.abilities.flatMap((a) => a.effects?.[0]?.colors ?? []).filter((x) => identity.includes(x)); const missing = cols.filter((x) => !have.has(x)).length; return missing * 3 + cols.length - (c.abilities.some((a) => a.kind === "entersTapped") ? 1 : 0); };
  const pick = [...hand].sort((a, b) => score(b.card) - score(a.card))[0]!;
  return playLandFor(s, seat, pick.uid);
}

/** The best thing to cast this main phase, or null. */
function castSomething(s: CState, seat: Seat): CState | null {
  const hand = handOf(s, seat).filter((h) => h.card.kind !== "land");
  const foes = opponentsOf(s, seat);
  const enemyCreatures = creatures(s, s.battlefield.filter((p) => foes.includes(p.controller)));
  const biggest = [...enemyCreatures].sort((a, b) => power(s, b) + (b.isCommander ? 3 : 0) - power(s, a) - (a.isCommander ? 3 : 0))[0];
  // 1. Removal on a real threat.
  const removal = hand.filter((h) => h.card.kind !== "creature" && h.card.abilities.some((a) => a.kind === "spell" && a.effects?.some((e) => ["destroy", "exile", "exileUntilLeaves", "damage", "bounce"].includes(e.op))) || (h.card.kind === "enchantment" && h.card.abilities.some((a) => a.kind === "triggered" && a.effects?.some((e) => e.op === "exileUntilLeaves"))));
  if (biggest && power(s, biggest) >= 3) {
    for (const h of removal.filter((h) => canAfford(s, seat, h.card.cost) && (h.card.kind === "instant" || h.card.kind === "sorcery" || h.card.kind === "enchantment"))) {
      const effects = h.card.abilities.find((a) => a.kind === "spell")?.effects ?? h.card.abilities.find((a) => a.kind === "triggered")?.effects ?? [];
      const targets = autoTargets(s, effects, seat, null, h.card.colors);
      if (!targets) continue;
      if (h.card.kind === "enchantment") { const r = castFor(s, seat, { kind: "hand", uid: h.uid }, []); if (r) return why(r, `${def(s, biggest.card).name} is the biggest threat on the table.`); continue; }
      const hitsBiggest = targets.some((t) => t.kind === "perm" && t.uid === biggest.uid);
      if (!hitsBiggest && !effects.some((e) => e.op === "wipe")) continue;
      const r = castFor(s, seat, { kind: "hand", uid: h.uid }, targets);
      if (r) return why(r, `${def(s, biggest.card).name} is the biggest threat on the table.`);
    }
  }
  // 2. The commander, when it's affordable.
  const cz = player(s, seat).commandZone;
  const cmdCost = commanderCost(s, seat);
  if (cz.inZone && cmdCost !== null && canAfford(s, seat, cmdCost)) { const r = castFor(s, seat, { kind: "commander" }, []); if (r) return why(r, "The commander is the deck's leader, and it's always available from the command zone."); }
  // 3. The most expensive creature (or artifact / enchantment that isn't an aura) it can afford.
  const perms = hand.filter((h) => (h.card.kind === "creature" || h.card.kind === "artifact" || (h.card.kind === "enchantment" && !isAura(h.card))) && canAfford(s, seat, h.card.cost)).sort((a, b) => manaValue(b.card.cost) - manaValue(a.card.cost));
  const best = perms[0];
  if (best) { const r = castFor(s, seat, { kind: "hand", uid: best.uid }, []); if (r) return why(r, `${best.card.name} is the strongest card it can afford this turn.`); }
  // 4. An aura on its best creature.
  const aura = hand.find((h) => isAura(h.card) && canAfford(s, seat, h.card.cost));
  const own = creatures(s, mine(s, seat)).sort((a, b) => power(s, b) - power(s, a))[0];
  if (aura && own) { const r = castFor(s, seat, { kind: "hand", uid: aura.uid }, [{ kind: "perm", uid: own.uid }]); if (r) return why(r, `${def(s, own.card).name} is its best creature, so the aura goes there.`); }
  // 5. Card draw / ramp sorceries.
  const value = hand.filter((h) => h.card.kind === "sorcery" && canAfford(s, seat, h.card.cost) && h.card.abilities.some((a) => a.kind === "spell" && a.effects?.some((e) => ["draw", "rampTapped", "token", "reanimate", "regrow"].includes(e.op))));
  for (const h of value) { const effects = h.card.abilities.find((a) => a.kind === "spell")?.effects ?? []; const targets = autoTargets(s, effects, seat, null, h.card.colors); if (!targets) continue; const r = castFor(s, seat, { kind: "hand", uid: h.uid }, targets); if (r) return why(r, "Extra cards and mana win long games."); }
  return null;
}

/** Equip, or use a useful activated ability (sorcery speed ones only in main phases). */
function useAbility(s: CState, seat: Seat): CState | null {
  for (const p of mine(s, seat)) {
    for (const { index, ability } of activated(s, p)) {
      if (!canActivate(s, seat, p, ability)) continue;
      const d = def(s, p.card);
      if (ability.kind === "equip") {
        const target = creatures(s, mine(s, seat)).filter((x) => x.uid !== p.attachedTo && !x.summoningSick).sort((a, b) => power(s, b) - power(s, a))[0];
        if (!target || (p.attachedTo && find(s, p.attachedTo))) continue;
        const r = activateFor(s, seat, p.uid, index, [{ kind: "perm", uid: target.uid }]);
        if (r) return why(r, `${d.name} makes ${def(s, target.card).name} stronger.`);
        continue;
      }
      const cost = typeof ability.cost === "object" ? ability.cost : {};
      if (cost.sacrificeSelf || cost.sacrificeCreature) {
        // Only sacrifice when the creature would die anyway or it's a pure value piece like Evolving Wilds / Food at low life.
        const eff = ability.effects?.[0];
        const ok = isLand(s, p) || (eff?.op === "gainLife" && player(s, seat).life <= 15) || (isCreature(s, p) && p.damage >= toughness(s, p));
        if (!ok) continue;
      }
      const targets = autoTargets(s, ability.effects ?? [], seat, p.uid, d.colors);
      if (!targets) continue;
      if (targetSpecs(ability.effects).length && !targets.length) continue;
      const r = activateFor(s, seat, p.uid, index, targets);
      if (r) return why(r, `${d.name}'s ability is worth using now.`);
    }
  }
  return null;
}

/** Attack planning: each eligible creature attacks the chosen defender when it's reasonably safe. */
function chooseAttacks(s: CState, seat: Seat): Record<string, Seat> {
  const out: Record<string, Seat> = {};
  const ready = creatures(s, mine(s, seat)).filter((p) => canAttack(s, p));
  if (!ready.length) return out;
  const totalPower = ready.reduce((n, p) => n + power(s, p), 0);
  const defender = pickDefender(s, seat, totalPower);
  const blockers = creatures(s, s.battlefield.filter((p) => p.controller === defender && !p.tapped && !p.bonus.cantBlock));
  const lethal = player(s, defender).life <= totalPower && blockers.length === 0;
  for (const a of ready) {
    if (a.bonus.mustAttack) { out[a.uid] = defender; continue; }
    const canBeBlocked = blockers.filter((b) => canBlock(s, b, a));
    const risky = canBeBlocked.some((b) => kills(s, b, a) && survives(s, b, a)) && !(has(s, a, "Menace") && canBeBlocked.length < 2);
    const safe = !risky || lethal || (a.isCommander && power(s, a) >= 5 && canBeBlocked.length <= 1);
    if (safe) out[a.uid] = defender;
  }
  // Keep one blocker home if other players have a scary board and we'd be left open.
  const keep = Object.keys(out).length === ready.length && ready.length > 1 && opponentsOf(s, seat).some((f) => f !== defender && creatures(s, s.battlefield.filter((p) => p.controller === f)).reduce((n, p) => n + power(s, p), 0) >= player(s, seat).life / 2);
  if (keep) { const smallest = [...ready].filter((p) => out[p.uid]).sort((a, b) => power(s, a) - power(s, b))[0]; if (smallest) delete out[smallest.uid]; }
  return out;
}

/** Blocks for one defending seat: trade up, chump only when the hit would be deadly or huge. */
export function chooseBlocks(s: CState, defender: Seat): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const incoming = Object.entries(s.attackers).filter(([, a]) => a.defender === defender).map(([uid]) => find(s, uid)).filter((p): p is Perm => !!p).sort((a, b) => power(s, b) - power(s, a));
  const available = creatures(s, mine(s, defender)).filter((p) => !p.tapped && !p.bonus.cantBlock && !p.cantBlockEOT && !p.bonus.pacified);
  const used = new Set<string>();
  const life = player(s, defender).life;
  const total = incoming.reduce((n, p) => n + power(s, p), 0);
  for (const a of incoming) {
    const options = available.filter((b) => !used.has(b.uid) && canBlock(s, b, a));
    const need = has(s, a, "Menace") ? 2 : 1;
    if (options.length < need) continue;
    const good = options.filter((b) => kills(s, b, a) && survives(s, b, a));
    const trade = options.filter((b) => kills(s, b, a));
    const wall = options.filter((b) => survives(s, b, a));
    let pick: Perm[] = [];
    if (good.length >= need) pick = good.slice(0, need);
    else if (need === 1 && wall.length) pick = [wall[0]!];
    else if (need === 1 && trade.length && (power(s, a) >= 4 || a.isCommander)) pick = [trade.sort((x, y) => power(s, x) - power(s, y))[0]!];
    else if (life - total <= 8 && options.length >= need) pick = [...options].sort((x, y) => power(s, x) + toughness(s, x) - power(s, y) - toughness(s, y)).slice(0, need); // chump to stay alive
    else if (need === 2 && good.length + wall.length >= 2) pick = [...good, ...wall].slice(0, 2);
    if (pick.length >= need) { out[a.uid] = pick.map((p) => p.uid); for (const p of pick) used.add(p.uid); }
  }
  return out;
}

/** Counter a dangerous spell when it can. */
export function aiRespond(s: CState): CState {
  const top = s.stack[s.stack.length - 1];
  if (!top) return s;
  for (const seat of opponentsOf(s, top.caster).filter((x) => !player(s, x).human)) {
    const d = def(s, top.card);
    const worth = top.fromCommandZone || manaValue(d.cost) >= 4 || d.kind === "sorcery";
    if (!worth) continue;
    const counters = handOf(s, seat).filter((h) => h.card.kind === "instant" && h.card.abilities.some((a) => a.kind === "spell" && a.effects?.some((e) => e.op === "counter")) && canAfford(s, seat, h.card.cost));
    for (const h of counters) {
      const effects = h.card.abilities.find((a) => a.kind === "spell")?.effects ?? [];
      const spec = targetSpecs(effects)[0]?.spec ?? "spell";
      const cands = candidates(s, spec, seat, null, h.card.colors).filter((t): t is { kind: "spell"; uid: string } => t.kind === "spell" && t.uid === top.uid);
      if (!cands.length) continue;
      const r = castFor(s, seat, { kind: "hand", uid: h.uid }, [cands[0]!]);
      if (r) return why(r, `${d.name} is worth stopping.`);
    }
  }
  return s;
}

/** Does the human have an instant they could cast in response right now? */
export function humanCanRespond(s: CState): boolean {
  const me = s.human;
  if (player(s, me).out) return false;
  return player(s, me).hand.some((uid) => { const d = def(s, s.cards[uid] ?? ""); return (d.kind === "instant" || hasFlash(d)) && canAfford(s, me, d.cost) && targetSpecs(d.abilities.find((a) => a.kind === "spell")?.effects).every((sp) => sp.optional || candidates(s, sp.spec, me, null, d.colors).length > 0); });
}

/** Where a computer turn has to stop and wait for the human. */
export function needsHuman(s: CState): boolean {
  if (s.winner) return false;
  if (s.stack.length) { const top = s.stack[s.stack.length - 1]!; if (top.caster !== s.human && humanCanRespond(s)) return true; if (top.caster === s.human) return true; }
  if (s.step === "blockers" && s.turn !== s.human && Object.values(s.attackers).some((a) => a.defender === s.human) && !s.blocksDone.includes(s.human)) return true;
  return false;
}

/**
 * One small step of a computer player's turn (or of resolving the stack). Returns the same state when
 * nothing is left to do, which the caller treats as "the turn is over".
 */
export function aiStep(s: CState): CState {
  if (s.winner) return s;
  // Resolve the stack first: computer players respond at most once, then everything resolves top-down.
  if (s.stack.length) {
    const top = s.stack[s.stack.length - 1]!;
    if (!(top.responses ?? 0)) { const r = aiRespond({ ...s, stack: s.stack.map((x) => (x.uid === top.uid ? { ...x, responses: 1 } : x)) }); if (r.stack.length > s.stack.length) return r; return resolveTop(r); }
    return resolveTop(s);
  }
  const seat = s.turn;
  // Blocks are declared by the defenders, whoever's turn it is.
  if (s.step === "blockers" && !allBlocksIn(s)) {
    for (const d of [...new Set(Object.values(s.attackers).map((a) => a.defender))]) {
      if (s.blocksDone.includes(d) || player(s, d).out) continue;
      if (d === s.human) return s;
      return blockWith(s, d, chooseBlocks(s, d));
    }
  }
  if (seat === s.human || player(s, seat).out) return s;
  switch (s.step) {
    case "main1": {
      return playLand(s, seat) ?? castSomething(s, seat) ?? useAbility(s, seat) ?? goToCombat(s, seat);
    }
    case "attackers": {
      const plan = chooseAttacks(s, seat);
      if (!Object.keys(plan).length) return log({ ...s, step: "main2", attackers: {}, selectedAttackers: [] }, `${player(s, seat).name} doesn't attack.`);
      const r = attackWith(s, plan);
      const defenders = [...new Set(Object.values(plan))];
      return why(r, defenders.map((d) => (d === s.human ? "you look like the biggest threat right now" : `${player(s, d).name} looks like the biggest threat right now`)).join("; ") + ".");
    }
    case "blockers": return allBlocksIn(s) ? dealDamage(s) : s;
    case "damage": return dealDamage(s);
    case "main2": {
      return castSomething(s, seat) ?? useAbility(s, seat) ?? endTurnFor(s, seat);
    }
    case "end": return endTurnFor(s, seat);
    default: return s;
  }
}

function goToCombat(s: CState, seat: Seat): CState {
  const ready = creatures(s, mine(s, seat)).filter((p) => canAttack(s, p));
  if (!ready.length) return { ...s, step: "main2" };
  return { ...s, step: "attackers", selectedAttackers: [], attackers: {} };
}

/** Runs computer players until the human is needed, the human's turn starts, or the game ends. */
export function runUntilHuman(s: CState, maxSteps = 400): CState {
  let st = s;
  for (let i = 0; i < maxSteps; i++) {
    if (st.winner || needsHuman(st)) return st;
    if (st.turn === st.human && !st.stack.length) return st;
    if (st.turn === st.human && st.stack.length && st.stack[st.stack.length - 1]!.caster === st.human) return st;
    const next = aiStep(st);
    if (next === st) return st;
    st = next;
  }
  return st;
}

/** The human's blockers when the human is a computer (used by tests that let four computers play). */
export const autoBlocksForHuman = (s: CState): CState => (s.step === "blockers" && Object.values(s.attackers).some((a) => a.defender === s.human) && !s.blocksDone.includes(s.human) ? blockWith(s, s.human, chooseBlocks(s, s.human)) : s);

export { isMain, isEquipment };
