import { describe, expect, it } from "vitest";
import glossary from "./glossary.json";
import { ModuleSchema, countWords, plainText, termLinks } from "./schema";
import { validateContent } from "./validate";

const moduleFiles = import.meta.glob<unknown>("./modules/*.json", { eager: true, import: "default" });

const validStep = {
  id: "s1",
  title: "A step",
  body: "Your [[library]] is your deck.",
  visual: { type: "placeholder", src: "A deck", altText: "A deck of cards" },
  glossaryTerms: ["library"],
  ruleRefs: ["CR 401.1"],
};
const validModule = { id: "m1", order: 99, title: "M", summary: "S", estimatedMinutes: 2, checklist: [], steps: [validStep] };
const withStep = (patch: Record<string, unknown>) => ({ ...validModule, steps: [{ ...validStep, ...patch }] });
const messages = (raw: unknown) => {
  const r = ModuleSchema.safeParse(raw);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("all real content", () => {
  it("has at least one module file", () => {
    expect(Object.keys(moduleFiles).length).toBeGreaterThan(0);
  });
  it("validates with zero errors", () => {
    const { errors, modules } = validateContent(moduleFiles, glossary);
    expect(errors).toEqual([]);
    expect(modules.map((m) => m.order)).toEqual([...modules.map((m) => m.order)].sort((a, b) => a - b));
  });
});

describe("markdown helpers", () => {
  it("counts the words a learner reads, not the markup", () => {
    expect(plainText("**Two** [[poison-counter|poison counters]] and [[library]]")).toBe("Two poison counters and library");
    expect(countWords("- **Empty** [[library]].\n- Poison.")).toBe(3);
    expect(termLinks("[[deck]] then [[spell|spells]]")).toEqual(["deck", "spell"]);
  });
});

describe("module schema rules", () => {
  it("accepts a valid module", () => {
    expect(messages(validModule)).toEqual([]);
  });
  it("rejects a body over 120 words", () => {
    expect(messages(withStep({ body: "word ".repeat(121) })).join()).toMatch(/121 words/);
  });
  it("rejects a check whose correct answer isn't an option", () => {
    const check = { question: "Q?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionId: "c", hint: "H" };
    expect(messages(withStep({ check })).join()).toMatch(/"c" is not one of the option ids/);
  });
  it("rejects a term link that isn't listed in glossaryTerms", () => {
    expect(messages(withStep({ glossaryTerms: [] })).join()).toMatch(/\[\[library\]\]/);
  });
  it("requires a rule reference in CR format", () => {
    expect(messages(withStep({ ruleRefs: [] })).join()).toMatch(/rule reference/);
    expect(messages(withStep({ ruleRefs: ["rule 500"] })).join()).toMatch(/CR 500\.1/);
  });
  it("rejects unknown fields, so typos don't pass silently", () => {
    expect(messages({ ...validModule, tittle: "oops" }).length).toBeGreaterThan(0);
  });
  it("rejects duplicate step ids", () => {
    expect(messages({ ...validModule, steps: [validStep, validStep] }).join()).toMatch(/Duplicate step id/);
  });
});

describe("cross-file validation", () => {
  it("names the file when a glossary term doesn't exist", () => {
    const bad = withStep({ body: "A [[not-a-real-term]] symbol.", glossaryTerms: ["not-a-real-term"] });
    const { errors } = validateContent({ "99-bad.json": bad }, glossary);
    expect(errors).toEqual([expect.objectContaining({ file: "99-bad.json", message: expect.stringMatching(/"not-a-real-term" isn't defined/) })]);
  });
  it("catches two modules with the same id or order", () => {
    const { errors } = validateContent({ "a.json": validModule, "b.json": validModule }, glossary);
    expect(errors.map((e) => e.path).sort()).toEqual(["id", "order"]);
  });
  it("keeps valid modules when another file is broken", () => {
    const { modules, errors } = validateContent({ "good.json": validModule, "bad.json": { id: "x" } }, glossary);
    expect(modules).toHaveLength(1);
    expect(errors.every((e) => e.file === "bad.json")).toBe(true);
  });
});
