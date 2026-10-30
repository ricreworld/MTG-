import { beforeEach, describe, expect, it } from "vitest";
import { chooseBlocks, runOpponent } from "./ai";
import { advise, critique } from "./coach";
import { DECKS, deckList, deckSize, rng, shuffle } from "./decks";
import { beginTurn, makeState, reduce, resetUids, type GameState } from "./engine";
import { makeMatch, startMatch } from "./match";
import { step } from "./scenarios";

beforeEach(resetUids);

const bf = (s: GameState, card: string, owner: "you" | "opp" = "you") => s.battlefield.find((p) => p.card === card && p.owner === owner);
const inHand = (s: GameState, card: string) => s.you.hand.find((u) => s.cards[u] === card) ?? "";

describe("decks", () => {
  it("every deck is 30 cards of known cards, with at most four of each non-land", () => {
    for (const d of DECKS) {
      expect(deckSize(d)).toBe(30);
      expect(deckList(d)).toHaveLength(30);
      for (const [id, n] of Object.entries(d.cards)) if (!["plains", "island", "swamp", "mountain", "forest"].includes(id)) expect(n).toBeLessThanOrEqual(4);
    }
  });
  it("shuffles deterministically from a seed", () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], rng(7));
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], rng(7));
    expect(a).toEqual(b);
    expect(a).not.toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("starting a match", () => {
  it("deals seven cards each and the first player skips the first draw", () => {
    const s = startMatch(DECKS[4]!, DECKS[3]!, 1);
    expect(s.you.hand).toHaveLength(7);
    expect(s.opp.hand).toHaveLength(7);
    expect(s.you.library).toHaveLength(23);
    expect(s.turn).toBe("you");
    expect(s.step).toBe("main1");
    expect(s.turnNumber).toBe(1);
  });
  it("drawing from an empty library loses", () => {
    let s = makeState({ turn: "opp", turnNumber: 3, you: { library: [] } });
    s = beginTurn(s, "you");
    expect(s.result).toBe("lose");
  });
});

describe("the computer opponent", () => {
  it("plays a land, casts a creature, and hands the turn back", () => {
    let s = makeState({ turn: "you", step: "end", turnNumber: 1, opp: { hand: ["forest", "forest", "cub"], library: ["forest", "forest"] }, you: { library: ["forest", "forest"] } });
    s = beginTurn(s, "opp");
    s = runOpponent(s);
    expect(s.turn).toBe("you");
    expect(bf(s, "forest", "opp")).toBeTruthy();
    // Only one land on its first turn, and Bear Cub costs two, so it waits.
    expect(s.battlefield.filter((p) => p.owner === "opp" && p.card === "forest")).toHaveLength(1);
    s = reduce(s, { type: "endTurn" });
    s = beginTurn(s, "opp");
    s = runOpponent(s);
    expect(s.stack.map((x) => x.card)).toEqual(["cub"]); // the learner may respond
    s = runOpponent(reduce(s, { type: "pass" }));
    expect(bf(s, "cub", "opp")).toBeTruthy();
    expect(s.turn).toBe("you");
  });

  it("attacks when it's safe and lets the learner block", () => {
    let s = makeState({ turn: "you", step: "end", turnNumber: 2, opp: { battlefield: ["vampire"], library: ["swamp"] }, you: { battlefield: ["cub"], library: ["forest"] } });
    s = beginTurn(s, "opp");
    s = runOpponent(s);
    expect(s.step).toBe("blockers");
    expect(Object.keys(s.attackers)).toHaveLength(1);
  });

  it("keeps a creature home when a blocker would destroy it and survive", () => {
    let s = makeState({ turn: "you", step: "end", turnNumber: 2, opp: { battlefield: ["goblin"], library: ["mountain"] }, you: { battlefield: ["sentry"], library: ["forest"] } });
    s = beginTurn(s, "opp");
    s = runOpponent(s);
    expect(s.turn).toBe("you"); // it didn't attack
    expect(s.log.some((l) => /doesn't attack/.test(l))).toBe(true);
  });

  it("blocks the learner's attacker when it can destroy it and survive", () => {
    const s = makeState({ you: { battlefield: ["cub"] }, opp: { battlefield: ["sentry"] } });
    let t = reduce(s, { type: "goToCombat" });
    t = reduce(t, { type: "toggleAttacker", uid: bf(t, "cub")!.uid });
    t = reduce(t, { type: "declareAttackers" });
    const blocks = chooseBlocks(t);
    expect(blocks[bf(t, "cub")!.uid]).toBe(bf(t, "sentry", "opp")!.uid);
  });

  it("counters a big creature spell when it holds Cancel and mana", () => {
    let s = makeState({ you: { hand: ["serra"], battlefield: ["plains", "plains", "plains", "plains", "plains"], library: ["plains"] }, opp: { hand: ["cancel"], battlefield: ["island", "island", "island"], library: ["island"] } });
    const match = makeMatch({ yourDeck: "white-legion", oppDeck: "blue-white-sky", seed: 1 });
    for (const l of s.battlefield.filter((p) => p.owner === "you")) s = reduce(s, { type: "tapForMana", uid: l.uid });
    s = step(match, s, { type: "cast", uid: inHand(s, "serra") });
    expect(s.stack.map((x) => x.card)).toEqual(["serra", "cancel"]);
    s = step(match, s, { type: "pass" });
    expect(s.stack).toHaveLength(0);
    expect(bf(s, "serra")).toBeUndefined();
  });

  it("uses Giant Growth to win a fight it would lose", () => {
    let s = makeState({ turn: "you", step: "end", turnNumber: 2, opp: { hand: ["growth"], battlefield: ["cub", "forest"], library: ["forest"] }, you: { battlefield: [{ card: "cub", tapped: true }], library: ["forest"] } });
    const match = makeMatch({ yourDeck: "green-growth", oppDeck: "green-growth", seed: 1 });
    s = beginTurn(s, "opp");
    s = runOpponent(s); // it attacks into the tapped blocker's owner: no untapped blockers, so it attacks
    expect(s.step).toBe("blockers");
    // Give the learner an untapped blocker by untapping the cub, then block: 2/2 vs 2/2 would trade, so it pumps.
    s = { ...s, battlefield: s.battlefield.map((p) => (p.owner === "you" ? { ...p, tapped: false } : p)) };
    s = step(match, s, { type: "pickBlocker", uid: bf(s, "cub")!.uid });
    s = step(match, s, { type: "assignBlock", attackerUid: bf(s, "cub", "opp")!.uid });
    s = step(match, s, { type: "declareBlockers" });
    expect(s.stack.map((x) => x.card)).toEqual(["growth"]);
    s = step(match, s, { type: "pass" });
    expect(bf(s, "cub")).toBeUndefined(); // the learner's cub is destroyed
    expect(bf(s, "cub", "opp")).toBeTruthy(); // theirs survives at 5/5
    expect(s.turn).toBe("you"); // and the turn came back
  });
});

describe("the coach", () => {
  it("suggests a land first, then the biggest creature", () => {
    let s = makeState({ you: { hand: ["forest", "cub", "sentry"], battlefield: ["forest", "forest", "forest"] } });
    expect(advise(s)?.move).toBe("Play Forest.");
    s = reduce(s, { type: "playLand", uid: inHand(s, "forest") });
    expect(advise(s)?.move).toBe("Cast Magnigoth Sentry.");
  });

  it("suggests safe attackers only, and flags a risky attack", () => {
    const s = makeState({ you: { battlefield: ["cub", "serra"] }, opp: { battlefield: ["sentry"] } });
    expect(advise(s)?.move).toBe("Go to combat and attack with Serra Angel.");
    let t = reduce(s, { type: "goToCombat" });
    t = reduce(t, { type: "toggleAttacker", uid: bf(t, "cub")!.uid });
    expect(critique(t, reduce(t, { type: "declareAttackers" }), { type: "declareAttackers" })).toMatch(/Bear Cub can be blocked and destroyed/);
  });

  it("suggests blocks and flags ending the turn with a land in hand", () => {
    let s = makeState({ turn: "opp", you: { battlefield: ["sentry"] }, opp: { battlefield: ["goblin"] } });
    s = { ...s, step: "blockers", attackers: { [bf(s, "goblin", "opp")!.uid]: null } };
    expect(advise(s)?.move).toBe("Magnigoth Sentry blocks Swab Goblin.");
    const t = makeState({ you: { hand: ["forest"] } });
    expect(critique(t, reduce(t, { type: "endTurn" }), { type: "endTurn" })).toMatch(/still in hand/);
  });

  it("recommends countering a spell aimed at your creature", () => {
    let s = makeState({ you: { hand: ["negate"], battlefield: ["island", "island", "cub"] } });
    s = { ...s, stack: [{ uid: "o1", card: "stab", caster: "opp", target: { kind: "permanent", uid: bf(s, "cub")!.uid } }] };
    expect(advise(s)?.move).toBe("Counter Stab with Negate.");
  });
});

describe("a whole game", () => {
  it("can be played to the end by following the coach, without errors", () => {
    for (const seed of [1, 2, 3]) {
      const match = makeMatch({ yourDeck: "red-fire", oppDeck: "green-growth", seed });
      let s = match.setup();
      let guard = 0;
      while (!s.result && guard++ < 400) {
        const a = advise(s);
        if (!a) throw new Error(`no advice at turn ${s.turn} step ${s.step}`);
        let action: Parameters<typeof reduce>[1];
        if (s.stack.length) {
          if (a.move.startsWith("Counter")) {
            const c = s.you.hand.find((u) => /negate|cancel/.test(s.cards[u] ?? ""))!;
            for (const l of s.battlefield.filter((p) => p.owner === "you" && /island|plains/.test(p.card) && !p.tapped)) s = reduce(s, { type: "tapForMana", uid: l.uid });
            action = { type: "cast", uid: c };
          } else action = { type: "pass" };
        } else if (a.move.startsWith("Play ")) action = { type: "playLand", uid: s.you.hand.find((u) => s.cards[u] === "mountain")! };
        else if (a.move.startsWith("Cast ")) {
          const name = a.move.slice(5, -1);
          const uid = s.you.hand.find((u) => s.cards[u] && s.cards[u] !== "mountain" && (require_name(s.cards[u]!) === name))!;
          for (const l of s.battlefield.filter((p) => p.owner === "you" && p.card === "mountain" && !p.tapped)) s = reduce(s, { type: "tapForMana", uid: l.uid });
          action = { type: "cast", uid };
        } else if (a.move.startsWith("Go to combat")) {
          s = step(match, s, { type: "goToCombat" });
          for (const p of s.battlefield.filter((p) => p.owner === "you")) if (a.move.includes(require_name(p.card))) s = step(match, s, { type: "toggleAttacker", uid: p.uid });
          action = { type: "declareAttackers" };
        } else if (a.move.startsWith("Skip combat")) action = { type: "skipCombat" };
        else if (a.move.startsWith("End your turn")) action = { type: "endTurn" };
        else if (a.move.startsWith("Continue to damage")) action = s.step === "blockers" ? { type: "declareBlockers" } : { type: "dealDamage" };
        else if (s.turn === "opp" && s.step === "blockers") {
          // Apply the suggested blocks.
          for (const part of a.move.split("; ")) {
            const m = /^(.*) blocks (.*?)\.?$/.exec(part);
            if (!m) continue;
            const blocker = s.battlefield.find((p) => p.owner === "you" && require_name(p.card) === m[1]);
            const attacker = s.battlefield.find((p) => p.owner === "opp" && require_name(p.card) === m[2]);
            if (blocker && attacker) { s = step(match, s, { type: "pickBlocker", uid: blocker.uid }); s = step(match, s, { type: "assignBlock", attackerUid: attacker.uid }); }
          }
          action = { type: "declareBlockers" };
        } else if (a.move.startsWith("Don't attack") || a.move.startsWith("Attack with")) action = { type: "declareAttackers" };
        else throw new Error(`unhandled advice: ${a.move}`);
        const next = step(match, s, action);
        if (next.refusal) throw new Error(`refused ${action.type}: ${next.refusal} (advice: ${a.move})`);
        s = next;
      }
      expect(s.result).not.toBeNull();
      expect(guard).toBeLessThan(400);
    }
  });
});

import { CARDS } from "./cards";
function require_name(id: string): string { return CARDS[id]!.name; }
