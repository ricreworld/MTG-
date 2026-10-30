import { describe, expect, it } from "vitest";
import type { Module } from "../content/schema";
import { navigate, isFirst, isLast, clampPosition, START } from "./course/navigation";
import { parseBlocks, parseInline, termsInBlock } from "./lesson/markdown";

const mod = (id: string, steps: number) =>
  ({ id, order: 1, title: id, summary: "", estimatedMinutes: 1, checklist: [], steps: Array.from({ length: steps }, (_, i) => ({ id: `s${i}` })) }) as unknown as Module;
const course = [mod("a", 2), mod("b", 3)];

describe("navigation", () => {
  it("moves through steps and across modules", () => {
    let p = START;
    p = navigate(course, p, { type: "next" });
    expect(p).toEqual({ moduleIndex: 0, stepIndex: 1 });
    p = navigate(course, p, { type: "next" });
    expect(p).toEqual({ moduleIndex: 1, stepIndex: 0 });
    p = navigate(course, p, { type: "back" });
    expect(p).toEqual({ moduleIndex: 0, stepIndex: 1 });
  });
  it("stays put at the very start and the very end", () => {
    expect(navigate(course, START, { type: "back" })).toEqual(START);
    const end = { moduleIndex: 1, stepIndex: 2 };
    expect(isLast(course, end)).toBe(true);
    expect(navigate(course, end, { type: "next" })).toEqual(end);
    expect(isFirst(START)).toBe(true);
  });
  it("clamps positions that no longer exist", () => {
    expect(clampPosition(course, { moduleIndex: 9, stepIndex: 9 })).toEqual({ moduleIndex: 1, stepIndex: 2 });
    expect(navigate(course, START, { type: "goto", moduleIndex: 1, stepIndex: -4 })).toEqual({ moduleIndex: 1, stepIndex: 0 });
  });
});

describe("markdown subset", () => {
  it("parses bold and glossary terms, including terms inside bold", () => {
    expect(parseInline("Hi **[[deck|decks]] rule** and [[library]].")).toEqual([
      { kind: "text", text: "Hi " },
      { kind: "bold", children: [{ kind: "term", id: "deck", label: "decks" }, { kind: "text", text: " rule" }] },
      { kind: "text", text: " and " },
      { kind: "term", id: "library", label: undefined },
      { kind: "text", text: "." },
    ]);
  });
  it("splits paragraphs and lists", () => {
    const blocks = parseBlocks("Intro line\nsame paragraph.\n\n- one [[deck]]\n- two\n\nEnd.");
    expect(blocks.map((b) => b.kind)).toEqual(["p", "ul", "p"]);
    expect(blocks[1] && termsInBlock(blocks[1])).toEqual(["deck"]);
  });
  it("turns {R} and {2} into mana symbols", () => {
    expect(parseInline("Costs {2}{R}.")).toEqual([
      { kind: "text", text: "Costs " },
      { kind: "mana", symbol: "2" },
      { kind: "mana", symbol: "R" },
      { kind: "text", text: "." },
    ]);
    expect(parseInline("{X} stays text")).toEqual([{ kind: "text", text: "{X} stays text" }]);
  });
  it("never produces HTML from raw text", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([{ kind: "text", text: "<script>alert(1)</script>" }]);
  });
});
