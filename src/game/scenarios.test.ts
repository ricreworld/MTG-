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
    s = reduce(s, { type: "cast", uid: inHand(s, "cub") });
    expect(sc.isComplete(s)).toBe(false); // still on the stack
    s = reduce(s, { type: "pass" });
    expect(sc.isComplete(s)).toBe(true);
  });

  it("attack: coach notices a weaker attack, and the full attack completes", () => {
    const sc = get("attack");
    let s = sc.setup();
    s = reduce(s, { type: "goToCombat" });
    const one = reduce(s, { type: "toggleAttacker", uid: bf(s, "cub").uid });
    expect(sc.coach?.(one, reduce(one, { type: "declareAttackers" }), { type: "declareAttackers" })).toMatch(/Brazen Scourge too/);
    let both = reduce(one, { type: "toggleAttacker", uid: bf(s, "scourge").uid });
    expect(sc.coach?.(both, reduce(both, { type: "declareAttackers" }), { type: "declareAttackers" })).toBeNull();
    both = reduce(both, { type: "declareAttackers" });
    both = reduce(both, { type: "declareBlockers" }); // scripted: opponent has nothing to block with
    expect(sc.isComplete(both)).toBe(true);
    const sick = reduce(s, { type: "toggleAttacker", uid: bf(s, "archer").uid });
    expect(sick.refusal).toMatch(/summoning sickness/);
  });

  it("block: good blocks take no damage; the coach flags a bad block", () => {
    const sc = get("block");
    let s = sc.setup();
    const vampire = bf(s, "vampire", "opp").uid;
    const skyhunter = bf(s, "skyhunter", "opp").uid;
    // Bear Cub (2/2) blocking Highborn Vampire (4/3) would die without killing it: the coach should say so.
    const bad = reduce(reduce(s, { type: "pickBlocker", uid: bf(s, "cub").uid }), { type: "assignBlock", attackerUid: vampire });
    expect(sc.coach?.(bad, bad, { type: "declareBlockers" })).toMatch(/Bear Cub would be destroyed/);
    // Thornweald Archer (deathtouch) blocking the Vampire is a fair trade, so only the unblocked Skyhunter is flagged.
    const trade = reduce(reduce(s, { type: "pickBlocker", uid: bf(s, "archer").uid }), { type: "assignBlock", attackerUid: vampire });
    expect(sc.coach?.(trade, trade, { type: "declareBlockers" })).toMatch(/Leonin Skyhunter would get through/);
    // Bear Cub can't block a flyer at all.
    const noFly = reduce(reduce(s, { type: "pickBlocker", uid: bf(s, "cub").uid }), { type: "assignBlock", attackerUid: skyhunter });
    expect(noFly.refusal).toMatch(/Flying/);
    s = reduce(reduce(s, { type: "pickBlocker", uid: bf(s, "sentry").uid }), { type: "assignBlock", attackerUid: skyhunter });
    s = reduce(reduce(s, { type: "pickBlocker", uid: bf(s, "archer").uid }), { type: "assignBlock", attackerUid: vampire });
    expect(sc.coach?.(s, s, { type: "declareBlockers" })).toBeNull();
    s = reduce(s, { type: "declareBlockers" });
    expect(s.you.life).toBe(20);
    expect(bf(s, "vampire", "opp")).toBeUndefined();
    expect(bf(s, "skyhunter", "opp")).toBeUndefined();
    expect(sc.isComplete(s)).toBe(true);
  });

  it("respond: countering completes it; passing is caught by the coach", () => {
    const sc = get("respond");
    let s = sc.setup();
    expect(sc.coach?.(s, reduce(s, { type: "pass" }), { type: "pass" })).toMatch(/Undo/);
    for (const l of s.battlefield.filter((p) => p.card === "island")) s = reduce(s, { type: "tapForMana", uid: l.uid });
    s = reduce(s, { type: "cast", uid: inHand(s, "negate") });
    s = reduce(s, { type: "pass" });
    expect(sc.isComplete(s)).toBe(true);
  });
});
