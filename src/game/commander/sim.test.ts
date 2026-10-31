// Four computer players play whole games with the real decks. Checks the engine never breaks its own
// rules: cards are conserved, life and counts stay sane, every game ends with one winner.
import { describe, expect, it } from "vitest";
import { CCARDS } from "./cards";
import { CDECKS, deckSummary } from "./decks";
import { aiStep, autoBlocksForHuman, runUntilHuman } from "./ai";
import { newGame, player, reduce, type CState } from "./engine";

function start(seed: number): CState {
  return newGame({ seed, seats: CDECKS.map((d, i) => ({ id: `p${i + 1}`, name: ["You", "Mara", "Theo", "Ines"][i]!, human: i === 0, commander: d.commander, deck: d.cards })) });
}

function cardCount(s: CState): number {
  let n = s.battlefield.filter((p) => !s.tokens[p.card]).length + s.stack.length;
  for (const seat of s.seats) { const p = player(s, seat); n += p.hand.length + p.library.length + p.graveyard.length + p.exile.length + (p.commandZone.inZone ? 1 : 0); }
  for (const p of s.battlefield) n += (p.exiled ?? []).length;
  return n;
}

/** Plays the human seat with the same rules of thumb as the computers. */
function humanAuto(s: CState): CState {
  let st = s;
  if (st.pending) return reduce(st, { type: "cancelTarget" });
  if (st.stack.length) return reduce(st, { type: "pass" });
  if (st.turn !== st.human) { if (st.step === "blockers") return autoBlocksForHuman(st); return st; }
  // Let the computer logic drive the human's turn by temporarily pretending the seat isn't human.
  const fake: CState = { ...st, human: "nobody" };
  const next = aiStep(fake);
  return { ...next, human: st.human };
}

describe("four-player Commander simulation", () => {
  it("decks are 99 cards plus a commander, singleton except basics, inside the colour identity", () => {
    for (const d of CDECKS) {
      expect(d.cards).toHaveLength(99);
      const seen = new Map<string, number>();
      for (const id of d.cards) { seen.set(id, (seen.get(id) ?? 0) + 1); expect([...CCARDS[id]!.colors].every((c) => d.identity.includes(c))).toBe(true); }
      for (const [id, n] of seen) if (n > 1) expect(CCARDS[id]!.type.startsWith("Basic Land")).toBe(true);
      const sum = deckSummary(d);
      expect(sum.lands).toBeGreaterThanOrEqual(34);
      expect(sum.lands).toBeLessThanOrEqual(42);
    }
  });

  it("plays 6 whole games to a single winner without breaking invariants", () => {
    for (let seed = 1; seed <= 6; seed++) {
      let s = start(seed * 7919);
      const total = cardCount(s);
      let steps = 0;
      while (!s.winner && steps < 6000) {
        const before = s;
        s = runUntilHuman(s);
        if (!s.winner) s = humanAuto(s);
        if (s === before) s = runUntilHuman(aiStep(s), 1);
        expect(s.refusal).toBeNull();
        expect(cardCount(s)).toBe(total);
        for (const seat of s.seats) { const p = player(s, seat); expect(p.hand.length).toBeGreaterThanOrEqual(0); if (!p.out) expect(p.life).toBeGreaterThan(-100); }
        for (const p of s.battlefield) expect(p.damage).toBeGreaterThanOrEqual(0);
        if (s === before) break;
        steps++;
      }
      expect(s.winner, `seed ${seed}: ${s.log.slice(-5).join(" | ")} turn ${s.turnNumber}`).not.toBeNull();
      expect(s.turnNumber).toBeGreaterThan(8);
    }
  });
});
