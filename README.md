# Mana Steps

A calm, step-by-step, game-like tutorial that teaches complete beginners to play Magic: The Gathering.
Designed for neurodivergent learners (ADHD, autism, dyslexia).

**Stack:** Vite + React + TypeScript (strict) + Tailwind CSS. No backend. Progress is saved in localStorage.

## Run it

```bash
npm install      # .npmrc sets legacy-peer-deps (works around an npm resolver crash)
npm run dev      # local dev server
npm test         # unit tests (Vitest)
npm run build    # type-check + production build into dist/
```

## Structure

```
index.html                 HTML entry. Loads Atkinson Hyperlegible + Lexend from Google Fonts
tailwind.config.ts         Tailwind theme: every value points at a CSS variable
vite.config.ts             Vite + Vitest config (relative base path)
src/
  main.tsx                 Applies saved settings before first paint, then mounts <App>
  App.tsx                  Phase 1: token preview page (replaced by the app shell in Phase 3)
  index.css                Tailwind layers + global rules (no italics, focus ring, motion off)
  styles/tokens.css        DESIGN TOKENS: colors, type, spacing, radius, motion
  theme/
    settings.ts            Settings types, defaults, reducer, sanitizer, DOM mapping (pure)
    settings.test.ts       Unit tests for the settings logic
    SettingsContext.tsx    React context: load, autosave, apply settings
  lib/storage.ts           Safe localStorage helpers (never throw)
  components/
    ManaSymbol.tsx         The 5 MTG colors + colorless, each with its own symbol
    SettingsControls.tsx   Settings form (moves into the settings panel in Phase 3)
  content/                 Phase 2: schema.ts (Zod) + modules/*.json
  features/                Phase 3–7: shell, progress, practice, tts
  game/                    Phase 6: engine.ts (pure reducer) + tests
legacy/                    The earlier single-file prototype (Planeswalker Quest), kept for reference
```

## How theming works

- `src/styles/tokens.css` defines every color as RGB channels on `:root` (dark is the default),
  and overrides them under `[data-theme="light"]`.
- Settings write data attributes (`data-theme`, `data-font`, `data-motion`, `data-focus-mode`)
  and CSS variables (`--root-size`, `--leading`, `--tracking`, `--word-spacing`) onto `<html>`.
- All sizes are in rem, so the 4 text-size steps scale the whole UI.
- Animations are off by default. Turning them on still respects `prefers-reduced-motion`.

## Accessibility rules baked into the tokens

- No pure black on pure white. Every text pair meets WCAG 2.2 AA (ratios are noted in `tokens.css`).
- Color is never the only signal: MTG colors always show a symbol and a name, and feedback uses icons and words.
- Minimum target size 44×44px (`min-h-tap`), and one visible focus ring everywhere.
- Left-aligned text, max line length about 65 characters, line height 1.5 to 2.0.

## Phase plan

1. ✅ Scaffold, file structure, design tokens, Tailwind config, settings context
2. Content schema (TypeScript + Zod) and a sample module
3. App shell: wizard layout, navigation bar, settings panel, Focus Mode
4. Progress engine: save/resume, checklist, progress bar
5. Full MTG curriculum
6. Practice Table mini-game (pure reducer + Vitest)
7. Text-to-speech (Web Speech API)
8. Accessibility audit (axe-core + keyboard walkthrough)
