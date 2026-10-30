// Content schema: TypeScript types + Zod validation for every content JSON file.
//
// Step bodies use a deliberately tiny markdown subset (rendered in Phase 3):
//   **bold**              emphasis (no italics anywhere)
//   - item                bullet list line
//   blank line            new paragraph
//   [[term-id]]           glossary term, shown underlined, expands inline
//   [[term-id|shown text]] glossary term with different visible text (e.g. plurals)
import { z } from "zod";

export const MAX_STEP_WORDS = 120;
export const MAX_DEFINITION_WORDS = 40;

const TERM_LINK = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;

/** Glossary ids referenced in a markdown body, in order of appearance. */
export function termLinks(markdown: string): string[] {
  return [...markdown.matchAll(TERM_LINK)].map((m) => m[1] ?? "");
}

/** The text a learner actually reads: markup removed, term links replaced by their visible words. */
export function plainText(markdown: string): string {
  return markdown
    .replace(TERM_LINK, (_m, id: string, label?: string) => label ?? id.replace(/-/g, " "))
    .replace(/\{([WUBRGC]|\d{1,2})\}/g, " $1 ")
    .replace(/\*\*/g, "")
    .replace(/^\s*-\s+/gm, "");
}

export function countWords(markdown: string): number {
  return plainText(markdown).split(/\s+/).filter(Boolean).length;
}

const Id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase-kebab-case, e.g. \"reading-a-card\"");
const NonEmpty = z.string().trim().min(1, "Can't be empty");
/** Comprehensive Rules reference, e.g. "CR 500.1" or "CR 104.3b". */
export const RuleRef = z.string().regex(/^CR \d{3}(\.\d+[a-z]?)?$/, "Rule references look like \"CR 500.1\"");

export const VisualSchema = z
  .object({
    type: z.enum(["svg", "image", "placeholder"]),
    /** svg: id of a built-in diagram · image: path or URL · placeholder: what the visual will show */
    src: NonEmpty,
    altText: NonEmpty,
  })
  .strict();

export const CheckSchema = z
  .object({
    question: NonEmpty,
    options: z.array(z.object({ id: Id, text: NonEmpty }).strict()).min(2).max(5),
    correctOptionId: Id,
    /** Shown calmly after a wrong answer. Unlimited retries; no scores. */
    hint: NonEmpty,
  })
  .strict()
  .superRefine((check, ctx) => {
    const ids = check.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Option ids must be unique" });
    if (!ids.includes(check.correctOptionId))
      ctx.addIssue({ code: "custom", path: ["correctOptionId"], message: `"${check.correctOptionId}" is not one of the option ids (${ids.join(", ")})` });
  });

export const StepSchema = z
  .object({
    id: Id,
    title: NonEmpty,
    body: NonEmpty,
    visual: VisualSchema,
    /** Optional. Read-aloud text; defaults to the body's plain text. */
    ttsText: NonEmpty.optional(),
    glossaryTerms: z.array(Id).default([]),
    /** At least one Comprehensive Rules reference, shown as a small footnote. */
    ruleRefs: z.array(RuleRef).min(1, "Every step needs at least one rule reference"),
    /** Optional interaction id (the interactions themselves arrive in later phases). */
    tryIt: Id.optional(),
    check: CheckSchema.optional(),
  })
  .strict()
  .superRefine((step, ctx) => {
    const words = countWords(step.body);
    if (words > MAX_STEP_WORDS)
      ctx.addIssue({ code: "custom", path: ["body"], message: `Body has ${words} words; the limit is ${MAX_STEP_WORDS}` });
    for (const id of termLinks(step.body)) {
      if (!step.glossaryTerms.includes(id))
        ctx.addIssue({ code: "custom", path: ["glossaryTerms"], message: `Body links [[${id}]] but glossaryTerms doesn't list "${id}"` });
    }
  });

export const ChecklistItemSchema = z.object({ id: Id, label: NonEmpty }).strict();

export const ModuleSchema = z
  .object({
    id: Id,
    /** Position in the course. Lets a new JSON file slot in without code changes. */
    order: z.number().int().positive(),
    title: NonEmpty,
    summary: NonEmpty,
    estimatedMinutes: z.number().int().min(1).max(30),
    checklist: z.array(ChecklistItemSchema),
    steps: z.array(StepSchema).min(1),
  })
  .strict()
  .superRefine((mod, ctx) => {
    const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
    for (const id of dupes(mod.steps.map((s) => s.id))) ctx.addIssue({ code: "custom", path: ["steps"], message: `Duplicate step id "${id}"` });
    for (const id of dupes(mod.checklist.map((c) => c.id))) ctx.addIssue({ code: "custom", path: ["checklist"], message: `Duplicate checklist id "${id}"` });
  });

export const GlossaryEntrySchema = z
  .object({
    id: Id,
    term: NonEmpty,
    definition: NonEmpty,
    ruleRef: RuleRef.optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    const words = countWords(entry.definition);
    if (words > MAX_DEFINITION_WORDS)
      ctx.addIssue({ code: "custom", path: ["definition"], message: `Definition has ${words} words; the limit is ${MAX_DEFINITION_WORDS}` });
  });

export const GlossarySchema = z.array(GlossaryEntrySchema);

export type Visual = z.infer<typeof VisualSchema>;
export type Check = z.infer<typeof CheckSchema>;
export type Step = z.infer<typeof StepSchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;
