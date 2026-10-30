import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";

/** Writes dist/sw.js with the exact list of built files, so the installed app works offline. */
function offlineServiceWorker(): Plugin {
  return {
    name: "mana-steps-offline",
    apply: "build",
    generateBundle(_options, bundle) {
      // Skip source maps and old .woff fonts: every current phone uses the .woff2 versions.
      const built = Object.keys(bundle).filter((f) => !f.endsWith(".map") && !f.endsWith(".woff"));
      const fromPublic = (readdirSync("public", { recursive: true }) as string[]).filter((f) => /\.[a-z0-9]+$/i.test(f) && !f.startsWith("."));
      const files = ["./", ...new Set([...built, ...fromPublic])].map((f) => (f === "./" ? f : `./${f}`));
      const version = createHash("sha256").update(files.join("|")).digest("hex").slice(0, 12);
      const source = readFileSync("sw-template.js", "utf8")
        .replace("__VERSION__", version)
        .replace("__FILES__", JSON.stringify(files, null, 2));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

// base "./" keeps asset paths relative, so the built app works from any folder or subpath.
export default defineConfig({
  base: "./",
  plugins: [react(), offlineServiceWorker()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
