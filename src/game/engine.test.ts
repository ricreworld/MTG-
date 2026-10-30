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
    let s = makeState({ you: { hand: ["boar"], battlefield: ["forest", "forest"] } });
    s = reduce(s, { type: "cast", uid: inHand(s, "boar") });
    expect(s.refusal).toMatch(/Tap your lands first/);
    let t = makeState({ you: { hand: ["rhino"], battlefield: ["forest"] } });
    t = reduce(t, { type: "cast", uid: inHand(t, "rhino") });
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
    let s = makeState({ you: { hand: ["boar"], battlefield: ["forest", "forest"] } });
    for (const l of s.battlefield) s = reduce(s, { type: "tapForMana", uid: l.uid });
    s = reduce(s, { type: "cast", uid: inHand(s, "boar") });
    expect(s.stack).toHaveLength(1);
    expect(s.you.pool).toEqual({});
    s = reduce(s, { type: "pass" });
    const boar = bf(s, "boar")!;
    expect(boar.summoningSick).toBe(true);
    s = reduce(s, { type: "goToCombat" });
    s = reduce(s, { type: "toggleAttacker", uid: boar.uid });
    expect(s.refusal).toMatch(/summoning sickness/);
  });

  it("lets a Haste creature attack the turn it arrives", () => {
    let s = makeState({ you: { hand: ["pup"], battlefield: ["mountain", "forest"] } });
    for (const l of s.battlefield) s = reduce(s, { type: "tapForMana", uid: l.uid });
    s = run(s, { type: "cast", uid: inHand(s, "pup") }, { type: "pass" }, { type: "goToCombat" });
    s = reduce(s, { type: "toggleAttacker", uid: bf(s, "pup")!.uid });
    expect(s.refusal).toBeNull();
    expect(s.selectedAttackers).toHaveLength(1);
  });

  it("refuses a creature outside the main phase", () => {
    let s = makeState({ you: { hand: ["boar"], battlefield: ["forest", "forest"] } });
    s = reduce(s, { type: "goToCombat" });
    s = reduce(s, { type: "cast", uid: inHand(s, "boar") });
    expect(s.refusal).toMatch(/main phase/);
  });
});

describe("combat", () => {
  it("unblocked attackers damage the player; blocked ones fight", () => {
    let s = makeState({ you: { battlefield: ["boar", "pup"] }, opp: { battlefield: ["guard"] } });
    s = run(s, { type: "goToCombat" }, { type: "toggleAttacker", uid: bf(s, "boar")!.uid }, { type: "toggleAttacker", uid: bf(s, "pup")!.uid }, { type: "declareAttackers" });
    expect(s.step).toBe("blockers");
    // Scenario script: the opponent's guard blocks the boar (simulate by setting the block).
    s = { ...s, attackers: { ...s.attackers, [bf(s, "boar")!.uid]: bf(s, "guard", "opp")!.uid } };
    s = reduce(s, { type: "declareBlockers" });
    expect(s.opp.life).toBe(18); // pup unblocked
    expect(bf(s, "boar")).toBeFalsy(); // 2/2 vs 2/2: both destroyed
    expect(bf(s, "guard", "opp")).toBeFalsy();
    expect(s.step).toBe("main2");
  });

  it("damage wears off at end of turn", () => {
    let s = makeState({ you: { battlefield: ["rhino"] }, opp: { battlefield: ["guard"] } });
    s = run(s, { type: "goToCombat" }, { type: "toggleAttacker", uid: bf(s, "rhino")!.uid }, { type: "declareAttackers" });
    s = { ...s, attackers: { [bf(s, "rhino")!.uid]: bf(s, "guard", "opp")!.uid } };
    s = reduce(s, { type: "declareBlockers" });
    expect(bf(s, "rhino")!.damage).toBe(2);
    expect(s.opp.life).toBe(18); // trample: 4 power, 2 lethal to the 2/2 guard, 2 to the player
    s = reduce(s, { type: "endTurn" });
    expect(bf(s, "rhino")!.damage).toBe(0);
  });

  it("flying can only be blocked by flying or reach", () => {
    let s = makeState({ turn: "opp", you: { battlefield: ["boar", "spider"] }, opp: { battlefield: ["bat"] } });
    s = opponentAttacks(s, [bf(s, "bat", "opp")!.uid]);
    s = run(s, { type: "pickBlocker", uid: bf(s, "boar")!.uid }, { type: "assignBlock", attackerUid: bf(s, "bat", "opp")!.uid });
    expect(s.refusal).toMatch(/Flying/);
    s = run(s, { type: "pickBlocker", uid: bf(s, "spider")!.uid }, { type: "assignBlock", attackerUid: bf(s, "bat", "opp")!.uid });
    expect(s.refusal).toBeNull();
    s = reduce(s, { type: "declareBlockers" });
    expect(bf(s, "bat", "opp")).toBeFalsy();
    expect(s.you.life).toBe(20);
  });

  it("deathtouch destroys whatever it damages; first strike hits first", () => {
    let s = makeState({ turn: "opp", you: { battlefield: ["viper", "boar"] }, opp: { battlefield: ["ghoul", "knight"] } });
    const ghoul = bf(s, "ghoul", "opp")!.uid;
    const knight = bf(s, "knight", "opp")!.uid;
    s = opponentAttacks(s, [ghoul, knight]);
    s = run(s, { type: "pickBlocker", uid: bf(s, "viper")!.uid }, { type: "assignBlock", attackerUid: ghoul }, { type: "pickBlocker", uid: bf(s, "boar")!.uid }, { type: "assignBlock", attackerUid: knight });
    s = reduce(s, { type: "declareBlockers" });
    expect(bf(s, "ghoul", "opp")).toBeFalsy(); // deathtouch
    expect(bf(s, "viper")).toBeFalsy(); // 3 damage to a 1/1
    expect(bf(s, "boar")).toBeFalsy(); // knight's first strike kills the 2/2 before it hits back
    expect(bf(s, "knight", "opp")).toBeTruthy();
    expect(s.opp.life).toBe(22); // lifelink
  });

  it("a learner who takes lethal damage gets a result, not a crash", () => {
    let s = makeState({ turn: "opp", you: { life: 3 }, opp: { battlefield: ["ghoul"] } });
    s = opponentAttacks(s, [bf(s, "ghoul", "opp")!.uid]);
    s = reduce(s, { type: "declareBlockers" });
    expect(s.result).toBe("lose");
    expect(s.you.life).toBe(0);
  });
});

describe("the stack", () => {
  it("counters the opponent's spell in response; newest resolves first", () => {
    let s = makeState({ you: { hand: ["denial"], battlefield: ["island", "island", "rhino"] } });
    s = opponentCasts(s, "jolt", { kind: "permanent", uid: bf(s, "rhino")!.uid });
    for (const l of s.battlefield.filter((p) => p.card === "island")) s = reduce(s, { type: "tapForMana", uid: l.uid });
    s = reduce(s, { type: "cast", uid: inHand(s, "denial") });
    expect(s.stack.map((x) => x.card)).toEqual(["jolt", "denial"]);
    s = reduce(s, { type: "pass" });
    expect(s.stack).toHaveLength(0);
    expect(lastLog(s)).toMatch(/countered/);
    expect(bf(s, "rhino")).toBeTruthy();
  });

  it("lets the opponent's spell resolve if the learner passes", () => {
    let s = makeState({ you: { battlefield: ["boar"] } });
    s = opponentCasts(s, "jolt", { kind: "permanent", uid: bf(s, "boar")!.uid });
    s = reduce(s, { type: "pass" });
    expect(bf(s, "boar")).toBeFalsy();
  });

  it("pump spell needs a target, then makes the creature bigger until end of turn", () => {
    let s = makeState({ you: { hand: ["surge"], battlefield: ["forest", "boar"] } });
    s = reduce(s, { type: "tapForMana", uid: bf(s, "forest")!.uid });
    s = reduce(s, { type: "cast", uid: inHand(s, "surge") });
    expect(s.pendingTarget).toBeTruthy();
    s = reduce(s, { type: "chooseTarget", target: { kind: "player", player: "opp" } });
    expect(s.refusal).toMatch(/targets a creature/);
    s = reduce(s, { type: "chooseTarget", target: { kind: "permanent", uid: bf(s, "boar")!.uid } });
    s = reduce(s, { type: "pass" });
    expect(power(bf(s, "boar")!)).toBe(5);
    expect(toughness(bf(s, "boar")!)).toBe(5);
    s = reduce(s, { type: "endTurn" });
    expect(power(bf(s, "boar")!)).toBe(2);
  });
});

describe("turn start", () => {
  it("untaps and clears summoning sickness", () => {
    let s = makeState({ you: { battlefield: [{ card: "forest", tapped: true }, { card: "boar", sick: true }] } });
    s = beginYourTurn(s);
    expect(bf(s, "forest")!.tapped).toBe(false);
    expect(bf(s, "boar")!.summoningSick).toBe(false);
    expect(s.you.landPlayedThisTurn).toBe(false);
  });
});
