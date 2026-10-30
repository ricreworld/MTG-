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

## Use it on your phone

Mana Steps is built for phones (iPhone and Android) and installs as a home-screen app:

1. Open the app's web address in **Safari** (iPhone) or **Chrome** (Android).
2. iPhone: tap **Share → Add to Home Screen**. Android: tap **⋮ → Add to Home screen** (or **Install app**).
3. Open it from the new icon. It runs full screen and **works offline** after the first visit (about 650 KB is saved).

Updates download in the background and apply the next time the app is fully closed and reopened,
so a lesson is never interrupted. Note: offline support needs the app served over https (or localhost).

## Publish (GitHub Pages)

`.github/workflows/pages.yml` tests, builds and publishes the app on every push.
One-time setup in the GitHub repo: **Settings → Pages → Source: GitHub Actions**.
If the first run says the branch isn't allowed, add the branch under **Settings → Environments → github-pages**.

## Structure

```
index.html                 HTML entry + phone/install meta tags (fonts are bundled via @fontsource)
public/                    App icons and manifest.webmanifest (home-screen install)
sw-template.js             Offline service worker; vite.config.ts fills in the file list at build time
tailwind.config.ts         Tailwind theme: every value points at a CSS variable
vite.config.ts             Vite + Vitest config, offline-file generator (relative base path)
src/
  main.tsx                 Applies saved settings before first paint, then mounts <App>
  App.tsx                  Mounts the app shell
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
  game/
    cards.ts               25 real Foundations cards (exact Oracle text; Fan Content Policy)
    engine.ts              Pure rules reducer: (state, action) -> state. No React, no randomness
    scenarios.ts           5 guided scenarios: setup, goal, hints, coach notes
    *.test.ts              Engine and scenario tests
  features/practice/       The Practice Table UI (GameCard, PracticeTable, ScenarioPicker)
legacy/                    The earlier single-file prototype (Planeswalker Quest), kept for reference
```

## How theming works

- `src/styles/tokens.css` defines every color as RGB channels on `:root` (dark is the default),
  and overrides them under `[data-theme="light"]`.
- Settings write data attributes (`data-theme`, `data-font`, `data-motion`, `data-focus-mode`)
  and CSS variables (`--root-size`, `--leading`, `--tracking`, `--word-spacing`) onto `<html>`.
- All sizes are in rem, so the 4 text-size steps scale the whole UI.
- Animations are off by default. Turning them on still respects `prefers-reduced-motion`.

## Accessibility checks

- `npm test` covers the settings, content, navigation, progress, engine and scenario logic (59 tests).
- The axe-core audit and phone walkthroughs were run with Playwright against the production build
  (iPhone 13 and Pixel 5 emulation, dark and light). Repeat them before a release.
- Everything works by tap or keyboard alone. Focus never jumps after an action; every control is at least 44px.

## Accessibility rules baked into the tokens

- No pure black on pure white. Every text pair meets WCAG 2.2 AA (ratios are noted in `tokens.css`).
- Color is never the only signal: MTG colors always show a symbol and a name, and feedback uses icons and words.
- Minimum target size 44×44px (`min-h-tap`), and one visible focus ring everywhere.
- Left-aligned text, max line length about 65 characters, line height 1.5 to 2.0.

## Phase plan

1. ✅ Scaffold, file structure, design tokens, Tailwind config, settings context
2. ✅ Content schema (TypeScript + Zod) and a sample module
3. ✅ App shell: wizard layout, navigation bar, settings panel, Focus Mode (phone-first, installable, offline)
4. ✅ Progress engine: save/resume, checklist, progress bar
5. ✅ Full MTG curriculum (13 modules, 70 steps)
6. ✅ Practice Table mini-game (pure reducer + Vitest, 5 guided scenarios with hints and Undo)
7. Text-to-speech: skipped on purpose (no voice, keep it simple)
8. ✅ Accessibility audit: axe-core (WCAG 2.2 AA + best practice) reports 0 violations on every screen in both themes; keyboard and screen-reader walkthrough done
9. ✅ Card frames: every practice card has a name bar, art box with mana cost, type line, text box and power/toughness box
9b. ✅ Real cards: the 25 practice cards are real Foundations cards with official art and exact Oracle text, under the Wizards Fan Content Policy (`public/art/`, `src/game/cards.ts`)
10. ✅ Decks and free play: five ready-made 30-card decks, a full game against a simple computer opponent (`src/game/ai.ts`), and a coach that suggests each move with a reason and flags weaker moves (`src/game/coach.ts`). Undo everything; losing shows a calm summary
11. ✅ Foundations card library: every card in the set (517) with official text, search and colour/type filters; pictures load from Scryfall when online (`src/features/library/`, `src/content/foundations.json`)
12. ✅ Commander in depth: a 10-step module (deck rules, command zone, tax, coming back, three ways to lose, four-player turns, mulligans, table talk, Rule 0 and brackets, first deck)
13. ✅ Commander on the table: 40 life, command zone, commander tax, commander damage, and four real commanders with their printed abilities (Syr Alin, Linden, Dwynen, Garna) against the computer
14. ✅ More ways to play: Limited (Draft, Sealed, Prerelease, 40-card deck shape) and Constructed (Standard, Pioneer, Modern, Pauper) with where to play each
15. ✅ Practice Table redesign after learner feedback ("I didn't know what to tap next"): a sticky bottom bar with one "Now:" instruction and one main button, Undo and Hint beside it; feedback and a "While you waited" summary of the computer's turn right above the bar; "Can play / Can cast / Can attack / Can block" prompts on cards; and a default setting that pays mana and resolves your own spells for you (off in the mana scenario, and switchable in Settings)

## Licensing of card content

Mana Steps is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy
(https://company.wizards.com/en/legal/fancontentpolicy). It is free and must stay free, with no ads or
paid features. Card names, rules text and art are © Wizards of the Coast LLC. Card data and art crops come
from Scryfall (https://scryfall.com), which is not affiliated with this project. Everything else in the app
(lessons, code, frame design, icons) is original.

## The table architecture (Steps 1 to 4 of the game-feel rebuild)

- `src/game/` is the pure rules engine, unchanged by presentation work.
- `src/table/` is the presentation core, with no React: `machine.ts` (state machine: SETUP, PLAYING, PAUSED, VICTORY, DEFEAT, REVIEW; history for Undo; input locked while cues play), `events.ts` (diff two states into TableEvents), `director.ts` (events to timed cues per motion level, compressed to a per-batch budget), `motion.ts` (Off / Gentle / Full timings and easings), `pool.ts` (fixed object pools), `audio.ts` (opt-in synthesised sound), `debug.ts` (console hooks and frame meter).
- `src/features/table/` renders it: `TableView.tsx` (felt mat, zones, hand tray, the sticky "Now" bar), `cues.ts` (plays a batch with the Web Animations API: FLIP slides, tap turns, floating numbers, ghosts for destroyed cards, pooled particles and a brief shake on Full only), `DebugPanel.tsx`.
- A tap while cues play skips to the end of them and then does what was tapped. Screen readers get one sentence per batch.
- Debug: turn on Settings > Debug panel, or use `window.__manaSteps` in the console (`state()`, `act(action)`, `events()`, `skip()`, `fps()`, `setMotion("full")`).
