// Validates all content together: each file against its schema, then cross-file rules
// (unique module ids and order, every glossary term a step uses exists). Pure, so it's testable.
import type { ZodError } from "zod";
import { GlossarySchema, ModuleSchema, type GlossaryEntry, type Module } from "./schema";

export interface ContentError {
  file: string;
  path: string;
  message: string;
}

export interface Content {
  modules: Module[];                     // sorted by `order`
  glossary: Map<string, GlossaryEntry>;  // keyed by term id
  errors: ContentError[];                // empty when everything is valid
}

const toErrors = (file: string, err: ZodError): ContentError[] =>
  err.issues.map((i) => ({ file, path: i.path.join(".") || "(root)", message: i.message }));

/** @param moduleFiles map of file name -> parsed JSON  @param glossaryFile parsed glossary JSON */
export function validateContent(moduleFiles: Record<string, unknown>, glossaryFile: unknown, glossaryName = "glossary.json"): Content {
  const errors: ContentError[] = [];

  const g = GlossarySchema.safeParse(glossaryFile);
  const glossary = new Map<string, GlossaryEntry>();
  if (g.success) {
    for (const entry of g.data) {
      if (glossary.has(entry.id)) errors.push({ file: glossaryName, path: entry.id, message: `Duplicate glossary id "${entry.id}"` });
      glossary.set(entry.id, entry);
    }
  } else errors.push(...toErrors(glossaryName, g.error));

  const modules: Module[] = [];
  const seenIds = new Map<string, string>();
  const seenOrder = new Map<number, string>();
  for (const [file, raw] of Object.entries(moduleFiles)) {
    const r = ModuleSchema.safeParse(raw);
    if (!r.success) { errors.push(...toErrors(file, r.error)); continue; }
    const mod = r.data;
    const idClash = seenIds.get(mod.id);
    if (idClash) errors.push({ file, path: "id", message: `Module id "${mod.id}" is also used in ${idClash}` });
    const orderClash = seenOrder.get(mod.order);
    if (orderClash) errors.push({ file, path: "order", message: `Order ${mod.order} is also used in ${orderClash}` });
    seenIds.set(mod.id, file);
    seenOrder.set(mod.order, file);
    mod.steps.forEach((step, i) => {
      for (const term of step.glossaryTerms) {
        if (g.success && !glossary.has(term))
          errors.push({ file, path: `steps.${i}.glossaryTerms`, message: `Glossary term "${term}" isn't defined in ${glossaryName}` });
      }
    });
    modules.push(mod);
  }
  modules.sort((a, b) => a.order - b.order);
  return { modules, glossary, errors };
}
