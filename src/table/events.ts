// Turns two engine states into a list of things that happened, in a stable order.
// The engine never emits events (it's a pure reducer), so the table derives them by diffing.
import { def, type Action, type GameState, type Player, type Step } from "../game/engine";

export type Zone = "hand" | "library" | "stack" | "battlefield" | "graveyard" | "command";

/** Who an event belongs to: "you" / "opp" on the two-player table, a seat id on the four-player table. */
export type Who = string;

export type TableEvent =
  | { kind: "drew"; player: Who; count: number }
  | { kind: "spellCast"; uid: string; card: string; caster: Who; target?: string | undefined }
  | { kind: "cardMoved"; uid: string; card: string; from: Zone; to: Zone; owner: Who }
  | { kind: "countered"; uid: string; card: string; owner: Who }
  | { kind: "tapped"; uid: string; card: string; owner: Who; tapped: boolean }
  | { kind: "attack"; attackers: string[]; by: Who }
  | { kind: "block"; attacker: string; blocker: string }
  | { kind: "lifeChanged"; player: Who; from: number; to: number }
  | { kind: "creatureDamaged"; uid: string; card: string; amount: number }
  | { kind: "destroyed"; uid: string; card: string; owner: Who; toCommandZone: boolean }
  | { kind: "turnChanged"; turn: Who; step: Step }
  | { kind: "coach"; text: string; undoable: boolean }
  | { kind: "result"; result: "win" | "lose"; reason: string };

const zoneOf = (s: GameState, uid: string): Zone | null => {
  if (s.you.hand.includes(uid) || s.opp.hand.includes(uid)) return "hand";
  if (s.stack.some((x) => x.uid === uid)) return "stack";
  if (s.battlefield.some((p) => p.uid === uid)) return "battlefield";
  return null;
};
const ownerOf = (s: GameState, uid: string): Player => (s.opp.hand.includes(uid) || s.stack.find((x) => x.uid === uid)?.caster === "opp" || s.battlefield.find((p) => p.uid === uid)?.owner === "opp" ? "opp" : "you");
const cardOf = (s: GameState, uid: string): string => s.cards[uid] ?? s.stack.find((x) => x.uid === uid)?.card ?? s.battlefield.find((p) => p.uid === uid)?.card ?? "";

/** Everything that changed between two states, in the order it should be shown. */
export function diff(before: GameState, after: GameState, action?: Action): TableEvent[] {
  const out: TableEvent[] = [];
  const newLog = after.log.slice(before.log.length);

  // Draws: new hand uids that didn't exist before.
  for (const player of ["you", "opp"] as Player[]) {
    const fresh = after[player].hand.filter((u) => !before.cards[u] && !before[player].hand.includes(u));
    if (fresh.length) out.push({ kind: "drew", player, count: fresh.length });
  }

  // Spells cast: hand (or command zone) -> stack.
  for (const item of after.stack) {
    if (before.stack.some((x) => x.uid === item.uid)) continue;
    const t = item.target;
    const targetUid = t && t.kind !== "player" ? t.uid : undefined;
    out.push({ kind: "spellCast", uid: item.uid, card: item.card, caster: item.caster, target: targetUid });
  }

  // Stack items that left: resolved onto the battlefield, resolved to the graveyard, or countered.
  for (const item of [...before.stack].reverse()) { // top of the stack resolves first
    if (after.stack.some((x) => x.uid === item.uid)) continue;
    const name = def(item.card).name;
    if (after.battlefield.some((p) => p.uid === item.uid)) { out.push({ kind: "cardMoved", uid: item.uid, card: item.card, from: "stack", to: "battlefield", owner: item.caster }); continue; }
    const countered = newLog.some((l) => l.includes(`${name} is countered`));
    if (countered) out.push({ kind: "countered", uid: item.uid, card: item.card, owner: item.caster });
    else out.push({ kind: "cardMoved", uid: item.uid, card: item.card, from: "stack", to: item.fromCommandZone ? "command" : "graveyard", owner: item.caster });
  }

  // Lands played straight from hand to the battlefield.
  for (const p of after.battlefield) {
    if (before.battlefield.some((x) => x.uid === p.uid)) continue;
    if (zoneOf(before, p.uid) === "hand") out.push({ kind: "cardMoved", uid: p.uid, card: p.card, from: "hand", to: "battlefield", owner: p.owner });
  }

  // Tapped / untapped.
  for (const p of after.battlefield) {
    const b = before.battlefield.find((x) => x.uid === p.uid);
    if (b && b.tapped !== p.tapped) out.push({ kind: "tapped", uid: p.uid, card: p.card, owner: p.owner, tapped: p.tapped });
  }

  // Attacks and blocks.
  const beforeAttackers = Object.keys(before.attackers);
  const afterAttackers = Object.keys(after.attackers);
  const newAttackers = afterAttackers.filter((u) => !beforeAttackers.includes(u));
  if (newAttackers.length) out.push({ kind: "attack", attackers: newAttackers, by: after.turn });
  for (const [a, b] of Object.entries(after.attackers)) {
    if (b && before.attackers[a] !== b && after.step !== "main2") out.push({ kind: "block", attacker: a, blocker: b });
  }

  // Creature damage marked this step.
  for (const p of after.battlefield) {
    const b = before.battlefield.find((x) => x.uid === p.uid);
    if (b && p.damage > b.damage) out.push({ kind: "creatureDamaged", uid: p.uid, card: p.card, amount: p.damage - b.damage });
  }

  // Life totals.
  for (const player of ["you", "opp"] as Player[]) {
    if (before[player].life !== after[player].life) out.push({ kind: "lifeChanged", player, from: before[player].life, to: after[player].life });
  }

  // Destroyed creatures (left the battlefield without going anywhere we track).
  for (const p of before.battlefield) {
    if (after.battlefield.some((x) => x.uid === p.uid)) continue;
    const cz = after[p.owner].commandZone;
    const toCommandZone = !!p.isCommander && !!cz && cz.inZone && cz.card === p.card;
    out.push({ kind: "destroyed", uid: p.uid, card: p.card, owner: p.owner, toCommandZone });
  }

  if (before.turn !== after.turn || before.step !== after.step) out.push({ kind: "turnChanged", turn: after.turn, step: after.step });

  if (after.result && !before.result) {
    const reason = newLog.find((l) => /life is 0|empty library|can't draw|21 or more/.test(l)) ?? (after.result === "win" ? "Your opponent is out of life." : "Your life reached 0.");
    out.push({ kind: "result", result: after.result, reason });
  }
  void action; void ownerOf; void cardOf;
  return out;
}

/** One plain sentence for screen readers (and the log) summarising a batch of events. */
export function announce(events: TableEvent[], state: GameState): string {
  const name = (uid: string, card: string) => def(card).name || uid;
  const bits: string[] = [];
  for (const e of events) {
    switch (e.kind) {
      case "spellCast": bits.push(`${e.caster === "you" ? "You cast" : "Your opponent casts"} ${name(e.uid, e.card)}.`); break;
      case "cardMoved": if (e.to === "battlefield") bits.push(`${name(e.uid, e.card)} enters the battlefield${e.owner === "opp" ? " on their side" : ""}.`); break;
      case "countered": bits.push(`${name(e.uid, e.card)} is countered.`); break;
      case "attack": bits.push(`${e.by === "you" ? "You attack" : "Your opponent attacks"} with ${e.attackers.map((u) => name(u, state.battlefield.find((p) => p.uid === u)?.card ?? "")).join(" and ")}.`); break;
      case "lifeChanged": bits.push(`${e.player === "you" ? "You" : "Your opponent"} ${e.to < e.from ? "lose" : "gain"}${e.player === "you" ? "" : "s"} ${Math.abs(e.to - e.from)} life, now ${e.to}.`); break;
      case "destroyed": bits.push(`${name(e.uid, e.card)} is destroyed${e.toCommandZone ? " and returns to the command zone" : ""}.`); break;
      case "turnChanged": if (e.step === "main1") bits.push(e.turn === "you" ? "Your turn." : "Your opponent's turn."); break;
      case "result": bits.push(e.result === "win" ? "You win." : "You lose this game."); break;
      case "coach": bits.push(e.text); break;
      default: break;
    }
  }
  return bits.join(" ");
}
