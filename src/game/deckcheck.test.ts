// The deck doctor: role reading from Oracle text, the shape targets, the bracket determination and the strict rating.
import { describe, expect, it } from "vitest";
import library from "../content/foundations.json";
import { CDECKS, deckListText } from "./commander/decks";
import { checkDeck, classify, determineBracket, parseList, type LibraryCard } from "./deckcheck";

const LIB = library as LibraryCard[];
const card = (name: string): LibraryCard => { const c = LIB.find((x) => x.name === name); if (!c) throw new Error(name); return c; };

describe("deck doctor", () => {
  it("reads roles from the text, not the name", () => {
    expect(classify(card("Llanowar Elves"))).toContain("ramp");
    expect(classify(card("Solemn Simulacrum"))).toEqual(expect.arrayContaining(["ramp", "draw"]));
    expect(classify(card("Day of Judgment"))).toContain("wipe");
    expect(classify(card("Stab"))).toContain("removal");
    expect(classify(card("Cancel"))).toContain("removal");
    expect(classify(card("Helpful Hunter"))).toContain("draw");
    expect(classify(card("Thrill of Possibility"))).toContain("draw"); // draw two after discarding as a cost is still card draw
    expect(classify(card("Forest"))).toEqual(["land"]);
    expect(classify(card("Serra Angel"))).toContain("finisher");
  });

  it("parses the usual list formats", () => {
    expect(parseList("1 Lyra Dawnbringer *CMDR*\n\n4x Plains\nSerra Angel\n// comment\n2 Island (FDN) 123")).toEqual([
      { qty: 1, name: "Lyra Dawnbringer" }, { qty: 4, name: "Plains" }, { qty: 1, name: "Serra Angel" }, { qty: 2, name: "Island" },
    ]);
  });

  it("determines the bracket from signals, not vibes: a tuned deck with none is Bracket 2", () => {
    const lines = parseList("1 Serra Angel\n1 Sol Ring");
    const b = determineBracket(lines, lines.map((l) => ({ name: l.name, qty: 1, mv: 0, roles: [], found: true, offIdentity: false })), new Map());
    expect(b.actual).toBe(2);
    const withGc = determineBracket([{ qty: 1, name: "Rhystic Study" }], [], new Map());
    expect(withGc.actual).toBe(3);
    expect(withGc.gameChangers).toEqual(["Rhystic Study"]);
  });

  it("flags duplicates, off-identity cards and wrong deck size", () => {
    const r = checkDeck(parseList("2 Serra Angel\n1 Llanowar Elves\n30 Plains"), LIB, "Lyra Dawnbringer");
    expect(r.problems.some((p) => /Serra Angel appears 2 times/.test(p))).toBe(true);
    expect(r.problems.some((p) => /Outside the commander's colour identity/.test(p) && /Llanowar Elves/.test(p))).toBe(true);
    expect(r.problems.some((p) => /exactly 100 cards/.test(p))).toBe(true);
  });

  it("never gives more than three stars without comparison data, and caps lower when a fundamental is missing", () => {
    for (const d of CDECKS) {
      const lines = parseList(deckListText(d));
      const r = checkDeck(lines.slice(1), LIB, lines[0]!.name);
      expect(r.shape.total).toBe(100);
      expect(r.overall.stars).toBeLessThanOrEqual(3);
      expect(r.bracket.actual).toBe(2);
      expect(r.problems.filter((p) => !/Not in Foundations/.test(p))).toEqual([]);
      expect(r.shape.lands).toBeGreaterThanOrEqual(36);
      expect(r.shape.lands).toBeLessThanOrEqual(39);
    }
    const thin = checkDeck(parseList("60 Plains\n39 Serra Angel"), LIB, "Lyra Dawnbringer");
    expect(thin.overall.stars).toBeLessThanOrEqual(2.5);
    expect(thin.overall.capped).toMatch(/fundamental/);
  });
});
