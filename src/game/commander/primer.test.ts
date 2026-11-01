import { describe, expect, it } from "vitest";
import { CDECKS, FULL_DECKS } from "./decks";
import { CCARDS } from "./cards";
import { deckGoals, readPlan, writeGuide } from "./primer";

describe("how to play this deck", () => {
  it("reads a sensible plan for the built-in decks", () => {
    const plans = Object.fromEntries([...CDECKS, ...FULL_DECKS].map((d) => [d.name, readPlan(CCARDS[d.commander]!, d.cards.map((id) => CCARDS[id]!)).plan]));
    expect(plans["Dawn Chorus"]).toBe("lifegain");
    expect(["spells", "tokens"]).toContain(plans["Drake Storm"]);
    expect(plans["Tide Serpent"]).toBe("lands");
    expect(plans["Pilgrim's Toll"]).toBe("drain");
  });
  it("writes a complete guide with key cards, hand advice, three phases and every card grouped", () => {
    const d = FULL_DECKS[0]!;
    const g = writeGuide(d.commander, d.cards);
    expect(g.keyCards.length).toBeGreaterThanOrEqual(4);
    expect(g.openingHand).toMatch(/lands/);
    expect(g.early && g.mid && g.late).toBeTruthy();
    const listed = g.groups.reduce((n, grp) => n + grp.cards.length, 0);
    expect(listed).toBe(new Set(d.cards).size);
    expect(deckGoals(g.plan, g.commander)).toHaveLength(5);
  });
});
