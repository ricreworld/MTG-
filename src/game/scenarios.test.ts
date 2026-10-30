import { beforeEach, describe, expect, it } from "vitest";
import { reduce, resetUids, type GameState } from "./engine";
import { SCENARIOS, scenarioById } from "./scenarios";

beforeEach(resetUids);

const bf = (s: GameState, card: string, owner: "you" | "opp" = "you") => s.battlefield.find((p) => p.card === card && p.owner === owner)!;
const inHand = (s: GameState, card: string) => s.you.hand.find((u) => s.cards[u] === card) ?? "";
const get = (id: string) => { const sc = scenarioById(id); if (!sc) throw new Error(id); return sc; };

describe("every scenario", () => {
  it("has a goal, at least one hint, and starts incomplete", () => {
    for (const sc of SCENARIOS) {
      expect(sc.goal.length).toBeGreaterThan(10);
      expect(sc.hints.length).toBeGreaterThan(0);
      expect(sc.isComplete(sc.setup())).toBe(false);
    }
  });
});

describe("walkthroughs (the 'correct' path completes each scenario)", () => {
  it("play a land", () => {
    const sc = get("play-a-land");
    let s = sc.setup();
    s = reduce(s, { type: "playLand", uid: inHand(s, "forest") });
    expect(sc.isComplete(s)).toBe(true);
  });

  it("tap mana and cast a creature", () => {
    const sc = get("cast-a-creature");
    let s = sc.setup();
    s = reduce(s, { type: "tapForMana", uid: bf(s, "forest").uid });
    s = reduce(s, { type: "tapForMana", uid: bf(s, "mountain").uid });
    s = reduce(s, { type: "cast", uid: inHand(s, "boar") });
    expect(sc.isComplete(s)).toBe(false); // still on the stack
    s = reduce(s, { type: "pass" });
    expect(sc.isComplete(s)).toBe(true);
  });

  it("attack: coach notices a weaker attack, and the full attack completes", () => {
    const sc = get("attack");
    let s = sc.setup();
    s = reduce(s, { type: "goToCombat" });
    const one = reduce(s, { type: "toggleAttacker", uid: bf(s, "boar").uid });
    expect(sc.coach?.(one, reduce(one, { type: "declareAttackers" }), { type: "declareAttackers" })).toMatch(/Emberclaw Pup too/);
    let both = reduce(one, { type: "toggleAttacker", uid: bf(s, "pup").uid });
    expect(sc.coach?.(both, reduce(both, { type: "declareAttackers" }), { type: "declareAttackers" })).toBeNull();
    both = reduce(both, { type: "declareAttackers" });
    both = reduce(both, { type: "declareBlockers" }); // scripted: opponent has nothing to block with
    expect(sc.isComplete(both)).toBe(true);
    const sick = reduce(s, { type: "toggleAttacker", uid: bf(s, "spider").uid });
    expect(sick.refusal).toMatch(/summoning sickness/);
  });

  it("block: good blocks take no damage; the coach flags a bad block", () => {
    const sc = get("block");
    let s = sc.setup();
    const ghoul = bf(s, "ghoul", "opp").uid;
    const bat = bf(s, "bat", "opp").uid;
    // Canopy Spider (1/3) blocking Crypt Ghoul (3/2) would die without killing it: the coach should say so.
    const bad = reduce(reduce(s, { type: "pickBlocker", uid: bf(s, "spider").uid }), { type: "assignBlock", attackerUid: ghoul });
    expect(sc.coach?.(bad, bad, { type: "declareBlockers" })).toMatch(/Canopy Spider would be destroyed/);
    // Mossback Boar (2/2) blocking the Ghoul is an even trade, so only the unblocked Bat is flagged.
    const trade = reduce(reduce(s, { type: "pickBlocker", uid: bf(s, "boar").uid }), { type: "assignBlock", attackerUid: ghoul });
    expect(sc.coach?.(trade, trade, { type: "declareBlockers" })).toMatch(/Night Bat would get through/);
    s = reduce(reduce(s, { type: "pickBlocker", uid: bf(s, "rhino").uid }), { type: "assignBlock", attackerUid: ghoul });
    s = reduce(reduce(s, { type: "pickBlocker", uid: bf(s, "spider").uid }), { type: "assignBlock", attackerUid: bat });
    expect(sc.coach?.(s, s, { type: "declareBlockers" })).toBeNull();
    s = reduce(s, { type: "declareBlockers" });
    expect(s.you.life).toBe(20);
    expect(sc.isComplete(s)).toBe(true);
  });

  it("respond: countering completes it; passing is caught by the coach", () => {
    const sc = get("respond");
    let s = sc.setup();
    expect(sc.coach?.(s, reduce(s, { type: "pass" }), { type: "pass" })).toMatch(/Undo/);
    for (const l of s.battlefield.filter((p) => p.card === "island")) s = reduce(s, { type: "tapForMana", uid: l.uid });
    s = reduce(s, { type: "cast", uid: inHand(s, "denial") });
    s = reduce(s, { type: "pass" });
    expect(sc.isComplete(s)).toBe(true);
  });
});
