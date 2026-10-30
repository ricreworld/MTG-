import { beforeEach, describe, expect, it } from "vitest";
import { CARDS } from "./cards";
import { advise, critique } from "./coach";
import { commanderCost, makeState, opponentAttacks, power, reduce, resetUids, toughness, type GameState } from "./engine";
import { makeMatch, startMatch } from "./match";
import { DECKS } from "./decks";
import { step } from "./scenarios";

beforeEach(resetUids);

const bf = (s: GameState, card: string, owner: "you" | "opp" = "you") => s.battlefield.find((p) => p.card === card && p.owner === owner);
const withCommander = (init: Parameters<typeof makeState>[0], card: string, casts = 0): GameState => {
  const s = makeState(init);
  return { ...s, mode: "commander", you: { ...s.you, life: 40, commandZone: { card, casts, inZone: true }, commanderDamage: {} }, opp: { ...s.opp, life: 40, commanderDamage: {} } };
};
const tapAll = (s: GameState) => s.battlefield.filter((p) => p.owner === "you" && CARDS[p.card]?.kind === "land" && !p.tapped).reduce((st, l) => reduce(st, { type: "tapForMana", uid: l.uid }), s);

describe("the command zone", () => {
  it("casts the commander from the command zone and the tax grows by two each time", () => {
    let s = withCommander({ you: { battlefield: ["plains", "plains", "plains", "plains", "plains", "plains", "plains"] } }, "syralin");
    expect(commanderCost(s, "you")).toBe("3WW");
    s = tapAll(s);
    s = reduce(s, { type: "castCommander" });
    expect(s.refusal).toBeNull();
    expect(s.stack[0]?.fromCommandZone).toBe(true);
    s = reduce(s, { type: "pass" });
    const alin = bf(s, "syralin")!;
    expect(alin.isCommander).toBe(true);
    expect(s.you.commandZone?.inZone).toBe(false);
    expect(commanderCost(s, "you")).toBeNull();
    // It dies and goes back to the command zone, not the graveyard; the next cast costs {5}{W}{W}.
    s = { ...s, battlefield: s.battlefield.map((p) => (p.uid === alin.uid ? { ...p, damage: 4 } : p)) };
    s = reduce(s, { type: "pass" }); // nothing on the stack: refused, but let's use a real path instead
    expect(s.refusal).toMatch(/Nothing/);
    const dying = { ...s, refusal: null, stack: [{ uid: "o1", card: "stab", caster: "opp" as const, target: { kind: "permanent" as const, uid: alin.uid } }] };
    const after = reduce(dying, { type: "pass" });
    expect(bf(after, "syralin")).toBeUndefined();
    expect(after.you.graveyard).not.toContain("syralin");
    expect(after.you.commandZone).toEqual({ card: "syralin", casts: 1, inZone: true });
    expect(commanderCost(after, "you")).toBe("5WW");
    expect(after.log.some((l) => /back to the command zone/.test(l))).toBe(true);
  });

  it("refuses the commander when the taxed cost can't be paid, and explains the tax", () => {
    let s = withCommander({ you: { battlefield: ["plains", "plains", "plains", "plains", "plains"] } }, "syralin", 1);
    s = tapAll(s);
    s = reduce(s, { type: "castCommander" });
    expect(s.refusal).toMatch(/commander tax/);
  });

  it("a countered commander goes back to the command zone", () => {
    let s = withCommander({ you: { battlefield: ["forest", "forest", "forest", "forest"] }, opp: { hand: ["cancel"], battlefield: ["island", "island", "island"], library: ["island"] } }, "dwynen");
    const match = makeMatch({ yourDeck: "green-growth", oppDeck: "blue-white-sky", seed: 1, mode: "commander" });
    s = tapAll(s);
    s = step(match, s, { type: "castCommander" });
    expect(s.stack.map((x) => x.card)).toEqual(["dwynen", "cancel"]);
    s = step(match, s, { type: "pass" });
    expect(bf(s, "dwynen")).toBeUndefined();
    expect(s.you.commandZone).toEqual({ card: "dwynen", casts: 1, inZone: true });
  });
});

describe("commander damage", () => {
  it("21 combat damage from one commander loses, even at high life", () => {
    let s = withCommander({ turn: "opp", opp: { battlefield: ["vampire"] } }, "syralin");
    const vamp = bf(s, "vampire", "opp")!;
    s = { ...s, battlefield: s.battlefield.map((p) => (p.uid === vamp.uid ? { ...p, isCommander: true } : p)), you: { ...s.you, commanderDamage: { vampire: 18 } } };
    s = opponentAttacks(s, [vamp.uid]);
    s = reduce(reduce(s, { type: "declareBlockers" }), { type: "dealDamage" });
    expect(s.you.life).toBe(36);
    expect(s.you.commanderDamage?.vampire).toBe(22);
    expect(s.result).toBe("lose");
  });

  it("trample damage that goes through counts as commander damage", () => {
    let s = withCommander({ turn: "opp", you: { battlefield: ["cub"] }, opp: { battlefield: ["pathwarden"] } }, "syralin");
    const pw = bf(s, "pathwarden", "opp")!;
    s = { ...s, battlefield: s.battlefield.map((p) => (p.uid === pw.uid ? { ...p, isCommander: true } : p)) };
    s = opponentAttacks(s, [pw.uid]);
    s = reduce(reduce(s, { type: "pickBlocker", uid: bf(s, "cub")!.uid }), { type: "assignBlock", attackerUid: pw.uid });
    s = reduce(reduce(s, { type: "declareBlockers" }), { type: "dealDamage" });
    expect(s.you.commanderDamage?.pathwarden).toBe(3); // 5 power, 2 to the Cub, 3 tramples over
  });
});

describe("the commanders' abilities", () => {
  it("Syr Alin: other creatures get +1/+1 when it attacks", () => {
    let s = makeState({ you: { battlefield: ["syralin", "lions"] } });
    s = reduce(s, { type: "goToCombat" });
    s = reduce(s, { type: "toggleAttacker", uid: bf(s, "syralin")!.uid });
    s = reduce(s, { type: "toggleAttacker", uid: bf(s, "lions")!.uid });
    s = reduce(s, { type: "declareAttackers" });
    expect(power(bf(s, "lions")!)).toBe(3);
    expect(power(bf(s, "syralin")!)).toBe(4); // "other" creatures only
    s = reduce(reduce(s, { type: "declareBlockers" }), { type: "dealDamage" });
    expect(s.opp.life).toBe(13); // 4 + 3
  });

  it("Linden: 1 life per attacking white creature, and vigilance keeps it untapped", () => {
    let s = makeState({ you: { battlefield: ["linden", "lions", "cub"] } });
    s = reduce(s, { type: "goToCombat" });
    for (const c of ["linden", "lions", "cub"]) s = reduce(s, { type: "toggleAttacker", uid: bf(s, c)!.uid });
    s = reduce(s, { type: "declareAttackers" });
    expect(s.you.life).toBe(22); // Linden and the Lions are white; the Cub is green
    expect(bf(s, "linden")!.tapped).toBe(false);
  });

  it("Dwynen: other Elves get +1/+1 while it's on the battlefield, and attacking Elves gain life", () => {
    let s = makeState({ you: { battlefield: ["dwynen", "archer", "pathwarden", "cub"] } });
    s = reduce(s, { type: "goToCombat" }); // beginTurn isn't called by makeState; goToCombat doesn't refresh statics either, so check via checkState path
    expect(power(bf(s, "archer")!)).toBe(3); // 2/1 Elf Archer +1/+1
    expect(toughness(bf(s, "pathwarden")!)).toBe(5); // 5/4 Elf Warrior Ally +1/+1
    expect(power(bf(s, "cub")!)).toBe(2); // not an Elf
    expect(power(bf(s, "dwynen")!)).toBe(3); // "other" Elves only
    for (const c of ["dwynen", "archer", "cub"]) s = reduce(s, { type: "toggleAttacker", uid: bf(s, c)!.uid });
    s = reduce(s, { type: "declareAttackers" });
    expect(s.you.life).toBe(22); // Dwynen and the Archer are Elves
  });

  it("Garna: a dying attacker draws a card; a dying non-attacker pings the opponent", () => {
    let s = makeState({ you: { battlefield: ["garna", "goblin"], library: ["mountain", "mountain"] }, opp: { battlefield: ["sentry"] } });
    const match = makeMatch({ yourDeck: "black-red-blood", oppDeck: "green-growth", seed: 1 });
    s = step(match, s, { type: "goToCombat" });
    s = step(match, s, { type: "toggleAttacker", uid: bf(s, "goblin")!.uid });
    s = step(match, s, { type: "declareAttackers" }); // the Sentry blocks and kills the Goblin
    s = step(match, s, { type: "declareBlockers" });
    expect(bf(s, "goblin")).toBeUndefined();
    expect(s.you.hand).toHaveLength(1); // drew a card
    // Now a non-attacking creature dies: Stab on a Goblin at main phase.
    let t = makeState({ you: { battlefield: ["garna", "goblin"] } });
    t = { ...t, stack: [{ uid: "o9", card: "stab", caster: "opp", target: { kind: "permanent", uid: bf(t, "goblin")!.uid } }] };
    t = reduce(t, { type: "pass" });
    expect(bf(t, "goblin")).toBeUndefined();
    expect(t.opp.life).toBe(19);
  });
});

describe("a Commander match", () => {
  it("starts at 40 life with commanders in the command zone", () => {
    const s = startMatch(DECKS[0]!, DECKS[4]!, 3, "commander");
    expect(s.mode).toBe("commander");
    expect(s.you.life).toBe(40);
    expect(s.you.commandZone).toEqual({ card: "syralin", casts: 0, inZone: true });
    expect(s.opp.commandZone).toEqual({ card: "dwynen", casts: 0, inZone: true });
    expect(s.you.library).toHaveLength(23);
  });

  it("the coach suggests casting the commander when it's the best play, and flags skipping it", () => {
    let s = withCommander({ you: { hand: ["cub"], battlefield: ["forest", "forest", "forest", "forest"] } }, "dwynen");
    expect(advise(s)?.move).toBe("Cast Dwynen, Gilt-Leaf Daen from the command zone.");
    expect(critique(s, reduce(s, { type: "endTurn" }), { type: "endTurn" })).toMatch(/command zone/);
    s = tapAll(s);
    s = reduce(s, { type: "castCommander" });
    expect(s.refusal).toBeNull();
  });

  it("the computer casts its commander and the game runs to a result", () => {
    for (const seed of [11, 12]) {
      const match = makeMatch({ yourDeck: "white-legion", oppDeck: "black-red-blood", seed, mode: "commander" });
      let s = match.setup();
      let guard = 0;
      let oppCastCommander = false;
      while (!s.result && guard++ < 500) {
        const a = advise(s);
        if (!a) throw new Error(`no advice at ${s.turn} ${s.step}`);
        let action: Parameters<typeof reduce>[1];
        const tapMine = () => { for (const l of s.battlefield.filter((p) => p.owner === "you" && CARDS[p.card]?.kind === "land" && !p.tapped)) s = reduce(s, { type: "tapForMana", uid: l.uid }); };
        if (s.stack.length) action = { type: "pass" };
        else if (a.move.startsWith("Play ")) action = { type: "playLand", uid: s.you.hand.find((u) => s.cards[u] === "plains")! };
        else if (a.move.includes("from the command zone")) { tapMine(); action = { type: "castCommander" }; }
        else if (a.move.startsWith("Cast ")) { const name = a.move.slice(5, -1); tapMine(); action = { type: "cast", uid: s.you.hand.find((u) => CARDS[s.cards[u]!]?.name === name)! }; }
        else if (a.move.startsWith("Go to combat")) { s = step(match, s, { type: "goToCombat" }); for (const p of s.battlefield.filter((p) => p.owner === "you")) if (a.move.includes(CARDS[p.card]!.name)) s = step(match, s, { type: "toggleAttacker", uid: p.uid }); action = { type: "declareAttackers" }; }
        else if (a.move.startsWith("Skip combat")) action = { type: "skipCombat" };
        else if (a.move.startsWith("End your turn")) action = { type: "endTurn" };
        else if (a.move.startsWith("Continue to damage")) action = s.step === "blockers" ? { type: "declareBlockers" } : { type: "dealDamage" };
        else if (s.turn === "opp" && s.step === "blockers") {
          for (const part of a.move.split("; ")) { const m = /^(.*) blocks (.*?)\.?$/.exec(part); if (!m) continue; const b = s.battlefield.find((p) => p.owner === "you" && CARDS[p.card]!.name === m[1]); const at = s.battlefield.find((p) => p.owner === "opp" && CARDS[p.card]!.name === m[2]); if (b && at) { s = step(match, s, { type: "pickBlocker", uid: b.uid }); s = step(match, s, { type: "assignBlock", attackerUid: at.uid }); } }
          action = { type: "declareBlockers" };
        }
        else if (a.move.startsWith("Don't attack") || a.move.startsWith("Attack with")) action = { type: "declareAttackers" };
        else throw new Error(`unhandled: ${a.move}`);
        const next = step(match, s, action);
        if (next.refusal) throw new Error(`refused ${action.type}: ${next.refusal} (${a.move})`);
        s = next;
        if (s.log.some((l) => /Your opponent casts Garna.*command zone/.test(l))) oppCastCommander = true;
      }
      expect(s.result).not.toBeNull();
      expect(oppCastCommander).toBe(true);
    }
  });
});
