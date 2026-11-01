import { describe, expect, it } from "vitest";
import { CDECKS, deckListText } from "./decks";
import { importDeck, loadMyDecks, saveMyDecks } from "./mydecks";

describe("your decks", () => {
  it("accepts a list the engine can run completely", () => {
    for (const d of CDECKS) {
      const r = importDeck(deckListText(d), d.name);
      expect(r.playable, `${d.name}: ${r.problems.join(" ")} ${r.unplayable.map((u) => u.name).join(",")}`).toBe(true);
      expect(r.deck!.cards).toHaveLength(99);
    }
  });
  it("names the cards it can't run and suggests playable swaps", () => {
    const text = deckListText(CDECKS[0]!).replace(/^1 (?!Lyra)([^\n]+)$/m, "1 Rhystic Study");
    const r = importDeck(text, "test");
    expect(r.playable).toBe(false);
    expect(r.unplayable.map((u) => u.name)).toContain("Rhystic Study");
    expect(r.unplayable[0]!.suggestions.length).toBeGreaterThan(0);
  });
  it("saves and loads decks with a fake storage", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } } as unknown as Storage;
    const r = importDeck(deckListText(CDECKS[1]!), "Storm");
    saveMyDecks([r.deck!], storage);
    expect(loadMyDecks(storage).map((d) => d.name)).toEqual(["Storm"]);
  });
});
