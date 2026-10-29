// Loads every module JSON in ./modules at build time and validates it at load time.
// To add a module: drop a new JSON file into src/content/modules/. No code changes needed.
import glossaryFile from "./glossary.json";
import { validateContent, type Content } from "./validate";

const moduleFiles = import.meta.glob<unknown>("./modules/*.json", { eager: true, import: "default" });

const named = Object.fromEntries(
  Object.entries(moduleFiles).map(([path, data]) => [path.replace("./modules/", ""), data]),
);

export const content: Content = validateContent(named, glossaryFile);

if (content.errors.length > 0) {
  // Phase 3 shows these calmly in the UI as well. Here they're logged for authors.
  console.error(
    "Mana Steps content has problems:\n" +
      content.errors.map((e) => `  ${e.file} › ${e.path}: ${e.message}`).join("\n"),
  );
}
