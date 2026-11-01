import { describe, expect, it } from "vitest";
import { GUIDES } from "./DeckGuides";

describe("deck guides", () => {
  it("finds the Lyra primer and takes its title from the first heading", () => {
    const g = GUIDES.find((x) => x.id === "lyra-dawnbringer-angels");
    expect(g).toBeDefined();
    expect(g!.title).toMatch(/^Lyra Dawnbringer/);
    expect(g!.markdown).toMatch(/\[\[Lyra Dawnbringer\]\]/);
  });
});
