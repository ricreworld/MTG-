import { beforeEach, describe, expect, it } from "vitest";
import { makeState, opponentCasts, reduce, resetUids, type GameState } from "../game/engine";
import { makeMatch } from "../game/match";
import { scenarioById } from "../game/scenarios";
import { schedule } from "./director";
import { diff } from "./events";
import { TableMachine } from "./machine";
import { TIMINGS } from "./motion";
import { Pool } from "./pool";

beforeEach(resetUids);

const bf = (s: GameState, card: string, owner: "you" | "opp" = "you") => s.battlefield.find((p) => p.card === card && p.owner === owner)!;
const inHand = (s: GameState, card: string) => s.you.hand.find((u) => s.cards[u] === card) ?? "";
const kinds = (s1: GameState, s2: GameState) => diff(s1, s2).map((e) => e.kind);

describe("event diff", () => {
  it("playing a land: hand -> battlefield", () => {
    const a = makeState({ you: { hand: ["forest"] } });
    const b = reduce(a, { type: "playLand", uid: inHand(a, "forest") });
    const ev = diff(a, b, { type: "playLand", uid: "" });
    expect(ev).toContainEqual({ kind: "cardMoved", uid: inHand(a, "forest"), card: "forest", from: "hand", to: "battlefield", owner: "you" });
  });

  it("casting then resolving a creature: tapped lands, spellCast, then stack -> battlefield", () => {
    const start = makeState({ you: { hand: ["cub"], battlefield: ["forest", "forest"] } });
    let a = start;
    for (const l of a.battlefield) a = reduce(a, { type: "tapForMana", uid: l.uid });
    const cast = reduce(a, { type: "cast", uid: inHand(a, "cub") });
    expect(kinds(start, cast)).toEqual(["spellCast", "tapped", "tapped"]);
    const resolved = reduce(cast, { type: "pass" });
    expect(kinds(cast, resolved)).toEqual(["cardMoved"]);
    expect(diff(cast, resolved)[0]).toMatchObject({ from: "stack", to: "battlefield" });
  });

  it("a counterspell: spellCast then countered", () => {
    let s = makeState({ you: { hand: ["negate"], battlefield: ["island", "island", "cub"] } });
    s = opponentCasts(s, "stab", { kind: "permanent", uid: bf(s, "cub").uid });
    for (const l of s.battlefield.filter((p) => p.card === "island")) s = reduce(s, { type: "tapForMana", uid: l.uid });
    const cast = reduce(s, { type: "cast", uid: inHand(s, "negate") });
    expect(kinds(s, cast)).toEqual(["spellCast"]);
    const done = reduce(cast, { type: "pass" });
    const ev = diff(cast, done);
    expect(ev.map((e) => e.kind)).toEqual(["cardMoved", "countered"]);
    expect(ev[1]).toMatchObject({ card: "stab", owner: "opp" });
  });

  it("combat: attack, block, damage, life, destroyed, in that order", () => {
    let s = makeState({ you: { battlefield: ["cub", "scourge"] }, opp: { battlefield: ["goblin"] } });
    s = reduce(s, { type: "goToCombat" });
    s = reduce(s, { type: "toggleAttacker", uid: bf(s, "cub").uid });
    s = reduce(s, { type: "toggleAttacker", uid: bf(s, "scourge").uid });
    const attacked = reduce(s, { type: "declareAttackers" });
    const evA = diff(s, attacked);
    expect(evA.filter((e) => e.kind === "tapped")).toHaveLength(2);
    expect(evA.find((e) => e.kind === "attack")).toMatchObject({ by: "you" });
    const blocked = { ...attacked, attackers: { ...attacked.attackers, [bf(attacked, "cub").uid]: bf(attacked, "goblin", "opp").uid } };
    const locked = reduce(blocked, { type: "declareBlockers" });
    expect(diff(attacked, locked).map((e) => e.kind)).toEqual(["block", "turnChanged"]);
    const dealt = reduce(locked, { type: "dealDamage" });
    const ev = diff(locked, dealt).map((e) => e.kind);
    expect(ev).toEqual(["lifeChanged", "destroyed", "destroyed", "turnChanged"]);
    expect(diff(locked, dealt).find((e) => e.kind === "lifeChanged")).toMatchObject({ player: "opp", from: 20, to: 17 });
  });

  it("a destroyed commander reports its return to the command zone", () => {
    let s = makeState({ you: { battlefield: ["syralin"] } });
    s = { ...s, mode: "commander", battlefield: s.battlefield.map((p) => ({ ...p, isCommander: true })), you: { ...s.you, commandZone: { card: "syralin", casts: 1, inZone: false } } };
    s = { ...s, stack: [{ uid: "o1", card: "stab", caster: "opp", target: { kind: "permanent", uid: bf(s, "syralin").uid } }] };
    const pumped = { ...s, battlefield: s.battlefield.map((p) => ({ ...p, damage: 3 })) };
    const after = reduce(pumped, { type: "pass" });
    const d = diff(pumped, after).find((e) => e.kind === "destroyed");
    expect(d).toMatchObject({ card: "syralin", toCommandZone: true });
  });

  it("the game ending produces a result event with a reason", () => {
    let s = makeState({ turn: "opp", you: { life: 2 }, opp: { battlefield: ["vampire"] } });
    s = { ...s, step: "blockers", attackers: { [bf(s, "vampire", "opp").uid]: null } };
    const locked = reduce(s, { type: "declareBlockers" });
    const dealt = reduce(locked, { type: "dealDamage" });
    const r = diff(locked, dealt).find((e) => e.kind === "result");
    expect(r).toMatchObject({ result: "lose" });
  });
});

describe("director", () => {
  const sample = () => {
    let s = makeState({ you: { battlefield: ["cub", "scourge", "goblin"] }, opp: { battlefield: ["sentry"] } });
    s = reduce(s, { type: "goToCombat" });
    for (const c of ["cub", "scourge", "goblin"]) s = reduce(s, { type: "toggleAttacker", uid: bf(s, c).uid });
    const attacked = reduce(s, { type: "declareAttackers" });
    return { s, attacked };
  };

  it("off motion means zero duration for everything", () => {
    const { s, attacked } = sample();
    const b = schedule(diff(s, attacked), "off", attacked);
    expect(b.total).toBe(0);
    expect(b.cues.every((c) => c.dur === 0 && c.at === 0)).toBe(true);
  });

  it("gentle motion sequences cues and stays within the budget", () => {
    const { s, attacked } = sample();
    const b = schedule(diff(s, attacked), "gentle", attacked);
    expect(b.total).toBeGreaterThan(0);
    expect(b.total).toBeLessThanOrEqual(TIMINGS.gentle.budget);
    const taps = b.cues.filter((c) => c.event.kind === "tapped");
    expect(taps.every((c) => c.at === 0)).toBe(true); // parallel
  });

  it("a long batch is compressed, not truncated", () => {
    const events = Array.from({ length: 12 }, (_, i) => ({ kind: "destroyed" as const, uid: `p${i}`, card: "cub", owner: "you" as const, toCommandZone: false }));
    const b = schedule(events, "gentle", makeState({}));
    expect(b.cues).toHaveLength(12);
    expect(b.total).toBe(TIMINGS.gentle.budget);
    expect(b.cues[11]!.at + b.cues[11]!.dur).toBeLessThanOrEqual(TIMINGS.gentle.budget);
  });

  it("screen shake only in full motion and only on a result", () => {
    const lose = [{ kind: "result" as const, result: "lose" as const, reason: "x" }];
    expect(schedule(lose, "gentle", makeState({})).shake).toBe(false);
    expect(schedule(lose, "full", makeState({})).shake).toBe(true);
    expect(schedule([{ kind: "tapped", uid: "a", card: "forest", owner: "you", tapped: true }], "full", makeState({})).shake).toBe(false);
  });

  it("announces one sentence per batch", () => {
    const { s, attacked } = sample();
    const b = schedule(diff(s, attacked), "gentle", attacked);
    expect(b.announce).toMatch(/^You attack with Bear Cub and Brazen Scourge and Swab Goblin\./);
  });
});

describe("pool", () => {
  it("hands out a fixed number of items and recycles them", () => {
    const pool = new Pool(3, (i) => ({ i, v: 0 }), (x) => { x.v = 0; });
    const a = pool.acquire()!; const b = pool.acquire()!; const c = pool.acquire()!;
    expect(pool.acquire()).toBeNull();
    a.v = 9; pool.release(a);
    expect(pool.available).toBe(1);
    const d = pool.acquire()!;
    expect(d.v).toBe(0); // reset on reuse
    expect(pool.inUse).toBe(3);
    pool.releaseAll();
    expect(pool.available).toBe(3);
    void b; void c;
  });
});

describe("table machine", () => {
  const machine = (motion: "off" | "gentle" | "full" = "gentle") => new TableMachine({ scenario: scenarioById("cast-a-creature")!, motion, sound: false, autoMana: true, autoResolve: true });

  it("auto-pays mana and auto-resolves the learner's creature in one act", () => {
    const m = machine("off");
    m.start();
    const batch = m.castFromHand(inHand(m.state, "cub"));
    expect(batch).not.toBeNull();
    expect(bf(m.state, "cub")).toBeTruthy();
    expect(m.state.stack).toHaveLength(0);
    expect(m.snapshot().feedback).toMatchObject({ kind: "done" });
    expect(m.snapshot().pending).toBeNull(); // motion off: nothing to play
  });

  it("locks input while cues play, and unlocks when the view reports they're done", () => {
    const m = machine("gentle");
    m.start();
    const batch = m.castFromHand(inHand(m.state, "cub"))!;
    expect(batch.total).toBeGreaterThan(0);
    expect(m.snapshot().pending).toBe(batch);
    expect(m.act({ type: "goToCombat" })).toBeNull(); // locked
    m.cuesDone();
    expect(m.snapshot().pending).toBeNull();
    expect(m.act({ type: "goToCombat" })).not.toBeNull();
  });

  it("undo mid-batch drops the cues and restores the earlier state", () => {
    const m = machine("gentle");
    m.start();
    m.castFromHand(inHand(m.state, "cub"));
    expect(m.snapshot().pending).not.toBeNull();
    const snap = m.undo();
    expect(snap.pending).toBeNull();
    expect(bf(snap.state, "cub")).toBeUndefined();
    expect(snap.canUndo).toBe(false);
  });

  it("a refused move becomes a hint, never a state change", () => {
    const m = new TableMachine({ scenario: scenarioById("cast-a-creature")!, motion: "off", sound: false, autoMana: false, autoResolve: true });
    m.start();
    const before = m.state;
    expect(m.act({ type: "cast", uid: inHand(before, "cub") })).toBeNull();
    expect(m.state).toBe(before);
    expect(m.snapshot().feedback?.text).toMatch(/Tap your lands first/);
  });

  it("pause blocks input; resume restores it", () => {
    const m = machine("off");
    m.start(); m.pause();
    expect(m.snapshot().mode).toBe("PAUSED");
    expect(m.castFromHand(inHand(m.state, "cub"))).toBeNull();
    m.resume();
    expect(m.castFromHand(inHand(m.state, "cub"))).not.toBeNull();
  });

  it("a game that ends moves to DEFEAT or VICTORY, and undo brings it back to PLAYING", () => {
    const match = makeMatch({ yourDeck: "red-fire", oppDeck: "green-growth", seed: 5 });
    const m = new TableMachine({ scenario: match, motion: "off", sound: false, autoMana: true, autoResolve: true });
    m.start();
    // Force a losing position: opponent has a huge attacker, we have 1 life, it's their attack.
    const s = m.state;
    const forced: GameState = { ...s, turn: "opp", step: "blockers", you: { ...s.you, life: 1 }, battlefield: [...s.battlefield, { uid: "pX", card: "elemental", owner: "opp", tapped: true, summoningSick: false, damage: 0, pump: { power: 0, toughness: 0 }, deathtouched: false }], attackers: { pX: null } };
    (m as unknown as { history: GameState[] }).history = [s, forced];
    m.act({ type: "declareBlockers" });
    expect(m.snapshot().mode).toBe("DEFEAT");
    expect(m.snapshot().state.result).toBe("lose");
    const back = m.undo();
    expect(back.mode).toBe("PLAYING");
  });

  it("records the opponent's turn as a 'while you waited' summary", () => {
    const match = makeMatch({ yourDeck: "red-fire", oppDeck: "green-growth", seed: 2 });
    const m = new TableMachine({ scenario: match, motion: "off", sound: false, autoMana: true, autoResolve: true });
    m.start();
    const land = m.state.you.hand.find((u) => m.state.cards[u] === "mountain")!;
    m.castFromHand(land);
    m.endTurnFromMain1();
    const fb = m.snapshot().feedback;
    expect(fb?.kind).toBe("opp");
    expect(fb?.lines?.length).toBeGreaterThan(0);
  });
});
