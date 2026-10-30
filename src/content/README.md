# Content

All learning content is JSON, validated with Zod when the app loads (`schema.ts`, `validate.ts`).

## Add a module

1. Create `modules/NN-your-module.json` (copy `01-what-is-magic.json` as a starting point).
2. Give it a unique `id` (kebab-case) and a unique `order` (its position in the course).
3. Run `npm test`. The "all real content" test reports any problem with the file name and field.

No code changes are needed.

## Module fields

| Field | Rules |
|---|---|
| `id` | kebab-case, unique across modules |
| `order` | positive whole number, unique |
| `title`, `summary` | plain language |
| `estimatedMinutes` | 1–30 |
| `checklist[]` | `{ id, label }`. The learner ticks these off by hand |
| `steps[]` | at least one step |

## Step fields

| Field | Rules |
|---|---|
| `id`, `title` | kebab-case id, unique within the module |
| `body` | markdown subset, **max 120 words** (counted as the learner reads it) |
| `visual` | `{ type: "svg" \| "image" \| "placeholder", src, altText }`. `altText` is required |
| `glossaryTerms[]` | every `[[term]]` in the body must be listed here **and** exist in `glossary.json` |
| `ruleRefs[]` | at least one, formatted like `"CR 500.1"` or `"CR 104.3b"` |
| `tryIt` | optional interaction id (interactions arrive in later phases) |
| `check` | optional `{ question, options[{id,text}], correctOptionId, hint }`. Retries are unlimited and the hint is calm |

Unknown fields are rejected, so a typo like `"tittle"` fails loudly instead of silently.

## Markdown subset

```
**bold**                 emphasis (no italics anywhere)
- item                   bullet list line
(blank line)             new paragraph
[[library]]              glossary term: underlined, expands inline below the sentence
[[spell|spells]]         glossary term with different visible text
```

## Rules accuracy

- Every step cites the Comprehensive Rules (`ruleRefs`). Verify numbers against the current CR at https://magic.wizards.com/rules before publishing.
- Use only original, fictional example cards. If a real card is ever quoted, copy its exact Oracle text and add it to the verification list below for checking against Scryfall.

### Rule references to verify (author's note)

Every `ruleRefs` value used in the content, with how sure I am of the exact number.
**High**: I'm confident of the rule and its number. **Medium**: the rule is right, but the sub-number may have
shifted between Comprehensive Rules updates. Where I wasn't sure of the sub-rule, the content cites the whole
section (e.g. `CR 103`) instead of guessing. Verify against the current rules at https://magic.wizards.com/rules.

| Ref | Used for | Confidence |
|---|---|---|
| CR 100.1 | Magic is a game for two or more players, each with a deck | high |
| CR 100.2a | Constructed decks: at least 60 cards, max 4 copies (basic lands excepted) | high |
| CR 103 (section) | Starting the game: shuffle, life, who goes first, draw 7, first player skips first draw | high (section) |
| CR 103.5 | Mulligans (London mulligan: draw 7, bottom one per mulligan) | medium |
| CR 104.3b / c / d | Lose at 0 life / drawing from an empty library / 10 poison counters | high |
| CR 105.1 | The five colours | high |
| CR 106.1 | Mana is the primary resource | high |
| CR 106.4 | Mana pool empties at the end of each step and phase | high |
| CR 107.4 | Mana symbols, generic mana | medium |
| CR 109.3 | An object's characteristics (name, cost, type, text, P/T…) | medium |
| CR 110.4 | The permanent types | high |
| CR 112.1 | A spell is a card on the stack | high |
| CR 117.1 / 117.4 | Priority; all players pass in succession → top of stack resolves | high |
| CR 119.1 | Starting life total 20 | high |
| CR 120.3 | Results of damage (player loses life, damage marked on creatures) | medium |
| CR 201.1 / 202.1 / 202.3 | Name; mana cost; mana value | high |
| CR 205.1 / 205.2a / 205.3 | Type line; card types list; subtypes | high / medium / high |
| CR 207.1 / 207.2 | Text box; flavour and reminder text | medium |
| CR 208.1 | Power and toughness | high |
| CR 301.1 / 303.1 / 306.1 | Casting artifacts / enchantments / planeswalkers (main phase, empty stack) | medium |
| CR 302.1 / 302.6 | Casting creatures; summoning sickness | high |
| CR 304.1 / 307.1 | Instant timing; sorcery timing | high |
| CR 305.1 / 305.2 / 305.6 | Playing lands; one per turn; basic land mana abilities | high |
| CR 400.1 | The zones | high |
| CR 401.1 / 401.2 | Library; face down, order can't be changed | high / medium |
| CR 402.1 / 402.2 | Hand; maximum hand size seven | high |
| CR 403.1 / 404.1 / 404.2 | Battlefield; graveyard; graveyards are public | high / high / medium |
| CR 405.1 / 406.1 / 408.1 | Stack; exile; command zone | high / high / medium |
| CR 500.1 | Five phases in order | high |
| CR 501.1 / 502 / 503.1 / 504.1 | Beginning phase; untap step (section); upkeep; draw step | medium / high / medium / high |
| CR 505.1 / 506.1 | Main phase; combat phase steps | high |
| CR 508.1 / 509.1 / 510.2 | Declare attackers; declare blockers; damage dealt simultaneously | high |
| CR 512.1 / 513.1 / 514.1 / 514.2 | Ending phase; end step; cleanup discard; damage removed | medium / medium / high / high |
| CR 601.2a | Casting a spell puts it on the stack | medium |
| CR 606.3 | Loyalty abilities: once per turn, main phase, empty stack | medium |
| CR 608.1 / 608.2 | Resolving spells; instants and sorceries go to the graveyard as they finish resolving | medium |
| CR 702.1 / 702.2 / 702.7 / 702.9 / 702.10 / 702.19 | Keywords; Deathtouch; First strike; Flying; Haste; Trample | high |
| CR 704.5g | Creature with lethal damage is destroyed | high |
| CR 704.6c | 21 combat damage from one commander | medium |
| CR 903 / 903.4 / 903.5a / 903.5b / 903.7 / 903.8 | Commander; colour identity; 100 cards; singleton; 40 life; commander tax | high |
| CR 903.6 / 903.9a | Commander starts in command zone; may return to command zone | medium |

### Facts that aren't Comprehensive Rules (also verify)

| Fact | Where | Source |
|---|---|---|
| Standard uses recent sets that rotate out; playable in MTG Arena | Module 10 | Wizards format pages (formats change; check current Standard rules) |
| "A good hand usually has 2 to 5 lands" | Module 6 | Common beginner strategy advice, not a rule |
| Commander deck recipe: 36–38 lands, ~10 ramp, ~10 draw, 7–8 removal, ~5 board wipes | Module 10 | Tyrna, "Commander Stats" (community Google Doc you provided). Guidelines, not rules |
| Commander is the most popular casual format | Module 10 | Widely reported; soften if you prefer |

No real card names, costs or Oracle text are used anywhere. All example cards (Emberclaw Pup, Thornback Rhino,
Quick Denial) are fictional and follow the card design rules below.

## Card design rules for example cards

All example cards are original and fictional. Each one is checked against these rules, adapted from
Mark Rosewater's "Design 101" (Making Magic, 2003), before it goes into a lesson or the Practice Table:

1. **One idea per card.** One keyword or one effect, and short rules text. A beginner should
   understand the card from the card alone, with no extra explanation.
2. **Abilities work together.** If a card has two abilities, they support each other
   (e.g. First strike + Lifelink are both about combat). No unrelated "add-ons".
3. **Respect the colour wheel and card-type rules.** Each colour only does what that colour does
   (green: Reach, big creatures, mana; blue: Flying, counterspells, card draw; black: removal, Deathtouch,
   draining life; red: Haste, burn; white: tokens, life gain, First strike). Artifacts have generic
   mana costs, lands make mana, enchantments don't tap.
4. **Works under the Comprehensive Rules.** Rules text uses official wording patterns and is checked
   like any other rules claim (see "Rules accuracy" above).
5. **Realistic cost and power.** Close to real cards, so what the learner sees carries over to real games.
