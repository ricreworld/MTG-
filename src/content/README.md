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
| `ttsText` | optional; read-aloud uses the body's plain text if it's missing |
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

| Ref | Used for | Confidence |
|---|---|---|
| CR 100.1 | Magic is a game for two or more players, each with a deck | high |
| CR 100.2a | Constructed decks have at least 60 cards | high |
| CR 104.3b | A player with 0 or less life loses | high |
| CR 104.3c | Drawing from an empty library loses (checked as a state-based action) | high |
| CR 104.3d | 10 or more poison counters loses | high |
| CR 112.1 | A spell is a card on the stack | high |
| CR 119.1 | Starting life total is 20 | high |
| CR 401.1 | The library is where a player's deck goes when the game starts | high |
