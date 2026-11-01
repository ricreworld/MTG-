// The deck doctor: checks a Commander deck list the way an honest coach would, following the method in
// the claude-mtg-skills kit (MIT) the learner shared: the shape targets for a 100-card deck, the official
// Commander Bracket determination logic (floors set by concrete signals), and a strict star rubric where a
// deck that merely functions is three stars, and four or more must be earned with comparison data.
// Pure functions over the Foundations card data, so it runs offline; it never guesses from card names.

export type Role = "land" | "ramp" | "draw" | "removal" | "wipe" | "finisher" | "protection" | "recursion" | "tokens" | "lifegain" | "counters";

export interface LibraryCard { id: string; name: string; cost?: string; type: string; text?: string; pt?: string; rarity?: string }

export interface DeckLine { qty: number; name: string }

export interface CardReport { name: string; qty: number; mv: number; roles: Role[]; found: boolean; offIdentity: boolean }

export interface Shape { total: number; lands: number; ramp: number; draw: number; interaction: number; wipes: number; finishers: number; mv6plus: number; avgMv: number; creatures: number }

export interface Target { key: keyof Shape; label: string; min: number; max?: number; note: string }

/** The shape a 100-card Commander deck wants (claude-mtg-skills rating.md, "Structure & consistency"). */
export const TARGETS: Target[] = [
  { key: "lands", label: "Lands", min: 36, max: 39, note: "37 or 38 is the usual number; 36 only with a low curve and cheap card draw." },
  { key: "ramp", label: "Ramp (extra mana)", min: 10, note: "About 10 or 11 cards that make extra mana: mana rocks, mana creatures, land-fetching spells." },
  { key: "draw", label: "Card advantage", min: 12, note: "At least 12 cards that draw extra cards. Drawing then discarding doesn't count." },
  { key: "interaction", label: "Interaction (answers)", min: 10, note: "About 10 cards that destroy, exile, counter or bounce what opponents play." },
  { key: "wipes", label: "Board wipes", min: 2, max: 4, note: "2 to 4 cards that clear the whole table when you fall behind." },
];

export interface BracketReport { actual: 1 | 2 | 3 | 4 | 5; reason: string; moveUp: string; moveDown: string; gameChangers: string[]; signals: string[] }

export interface Report {
  lines: DeckLine[];
  cards: CardReport[];
  shape: Shape;
  commander: CardReport | null;
  identity: string;
  problems: string[];
  structure: { stars: number; notes: string[] };
  wincons: { stars: number; notes: string[] };
  bracket: BracketReport;
  overall: { stars: number; words: string; capped: string | null };
  notFound: string[];
}

/* ------------------------------------------------------------ parsing */

/** Reads "1 Card Name", "4x Card Name", "Card Name" lines. Blank lines and headings are skipped. */
export function parseList(text: string): DeckLine[] {
  const out: DeckLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\(.*?\)\s*[\w-]*\s*$/, "").replace(/#.*$/, "").replace(/\*CMDR\*/i, "").trim();
    if (!line || /^(deck|commander|sideboard|main|about)\b/i.test(line) || /^\/\//.test(line)) continue;
    const m = /^(\d+)\s*x?\s+(.+)$/.exec(line);
    if (m) out.push({ qty: Number(m[1]), name: m[2]!.trim() });
    else out.push({ qty: 1, name: line });
  }
  return out;
}

export const manaValue = (cost: string | undefined): number => {
  let n = 0;
  for (const sym of (cost ?? "").match(/\{([^}]+)\}/g) ?? []) { const s = sym.slice(1, -1); if (/^\d+$/.test(s)) n += Number(s); else if (s !== "X") n += 1; }
  return n;
};
export const colorIdentity = (card: LibraryCard): string => {
  const set = new Set<string>();
  for (const m of `${card.cost ?? ""} ${card.text ?? ""}`.matchAll(/\{([WUBRG])(?:\/[WUBRGP])?\}|\{[WUBRGP2]\/([WUBRG])\}/g)) { if (m[1]) set.add(m[1]); if (m[2]) set.add(m[2]); }
  if (/Basic Land/.test(card.type)) { const basic: Record<string, string> = { Plains: "W", Island: "U", Swamp: "B", Mountain: "R", Forest: "G" }; for (const [k, v] of Object.entries(basic)) if (card.type.includes(k)) set.add(v); }
  return ["W", "U", "B", "R", "G"].filter((c) => set.has(c)).join("");
};

/* ------------------------------------------------------------ roles (read the text, not the name) */

export function classify(card: LibraryCard): Role[] {
  const t = (card.text ?? "").replace(/\([^)]*\)/g, "");
  const type = card.type;
  const roles = new Set<Role>();
  const isLand = /\bLand\b/.test(type);
  if (isLand) roles.add("land");
  const addsMana = /Add \{|Add (one|two|three) mana|Add an amount of mana/.test(t);
  const fetchesLand = /search your library for (a|up to \w+) (basic )?land/i.test(t) || /put (a|that|them|those|it) (land card|basic land card|basic land cards)? ?onto the battlefield( tapped)?/i.test(t) && /land/i.test(t);
  if (!isLand && (addsMana || fetchesLand || /spells? you cast cost \{\d\} less/.test(t))) roles.add("ramp");
  if (/\bdraw (a|two|three|four|X|that many) cards?\b/i.test(t) && !/then discard|discard a card\. ?$/i.test(t)) roles.add("draw");
  if (/draw a card/i.test(t) && /whenever/i.test(t)) roles.add("draw");
  if (/(destroy|exile) target (creature|artifact|enchantment|permanent|nonland|planeswalker)|deals? \d+ damage to (target|any target|each creature|each opponent's)|counter target|return target (creature|permanent|nonland).* to its owner's hand|target creature gets -\d|fights? target|deals damage equal to its power to target|exile target .* until/i.test(t)) roles.add("removal");
  if (/destroy all|exile all|each creature gets -\d|deals \d+ damage to each creature|all creatures get -/i.test(t) && !isLand) roles.add("wipe");
  if (/hexproof|indestructible|counter target spell|protection from|can't be countered|regenerate|phase out/i.test(t) && !/^(Legendary )?Creature/.test(type)) roles.add("protection");
  if (/return target .* card from your graveyard|return .* from your graveyard to the battlefield|from your graveyard to your hand/i.test(t)) roles.add("recursion");
  if (/create (a|two|three|four|five|X|that many) .*tokens?/i.test(t)) roles.add("tokens");
  if (/you gain \d+ life|lifelink|whenever you gain life/i.test(t)) roles.add("lifegain");
  if (/\+1\/\+1 counter/i.test(t)) roles.add("counters");
  const pt = card.pt ? Number(card.pt.split("/")[0]) : 0;
  const evasive = /flying|trample|menace|can't be blocked|double strike/i.test(t);
  if (/Creature/.test(type) && (pt >= 5 || (pt >= 4 && evasive))) roles.add("finisher");
  if (/each opponent loses \d+ life|you win the game|deals X damage|double the power/i.test(t) && !roles.has("removal")) roles.add("finisher");
  return [...roles];
}

/* ------------------------------------------------------------ brackets (official determination logic) */

/** Cards on Wizards' Commander Game Changers list, as published in October 2025. The list moves; verify on magic.wizards.com. */
export const GAME_CHANGERS = [
  "Ancient Tomb", "Aura Shards", "Bolas's Citadel", "Braids, Cabal Minion", "Chrome Mox", "Coalition Victory", "Consecrated Sphinx", "Crop Rotation", "Cyclonic Rift",
  "Deflecting Swat", "Demonic Tutor", "Drannith Magistrate", "Enlightened Tutor", "Expropriate", "Fierce Guardianship", "Food Chain", "Force of Will", "Gaea's Cradle",
  "Glacial Chasm", "Grim Monolith", "Humility", "Imperial Seal", "Intuition", "Jeska's Will", "Kinnan, Bonder Prodigy", "Lion's Eye Diamond", "Mana Vault", "Mishra's Workshop",
  "Mox Diamond", "Mystical Tutor", "Narset, Parter of Veils", "Natural Order", "Notion Thief", "Opposition Agent", "Orcish Bowmasters", "Panoptic Mirror", "Rhystic Study",
  "Seedborn Muse", "Serra's Sanctum", "Smothering Tithe", "Survival of the Fittest", "Sway of the Stars", "Tergrid, God of Fright", "Thassa's Oracle", "The One Ring",
  "The Tabernacle at Pendrell Vale", "Underworld Breach", "Vampiric Tutor", "Vorinclex, Voice of Hunger", "Winota, Joiner of Forces", "Worldly Tutor", "Yuriko, the Tiger's Shadow",
];

export function determineBracket(lines: DeckLine[], cards: CardReport[], byName: Map<string, LibraryCard>): BracketReport {
  const names = lines.map((l) => l.name);
  const gameChangers = names.filter((n) => GAME_CHANGERS.some((g) => g.toLowerCase() === n.toLowerCase()));
  const texts = cards.map((c) => byName.get(c.name.toLowerCase())?.text ?? "");
  const mld = texts.some((t) => /destroy all lands|each player sacrifices all lands|lands don't untap/i.test(t));
  const extraTurns = texts.filter((t) => /take an extra turn/i.test(t)).length;
  const tutors = texts.filter((t) => /search your library for a card|search your library for a creature card|search your library for an? (artifact|enchantment|instant|sorcery)/i.test(t)).length;
  const signals: string[] = [];
  let floor: 1 | 2 | 3 | 4 | 5 = 2;
  if (gameChangers.length >= 4) { floor = 4; signals.push(`${gameChangers.length} Game Changers (4 or more forces Bracket 4).`); }
  else if (gameChangers.length >= 1) { floor = 3; signals.push(`${gameChangers.length} Game Changer${gameChangers.length === 1 ? "" : "s"} (any one makes the deck at least Bracket 3).`); }
  else signals.push("0 Game Changers.");
  if (mld) { floor = 4; signals.push("Mass land denial (forbidden below Bracket 4)."); } else signals.push("No mass land denial.");
  if (extraTurns >= 3) { floor = 4; signals.push(`${extraTurns} extra-turn cards (chained extra turns force Bracket 4).`); } else signals.push(extraTurns ? `${extraTurns} extra-turn card${extraTurns === 1 ? "" : "s"} (a low quantity is fine).` : "No extra-turn cards.");
  signals.push(tutors ? `${tutors} tutor${tutors === 1 ? "" : "s"} (a power signal, no hard cap).` : "No tutors.");
  signals.push("Two-card infinite combos: this checker can't spot them; say so at the table if you know of one.");
  const reason = floor === 2 ? "Nothing forces a higher floor: 0 Game Changers, no mass land denial, no chained extra turns, light tutoring. A well-tuned deck with none of those signals is still Bracket 2." : floor === 3 ? "A Game Changer sets the floor at Bracket 3." : "A Bracket 4 signal is present.";
  return {
    actual: floor, reason, gameChangers, signals,
    moveUp: floor === 2 ? "Add up to 3 Game Changers in your colours, or a compact two-card win that comes online late; tighten tutors and run cheaper interaction. Even one Game Changer crosses the line to Bracket 3." : floor === 3 ? "Add an early, cheap two-card infinite combo, exceed 3 Game Changers, add mass land denial or chained extra turns, or stack fast mana and tutors into a consistent fast kill." : "Bracket 5 is about intent and tuning against the competitive metagame, not deck-building limits.",
    moveDown: floor === 2 ? "Bracket 1 is for theme-first decks with deliberately weak win conditions." : "Cut Game Changers to 0, remove any early combo and all mass land denial, thin tutors and fast mana, and lean on wins that close over several turns.",
  };
}

/* ------------------------------------------------------------ the check */

export function checkDeck(lines: DeckLine[], library: LibraryCard[], commanderName?: string): Report {
  const byName = new Map<string, LibraryCard>();
  for (const c of library) if (!byName.has(c.name.toLowerCase())) byName.set(c.name.toLowerCase(), c);
  const cmdCard = commanderName ? byName.get(commanderName.toLowerCase()) : undefined;
  const identity = cmdCard ? colorIdentity(cmdCard) : "";
  const cards: CardReport[] = [];
  const notFound: string[] = [];
  for (const l of lines) {
    const c = byName.get(l.name.toLowerCase());
    if (!c) { notFound.push(l.name); cards.push({ name: l.name, qty: l.qty, mv: 0, roles: [], found: false, offIdentity: false }); continue; }
    const off = !!cmdCard && [...colorIdentity(c)].some((x) => !identity.includes(x));
    cards.push({ name: c.name, qty: l.qty, mv: manaValue(c.cost), roles: classify(c), found: true, offIdentity: off });
  }
  const found = cards.filter((c) => c.found);
  const count = (role: Role) => found.filter((c) => c.roles.includes(role)).reduce((n, c) => n + c.qty, 0);
  const total = cards.reduce((n, c) => n + c.qty, 0) + (cmdCard ? 1 : 0);
  const nonland = found.filter((c) => !c.roles.includes("land"));
  const nonlandCount = nonland.reduce((n, c) => n + c.qty, 0);
  const shape: Shape = {
    total, lands: count("land"), ramp: count("ramp"), draw: count("draw"), interaction: count("removal") + count("wipe"), wipes: count("wipe"), finishers: count("finisher"),
    mv6plus: nonland.filter((c) => c.mv >= 6).reduce((n, c) => n + c.qty, 0),
    avgMv: nonlandCount ? Math.round((nonland.reduce((n, c) => n + c.mv * c.qty, 0) / nonlandCount) * 10) / 10 : 0,
    creatures: found.filter((c) => /Creature/.test(byName.get(c.name.toLowerCase())?.type ?? "")).reduce((n, c) => n + c.qty, 0),
  };

  const problems: string[] = [];
  if (commanderName && !cmdCard) problems.push(`The commander "${commanderName}" isn't a Foundations card, so colour identity wasn't checked.`);
  if (total !== 100) problems.push(`A Commander deck is exactly 100 cards counting the commander; this list has ${total}.`);
  const dupes = cards.filter((c) => c.found && c.qty > 1 && !/Basic Land/.test(byName.get(c.name.toLowerCase())?.type ?? ""));
  for (const d of dupes) problems.push(`${d.name} appears ${d.qty} times; only basic lands may repeat.`);
  const off = cards.filter((c) => c.offIdentity);
  if (off.length) problems.push(`Outside the commander's colour identity (${identity || "colourless"}): ${off.map((c) => c.name).join(", ")}.`);
  if (notFound.length) problems.push(`Not in Foundations, so not checked: ${notFound.slice(0, 8).join(", ")}${notFound.length > 8 ? ` and ${notFound.length - 8} more` : ""}.`);

  // Structure & consistency, strictly: 3 = roughly on target; 2 = one serious miss; 1 = broken.
  const notes: string[] = [];
  let misses = 0; let serious = 0;
  for (const t of TARGETS) {
    const v = shape[t.key];
    const ok = v >= t.min && (t.max === undefined || v <= t.max);
    const bad = t.key === "lands" ? v <= 34 || v >= 42 : v < t.min * 0.66;
    notes.push(`${t.label}: ${v}${ok ? " (on target)" : t.max !== undefined && v > t.max ? ` (want ${t.min} to ${t.max})` : ` (want ${t.min}${t.max !== undefined ? ` to ${t.max}` : "+"})`}.`);
    if (!ok) misses++;
    if (bad) serious++;
  }
  notes.push(`Cards costing 6 or more: ${shape.mv6plus} (want 3 or 4). Average cost of nonland cards: ${shape.avgMv}.`);
  if (shape.mv6plus > 6) misses++;
  const structureStars = serious >= 2 || shape.lands <= 30 ? 1 : serious === 1 || misses >= 3 ? 2 : misses >= 1 ? 2.5 : 3;

  const winNotes: string[] = [];
  const fin = shape.finishers;
  winNotes.push(`${fin} finisher${fin === 1 ? "" : "s"} (big or evasive creatures and cards that end games).`);
  if (count("tokens") >= 6) winNotes.push(`${count("tokens")} token makers: going wide is a plan.`);
  if (count("lifegain") >= 8) winNotes.push(`${count("lifegain")} life-gain cards: a drain or lifegain plan.`);
  if (count("counters") >= 6) winNotes.push(`${count("counters")} +1/+1 counter cards: growing a board is a plan.`);
  const winStars = fin >= 6 ? 3 : fin >= 3 ? 2.5 : fin >= 1 ? 2 : 1;

  const bracket = determineBracket(lines, cards, byName);
  // The "it just functions" ceiling: without comparison data (we're offline, Foundations only), four-plus stars can't be earned.
  const fundamentalsMissing = shape.lands <= 34 || shape.draw < 8 || shape.interaction < 4;
  let overall = Math.round((0.3 * structureStars + 0.25 * 3 + 0.2 * 3 + 0.15 * winStars + 0.1 * 5) * 2) / 2;
  let capped: string | null = "Capped at three stars: four or more must be earned by matching proven decklists, and this offline check has no comparison data.";
  if (fundamentalsMissing) { overall = Math.min(overall, 2.5); capped = "Capped at two and a half: a fundamental is missing (lands, card draw or interaction), and that loses games whatever else the deck does."; }
  if (structureStars <= 1 || winStars <= 1) overall = Math.min(overall, 3);
  overall = Math.min(overall, 3);
  const words = overall >= 3 ? "solid: it functions" : overall >= 2 ? "rough" : "needs work";
  const commander = cmdCard ? { name: cmdCard.name, qty: 1, mv: manaValue(cmdCard.cost), roles: classify(cmdCard), found: true, offIdentity: false } : null;
  return { lines, cards, shape, commander, identity, problems, structure: { stars: structureStars, notes }, wincons: { stars: winStars, notes: winNotes }, bracket, overall: { stars: overall, words, capped }, notFound };
}

export const stars = (n: number): string => "★".repeat(Math.floor(n)) + (n % 1 ? "½" : "") + "☆".repeat(Math.max(0, 5 - Math.ceil(n)));
