// Diffs two four-player Commander states into TableEvents (the same event vocabulary the cue player uses),
// plus one plain sentence for screen readers.
import { def, find, nameOf, type CState } from "../game/commander/engine";
import type { TableEvent } from "./events";

export function cdiff(before: CState, after: CState): TableEvent[] {
  const out: TableEvent[] = [];
  const newLog = after.log.slice(before.log.length);
  for (const seat of after.seats) {
    const fresh = after.players[seat]!.hand.filter((u) => !before.cards[u]);
    if (fresh.length) out.push({ kind: "drew", player: seat, count: fresh.length });
  }
  for (const item of after.stack) {
    if (before.stack.some((x) => x.uid === item.uid)) continue;
    const t = item.targets[0];
    out.push({ kind: "spellCast", uid: item.uid, card: item.card, caster: item.caster, target: t && t.kind !== "player" ? t.uid : undefined });
  }
  for (const item of [...before.stack].reverse()) {
    if (after.stack.some((x) => x.uid === item.uid)) continue;
    const name = def(after, item.card).name;
    if (find(after, item.uid)) { out.push({ kind: "cardMoved", uid: item.uid, card: item.card, from: "stack", to: "battlefield", owner: item.caster }); continue; }
    if (newLog.some((l) => l.includes(`counters ${name}`))) out.push({ kind: "countered", uid: item.uid, card: item.card, owner: item.caster });
    else out.push({ kind: "cardMoved", uid: item.uid, card: item.card, from: "stack", to: item.fromCommandZone ? "command" : "graveyard", owner: item.caster });
  }
  for (const p of after.battlefield) {
    if (find(before, p.uid)) continue;
    if (before.seats.some((seat) => before.players[seat]!.hand.includes(p.uid))) out.push({ kind: "cardMoved", uid: p.uid, card: p.card, from: "hand", to: "battlefield", owner: p.controller });
  }
  for (const p of after.battlefield) { const b = find(before, p.uid); if (b && b.tapped !== p.tapped) out.push({ kind: "tapped", uid: p.uid, card: p.card, owner: p.controller, tapped: p.tapped }); }
  const newAttackers = Object.keys(after.attackers).filter((u) => !before.attackers[u] && after.step === "blockers");
  if (newAttackers.length) out.push({ kind: "attack", attackers: newAttackers, by: after.turn });
  for (const [a, rec] of Object.entries(after.attackers)) for (const b of rec.blockers) if (!before.attackers[a]?.blockers.includes(b) && after.step !== "main2") out.push({ kind: "block", attacker: a, blocker: b });
  for (const p of after.battlefield) { const b = find(before, p.uid); if (b && p.damage > b.damage) out.push({ kind: "creatureDamaged", uid: p.uid, card: p.card, amount: p.damage - b.damage }); }
  for (const seat of after.seats) { const a = after.players[seat]!.life, b = before.players[seat]!.life; if (a !== b) out.push({ kind: "lifeChanged", player: seat, from: b, to: a }); }
  for (const p of before.battlefield) {
    if (find(after, p.uid)) continue;
    const cz = after.players[p.owner]?.commandZone;
    out.push({ kind: "destroyed", uid: p.uid, card: p.card, owner: p.owner, toCommandZone: !!p.isCommander && !!cz && cz.inZone });
  }
  if (before.turn !== after.turn || before.step !== after.step) out.push({ kind: "turnChanged", turn: after.turn, step: after.step });
  if (after.winner && !before.winner) out.push({ kind: "result", result: after.winner === after.human ? "win" : "lose", reason: newLog.find((l) => /last player standing/.test(l)) ?? "" });
  return out;
}

export function cannounce(events: TableEvent[], s: CState): string {
  const who = (seat: string) => (seat === s.human ? "You" : nameOf(s, seat));
  const bits: string[] = [];
  for (const e of events) {
    switch (e.kind) {
      case "spellCast": bits.push(`${who(e.caster)} cast${e.caster === s.human ? "" : "s"} ${def(s, e.card).name}.`); break;
      case "cardMoved": if (e.to === "battlefield") bits.push(`${def(s, e.card).name} enters the battlefield${e.owner === s.human ? "" : ` for ${who(e.owner)}`}.`); break;
      case "countered": bits.push(`${def(s, e.card).name} is countered.`); break;
      case "attack": bits.push(`${who(e.by)} attack${e.by === s.human ? "" : "s"} with ${e.attackers.map((u) => def(s, find(s, u)?.card ?? "").name).filter(Boolean).join(" and ")}.`); break;
      case "lifeChanged": bits.push(`${who(e.player)} ${e.to < e.from ? "lose" : "gain"}${e.player === s.human ? "" : "s"} ${Math.abs(e.to - e.from)} life, now ${e.to}.`); break;
      case "destroyed": bits.push(`${def(s, e.card).name} leaves the battlefield${e.toCommandZone ? " and returns to the command zone" : ""}.`); break;
      case "turnChanged": if (e.step === "main1") bits.push(e.turn === s.human ? "Your turn." : `${who(e.turn)}'s turn.`); break;
      case "result": bits.push(e.result === "win" ? "You win the game." : "The game is over."); break;
      case "coach": bits.push(e.text); break;
      default: break;
    }
  }
  return bits.join(" ");
}
