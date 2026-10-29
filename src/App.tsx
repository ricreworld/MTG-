// Phase 1: a token preview page that proves the design tokens and settings work.
// Phase 3 replaces this with the real app shell (wizard layout, nav bar, Focus Mode).
import type { ReactNode } from "react";
import { ManaSymbol, type ManaColor } from "./components/ManaSymbol";
import { SettingsControls } from "./components/SettingsControls";

const SURFACES = [
  { name: "bg", cls: "bg-bg" },
  { name: "surface", cls: "bg-surface" },
  { name: "surface-2", cls: "bg-surface-2" },
  { name: "accent-soft", cls: "bg-accent-soft" },
  { name: "success-soft", cls: "bg-success-soft" },
  { name: "hint-soft", cls: "bg-hint-soft" },
];

const COLORS: ManaColor[] = ["W", "U", "B", "R", "G", "C"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <section aria-labelledby={id} className="grid gap-s4 rounded-lg border border-border bg-surface p-s5">
      <h2 id={id} className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function App() {
  return (
    <main className="mx-auto grid max-w-[60rem] gap-s5 px-s4 py-s6">
      <header className="grid gap-s2">
        <h1 className="text-2xl font-bold">Mana Steps</h1>
        <p className="text-text-muted">Phase 1 preview: design tokens and settings. Change a setting and the whole page follows. Your choices save automatically.</p>
      </header>

      <Section title="Settings">
        <SettingsControls />
      </Section>

      <Section title="The five colors of Magic">
        <p>Each color has its own symbol and is always shown with its name, so color is never the only signal.</p>
        <ul className="flex flex-wrap gap-s4" role="list">
          {COLORS.map((c) => (
            <li key={c} className="rounded-md border border-border-strong bg-surface-2 px-s4 py-s3">
              <ManaSymbol color={c} size={2} showLabel />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Surfaces">
        <ul className="grid grid-cols-2 gap-s3 sm:grid-cols-3" role="list">
          {SURFACES.map((s) => (
            <li key={s.name} className={`${s.cls} rounded-md border border-border-strong p-s4`}>
              <span className="font-mono text-sm">{s.name}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type scale">
        <p className="text-2xl font-bold">2xl: Step 3, Combat</p>
        <p className="text-xl font-bold">xl: Declare attackers</p>
        <p className="text-lg">lg: Tap a creature to attack.</p>
        <p className="text-base">base: Untapped creatures can block. Damage happens at the same time.</p>
        <p className="text-sm text-text-muted">sm (muted): Rule reference: CR 506.1</p>
      </Section>

      <Section title="Feedback without red">
        <div className="flex items-start gap-s3 rounded-md bg-success-soft p-s4">
          <span aria-hidden="true" className="font-bold text-success">✓</span>
          <p><strong className="text-success">Correct.</strong> A creature with Haste can attack the turn it arrives.</p>
        </div>
        <div className="flex items-start gap-s3 rounded-md bg-hint-soft p-s4">
          <span aria-hidden="true" className="font-bold text-hint">i</span>
          <p><strong className="text-hint">Hint:</strong> Look at the bottom-right numbers. Try again whenever you're ready.</p>
        </div>
      </Section>

      <Section title="Buttons and focus ring">
        <p>Press Tab to see the focus ring. Every button is at least 44 by 44 pixels.</p>
        <div className="flex flex-wrap gap-s3">
          <button type="button" className="min-h-tap rounded-md border-2 border-border-strong bg-surface px-s5 font-bold">← Back</button>
          <button type="button" className="min-h-tap rounded-md border-2 border-border-strong bg-surface px-s5 font-bold">Pause and save</button>
          <button type="button" className="min-h-tap rounded-md bg-accent px-s5 font-bold text-accent-ink">Next →</button>
        </div>
      </Section>
    </main>
  );
}
