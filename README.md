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

The deck-building method (shape targets, synergy scoring, bracket determination, the star rubric) is adapted from the claude-mtg-skills kit by guuse, MIT licensed; the code here is a from-scratch TypeScript port that runs offline on Foundations data.

Mana Steps is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy
(https://company.wizards.com/en/legal/fancontentpolicy). It is free and must stay free, with no ads or
paid features. Card names, rules text and art are © Wizards of the Coast LLC. Card data and art crops come
from Scryfall (https://scryfall.com), which is not affiliated with this project. Everything else in the app
(lessons, code, frame design, icons) is original.

16. ✅ Pictures for every lesson step: 66 original SVG diagrams built from the app's colour tokens (`src/features/lesson/diagrams/`), plus real card images where a real card is the best picture. Lesson motion (step entry, progress bar, check feedback) follows the Motion setting. Art banners on the welcome card and the Practice screen.

17. ✅ Four-player Commander, the real thing: you and three computer players (Mara, Theo, Ines), four honest 100-card singleton decks, 40 life, clockwise turns, a defender chosen per attacker, any number of blockers, elimination, commander damage per commander, and a game that saves itself after every move so it can be picked up later. Everything is driven by real Foundations cards compiled from their Oracle text (see below).

18. ✅ Deck building, from the open-source claude-mtg-skills kit (MIT): a **Deck doctor** on the Commander screen that checks any Foundations deck list against the shape a 100-card deck wants (37 lands, 10 ramp, 12 card advantage, 10 answers with 2 to 4 wipes, few 6-drops), reads each card's job from its rules text, determines the bracket the deck actually is from the official signals (Game Changers, early combos, mass land denial, chained extra turns) and gives a strict star rating that never exceeds three without comparison data (`src/game/deckcheck.ts`, `src/features/commander/DeckCheck.tsx`); the four built-in decks rebuilt by the same method (role quotas, curve, synergy as points of contact) with a "how it wins" primer and an early/mid/late play guide each (`src/game/commander/decks.ts`); and lesson module 14, "Building a Commander deck" (shape, the five jobs, points of contact, ways to win, what sets the bracket, stars are not power).

19. ✅ Deck guides: primers written by the installed deck-building skills live in `src/content/guides/*.md` and show up under Practice > Deck guides, rendered with tappable card names that fetch the official image from Scryfall when online (`src/features/guides/`). The nine claude-mtg-skills skills are installed as project skills under `.claude/skills/` (MIT) for building, upgrading, rating and documenting decks in a Claude Code session; they need `data.scryfall.io` and `json.edhrec.com` allowed in the cloud environment's network settings.

20. ✅ The whole of Commander: the compiler now runs over every Commander-legal card pulled from Scryfall's API (32,115 cards, one printing each) and 4,815 of them compile exactly as printed. New families this phase: protection, cycling, "choose a creature type" cards, modal "choose one / choose two" spells (the human picks modes, the computer picks the mode that helps most), the monarch, Clues and investigate, "if you gained N or more life this turn", life-gain replacement effects, token replacement (Divine Visitation), cost reducers by creature type, colourless and identity-coloured mana rocks. Your decks: paste any Commander list under Commander > Your decks; the table checks every card, lists the ones the engine can't run with ranked playable swaps, saves the deck on your device and plays it against the three computer decks. Deck guides with a matching `.txt` list get a "Check and play this deck" button. Art for Foundations printings stays bundled; every other card's art loads from Scryfall when online.

21. ✅ Finishing pass: the last families for the Lyra deck (embalm, exalted, alternative costs like Sephara's, mana that can only be spent on one creature type like Giada's, cost reduction per counter, named counters, "note your life total", pay X, Addendum, Fellwar Stone's mana, Emeria Shepherd's landfall), so the guide's deck plays with zero swaps; the card library now offers the playable pool, the Foundations set, or every Commander-legal card (32,115, loaded once on request); four computer decks built from the whole pool around popular commanders (Elas il-Kor, Talrand, Aesi, Urabrask) with synergy read from each commander's own text, alongside the four Foundations starter decks. 4,873 cards compile.

22. ✅ Learn with your own deck: a "How to play this deck" guide the app writes offline from the cards (the plan, key cards with their points of contact, opening hand, early / middle / late turns, weak spots, every card grouped by job), for saved decks and the built-in ones (`src/game/commander/primer.ts`, `src/features/commander/DeckGuideView.tsx`); the table coach adds one deck-specific line from the same plan; five deck goals per deck tick themselves off while you play and are remembered per deck on the device.

## The compiled card pool (four-player Commander)

`tools/compile-cards.py` reads a Scryfall card file (the Foundations set, or every Commander-legal card: `--input .tmp/all/all.json --prefer .tmp/fdn/fdn.json`) and turns each card's exact Oracle text into a small structured form (`src/game/cards.generated.json`): keywords, static abilities, triggered abilities, activated abilities and spell effects. A card is included only when every sentence of its text compiles; otherwise it is left out. Nothing is approximated: 4,873 of the 32,115 Commander-legal cards make it. `.tmp/fetch-all.sh` pulls the pool from api.scryfall.com. `.tmp/compile-report.txt` lists why each other card was left out. `src/game/commander/` runs the pool: `engine.ts` (seats, zones, mana, the ability interpreter, triggers, combat, state-based actions), `ai.ts` (the three computer players, one step at a time so the human can respond or block), `decks.ts` (deterministic deck builder), `coach.ts` (threat order and advice), `save.ts` (one saved game in localStorage). `src/table/cmachine.ts` and `src/features/commander/` are the table.

Simplifications on this table, so a beginner can follow it: triggered abilities resolve at once instead of using the stack; a spell on the stack gets one response; mana is paid automatically from untapped sources; scry, surveil, which creature to sacrifice and discarding to hand size are decided for every player by simple rules of thumb; targets for triggered abilities are chosen by the same rules of thumb; an eliminated player's cards are kept in their graveyard rather than removed from the game. Each one is marked in the code with the Comprehensive Rules section it shortens.

## The table architecture (Steps 1 to 4 of the game-feel rebuild)

- `src/game/` is the pure rules engine, unchanged by presentation work.
- `src/table/` is the presentation core, with no React: `machine.ts` (state machine: SETUP, PLAYING, PAUSED, VICTORY, DEFEAT, REVIEW; history for Undo; input locked while cues play), `events.ts` (diff two states into TableEvents), `director.ts` (events to timed cues per motion level, compressed to a per-batch budget), `motion.ts` (Off / Gentle / Full timings and easings), `pool.ts` (fixed object pools), `audio.ts` (opt-in synthesised sound), `debug.ts` (console hooks and frame meter).
- `src/features/table/` renders it: `TableView.tsx` (felt mat, zones, hand tray, the sticky "Now" bar), `cues.ts` (plays a batch with the Web Animations API: FLIP slides, tap turns, floating numbers, ghosts for destroyed cards, pooled particles and a brief shake on Full only), `DebugPanel.tsx`.
- A tap while cues play skips to the end of them and then does what was tapped. Screen readers get one sentence per batch.
- Debug: turn on Settings > Debug panel, or use `window.__manaSteps` in the console (`state()`, `act(action)`, `events()`, `skip()`, `fps()`, `setMotion("full")`).
