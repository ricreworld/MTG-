import { beforeEach, describe, expect, it } from "vitest";
import { manaValue, parseCost } from "./cards";
import {
  canPay,
  availableMana,
  beginYourTurn,
  makeState,
  opponentAttacks,
  opponentCasts,
  power,
  reduce,
  resetUids,
  toughness,
  type GameState,
} from "./engine";

const run = (s: GameState, ...actions: Parameters<typeof reduce>[1][]) => actions.reduce(reduce, s);
const bf = (s: GameState, card: string, owner: "you" | "opp" = "you") => s.battlefield.find((p) => p.card === card && p.owner === owner);
const inHand = (s: GameState, card: string) => s.you.hand.find((u) => s.cards[u] === card) ?? "";
const lastLog = (s: GameState) => s.log.filter(Boolean).at(-1);

beforeEach(resetUids);

describe("costs", () => {
  it("parses generic and coloured symbols", () => {
    expect(parseCost("2GG")).toEqual({ generic: 2, G: 2 });
    expect(manaValue("2GG")).toBe(4);
    expect(canPay({ G: 2, R: 2 }, "2GG")).toBe(true);
    expect(canPay({ G: 1, R: 3 }, "2GG")).toBe(false);
  });
});

describe("lands and mana", () => {
  it("plays one land per turn, in the main phase only", () => {
    let s = makeState({ you: { hand: ["forest", "mountain"] } });
    s = reduce(s, { type: "playLand", uid: inHand(s, "forest") });
    expect(bf(s, "forest")).toBeTruthy();
    s = reduce(s, { type: "playLand", uid: inHand(s, "mountain") });
    expect(s.refusal).toMatch(/one land per turn/);
    expect(bf(s, "mountain")).toBeFalsy();
  });

  it("taps a land for mana of its colour, once", () => {
    let s = makeState({ you: { battlefield: ["forest"] } });
    const land = bf(s, "forest")!;
    s = reduce(s, { type: "tapForMana", uid: land.uid });
    expect(s.you.pool).toEqual({ G: 1 });
    s = reduce(s, { type: "tapForMana", uid: land.uid });
    expect(s.refusal).toMatch(/already tapped/);
  });

  it("explains the difference between no mana in the pool and no lands at all", () => {
    let s = makeState({ you: { hand: ["cub"], battlefield: ["forest", "forest"] } });
    s = reduce(s, { type: "cast", uid: inHand(s, "cub") });
    expect(s.refusal).toMatch(/Tap your lands first/);
    let t = makeState({ you: { hand: ["sentry"], battlefield: ["forest"] } });
    t = reduce(t, { type: "cast", uid: inHand(t, "sentry") });
    expect(t.refusal).toMatch(/don't have enough mana/);
  });

  it("empties the pool when the step changes", () => {
    let s = makeState({ you: { battlefield: ["forest"] } });
    s = reduce(s, { type: "tapForMana", uid: bf(s, "forest")!.uid });
    s = reduce(s, { type: "goToCombat" });
    expect(s.you.pool).toEqual({});
    expect(availableMana(s, "you")).toEqual({});
  });
});

describe("casting creatures", () => {
  it("puts a creature on the stack, then onto the battlefield with summoning sickness", () => {
    let s = makeState({ you: { hand: ["cub"], battlefield: ["forest", "forest"] } });
    for (const l of s.battlefield) s = reduce(s, { type: "tapForMana", uid: l.uid });
    s = reduce(s, { type: "cast", uid: inHand(s, "cub") });
    expect(s.stack).toHaveLength(1);
    expect(s.you.pool).toEqual({});
    s = reduce(s, { type: "pass" });
    const cub = bf(s, "cub")!;
    expect(cub.summoningSick).toBe(true);
    s = reduce(s, { type: "goToCombat" });
    s = reduce(s, { type: "toggleAttacker", uid: cub.uid });
    expect(s.refusal).toMatch(/summoning sickness/);
  });

  it("lets a Haste creature attack the turn it arrives", () => {
    let s = makeState({ you: { hand: ["scourge"], battlefield: ["mountain", "mountain", "forest"] } });
    for (const l of s.battlefield) s = reduce(s, { type: "tapForMana", uid: l.uid });
    s = run(s, { type: "cast", uid: inHand(s, "scourge") }, { type: "pass" }, { type: "goToCombat" });
    s = reduce(s, { type: "toggleAttacker", uid: bf(s, "scourge")!.uid });
    expect(s.refusal).toBeNull();
    expect(s.selectedAttackers).toHaveLength(1);
  });

  it("refuses a creature outside the main phase", () => {
    let s = makeState({ you: { hand: ["cub"], battlefield: ["forest", "forest"] } });
    s = reduce(s, { type: "goToCombat" });
    s = reduce(s, { type: "cast", uid: inHand(s, "cub") });
    expect(s.refusal).toMatch(/main phase/);
  });
});

describe("combat", () => {
  it("unblocked attackers damage the player; blocked ones fight", () => {
    let s = makeState({ you: { battlefield: ["cub", "scourge"] }, opp: { battlefield: ["goblin"] } });
    s = run(s, { type: "goToCombat" }, { type: "toggleAttacker", uid: bf(s, "cub")!.uid }, { type: "toggleAttacker", uid: bf(s, "scourge")!.uid }, { type: "declareAttackers" });
    expect(s.step).toBe("blockers");
    // Scenario script: the opponent's Swab Goblin blocks the Bear Cub (simulate by setting the block).
    s = { ...s, attackers: { ...s.attackers, [bf(s, "cub")!.uid]: bf(s, "goblin", "opp")!.uid } };
    s = reduce(s, { type: "declareBlockers" });
    expect(s.opp.life).toBe(17); // Brazen Scourge (3 power) unblocked
    expect(bf(s, "cub")).toBeFalsy(); // 2/2 vs 2/2: both destroyed
    expect(bf(s, "goblin", "opp")).toBeFalsy();
    expect(s.step).toBe("main2");
  });

  it("damage wears off at end of turn", () => {
    let s = makeState({ you: { battlefield: ["pathwarden"] }, opp: { battlefield: ["goblin"] } });
    s = run(s, { type: "goToCombat" }, { type: "toggleAttacker", uid: bf(s, "pathwarden")!.uid }, { type: "declareAttackers" });
    expect(bf(s, "pathwarden")!.tapped).toBe(false); // vigilance
    s = { ...s, attackers: { [bf(s, "pathwarden")!.uid]: bf(s, "goblin", "opp")!.uid } };
    s = reduce(s, { type: "declareBlockers" });
    expect(bf(s, "pathwarden")!.damage).toBe(2);
    expect(s.opp.life).toBe(17); // trample: 5 power, 2 lethal to the 2/2 goblin, 3 to the player
    s = reduce(s, { type: "endTurn" });
    expect(bf(s, "pathwarden")!.damage).toBe(0);
  });

  it("flying can only be blocked by flying or reach", () => {
    let s = makeState({ turn: "opp", you: { battlefield: ["cub", "sentry"] }, opp: { battlefield: ["skyhunter"] } });
    s = opponentAttacks(s, [bf(s, "skyhunter", "opp")!.uid]);
    s = run(s, { type: "pickBlocker", uid: bf(s, "cub")!.uid }, { type: "assignBlock", attackerUid: bf(s, "skyhunter", "opp")!.uid });
    expect(s.refusal).toMatch(/Flying/);
    s = run(s, { type: "pickBlocker", uid: bf(s, "sentry")!.uid }, { type: "assignBlock", attackerUid: bf(s, "skyhunter", "opp")!.uid });
    expect(s.refusal).toBeNull();
    s = reduce(s, { type: "declareBlockers" });
    expect(bf(s, "skyhunter", "opp")).toBeFalsy();
    expect(s.you.life).toBe(20);
  });

  it("deathtouch destroys whatever it damages; lifelink gains life", () => {
    let s = makeState({ turn: "opp", you: { battlefield: ["archer", "cub"] }, opp: { battlefield: ["vampire", "soldier"] } });
    const vampire = bf(s, "vampire", "opp")!.uid;
    const soldier = bf(s, "soldier", "opp")!.uid;
    s = opponentAttacks(s, [vampire, soldier]);
    s = run(s, { type: "pickBlocker", uid: bf(s, "archer")!.uid }, { type: "assignBlock", attackerUid: vampire }, { type: "pickBlocker", uid: bf(s, "cub")!.uid }, { type: "assignBlock", attackerUid: soldier });
    s = reduce(s, { type: "declareBlockers" });
    expect(bf(s, "vampire", "opp")).toBeFalsy(); // deathtouch from the Archer
    expect(bf(s, "archer")).toBeFalsy(); // 4 damage to a 2/1
    expect(bf(s, "cub")).toBeFalsy(); // 2/2 vs 2/2: both destroyed
    expect(bf(s, "soldier", "opp")).toBeFalsy();
    expect(s.opp.life).toBe(22); // Bishop's Soldier has lifelink
  });

  it("a learner who takes lethal damage gets a result, not a crash", () => {
    let s = makeState({ turn: "opp", you: { life: 4 }, opp: { battlefield: ["vampire"] } });
    s = opponentAttacks(s, [bf(s, "vampire", "opp")!.uid]);
    s = reduce(s, { type: "declareBlockers" });
    expect(s.result).toBe("lose");
    expect(s.you.life).toBe(0);
  });
});

describe("the stack", () => {
  it("counters the opponent's spell in response; newest resolves first", () => {
    let s = makeState({ you: { hand: ["negate"], battlefield: ["island", "island", "cub"] } });
    s = opponentCasts(s, "stab", { kind: "permanent", uid: bf(s, "cub")!.uid });
    for (const l of s.battlefield.filter((p) => p.card === "island")) s = reduce(s, { type: "tapForMana", uid: l.uid });
    s = reduce(s, { type: "cast", uid: inHand(s, "negate") });
    expect(s.stack.map((x) => x.card)).toEqual(["stab", "negate"]);
    s = reduce(s, { type: "pass" });
    expect(s.stack).toHaveLength(0);
    expect(lastLog(s)).toMatch(/countered/);
    expect(bf(s, "cub")).toBeTruthy();
  });

  it("Negate can't counter a creature spell; Cancel can", () => {
    let s = makeState({ you: { hand: ["negate", "cancel"], battlefield: ["island", "island", "island"] } });
    s = opponentCasts(s, "cub");
    for (const l of s.battlefield) s = reduce(s, { type: "tapForMana", uid: l.uid });
    s = reduce(s, { type: "cast", uid: inHand(s, "negate") });
    expect(s.refusal).toMatch(/noncreature/);
    s = reduce(s, { type: "cast", uid: inHand(s, "cancel") });
    expect(s.refusal).toBeNull();
    s = reduce(s, { type: "pass" });
    expect(lastLog(s)).toMatch(/countered/);
  });

  it("a -2/-2 spell destroys a 2/2 (toughness 0 or less)", () => {
    let s = makeState({ you: { battlefield: ["cub"] } });
    s = opponentCasts(s, "stab", { kind: "permanent", uid: bf(s, "cub")!.uid });
    s = reduce(s, { type: "pass" });
    expect(bf(s, "cub")).toBeFalsy();
  });

  it("lets the opponent's spell resolve if the learner passes", () => {
    let s = makeState({ you: { battlefield: ["cub"] } });
    s = opponentCasts(s, "stab", { kind: "permanent", uid: bf(s, "cub")!.uid });
    s = reduce(s, { type: "pass" });
    expect(bf(s, "cub")).toBeFalsy();
  });

  it("pump spell needs a target, then makes the creature bigger until end of turn", () => {
    let s = makeState({ you: { hand: ["growth"], battlefield: ["forest", "cub"] } });
    s = reduce(s, { type: "tapForMana", uid: bf(s, "forest")!.uid });
    s = reduce(s, { type: "cast", uid: inHand(s, "growth") });
    expect(s.pendingTarget).toBeTruthy();
    s = reduce(s, { type: "chooseTarget", target: { kind: "player", player: "opp" } });
    expect(s.refusal).toMatch(/targets a creature/);
    s = reduce(s, { type: "chooseTarget", target: { kind: "permanent", uid: bf(s, "cub")!.uid } });
    s = reduce(s, { type: "pass" });
    expect(power(bf(s, "cub")!)).toBe(5);
    expect(toughness(bf(s, "cub")!)).toBe(5);
    s = reduce(s, { type: "endTurn" });
    expect(power(bf(s, "cub")!)).toBe(2);
  });
});

describe("turn start", () => {
  it("untaps and clears summoning sickness", () => {
    let s = makeState({ you: { battlefield: [{ card: "forest", tapped: true }, { card: "cub", sick: true }] } });
    s = beginYourTurn(s);
    expect(bf(s, "forest")!.tapped).toBe(false);
    expect(bf(s, "cub")!.summoningSick).toBe(false);
    expect(s.you.landPlayedThisTurn).toBe(false);
  });
});
