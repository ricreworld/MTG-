// The four-player Commander engine: a pure reducer over an immutable state, like the Practice Table's
// engine, but for any number of seats and for the compiled Foundations card pool (cards.generated.json).
//
// What it runs honestly, with Comprehensive Rules references:
//   turns clockwise around the table (CR 500, 800.4), 40 life, the command zone, commander tax and
//   commander damage (CR 903), elimination and what leaves with a player (CR 800.4a), combat against a
//   chosen defender per attacker (CR 508.1), any number of blockers per attacker (CR 509), first strike and
//   double strike (CR 702.7), menace, trample, deathtouch, lifelink, vigilance, haste, defender, flying/reach,
//   indestructible, hexproof (CR 702), auras and equipment (CR 303.4, 301.5), tokens (CR 111), counters
//   (CR 122), triggered abilities (CR 603), activated abilities (CR 602), state-based actions (CR 704).
//
// Simplifications, all written down in README.md: triggered abilities resolve at once instead of using
// the stack; a spell on the stack can get one response; mana is paid automatically from untapped sources;
// scry, surveil and discard-to-hand-size choices are made for every player by simple rules of thumb;
// targets for triggered abilities are chosen by the same rules of thumb.
import { CCARDS, COLORS, COLOR_WORD, hasFlash, isAura, isEquipment, keywordsOf, manaValue, parseCost, subtypesOf, type Ability, type AbilityCost, type CDef, type Color, type Effect } from "./cards";

export type Seat = string;
export type Step = "main1" | "attackers" | "blockers" | "damage" | "main2" | "end";
export type Pool = Partial<Record<Color | "C", number>>;

export interface Perm {
  uid: string;
  card: string;
  controller: Seat;
  owner: Seat;
  tapped: boolean;
  summoningSick: boolean;
  damage: number;
  deathtouched: boolean;
  /** +1/+1 counters. */
  counters: number;
  /** Until end of turn. */
  pump: { p: number; t: number };
  granted: string[];
  cantBlockEOT?: boolean;
  /** From other permanents' static abilities; recomputed by refresh(). */
  bonus: { p: number; t: number; keywords: string[]; pacified: boolean; cantBlock: boolean; mustAttack: boolean; blockOnlyFlyers: boolean; evasion: string | null };
  attachedTo?: string | null;
  isCommander?: boolean;
  /** Cards this permanent exiled "until it leaves the battlefield" (toHand: they come back to hand instead). */
  exiled?: { card: string; owner: Seat; toHand?: boolean }[];
  enteredTurn: number;
  /** "As this enters, choose a creature type / card type." */
  chosen?: string;
  /** Abilities that already triggered this turn (for "triggers only once each turn"). */
  firedThisTurn?: string[];
  /** Counters other than +1/+1, by name (e.g. divinity). */
  namedCounters?: Record<string, number>;
  /** "As this enters, note your life total." */
  noted?: number;
}

export type Target = { kind: "perm"; uid: string } | { kind: "player"; seat: Seat } | { kind: "spell"; uid: string };

export interface Spell {
  uid: string;
  card: string;
  caster: Seat;
  fromCommandZone?: boolean;
  targets: Target[];
  /** Set when the spell targets an aura's host or an equipment, for display. */
  responses?: number;
  /** Modal spells: the chosen modes, in order. */
  modes?: number[];
  /** Cast during the caster's own main phase (Addendum). */
  castInMain?: boolean;
}

export type PendingSource = { kind: "hand"; uid: string } | { kind: "commander" } | { kind: "ability"; uid: string; index: number };

export interface Pending {
  source: PendingSource;
  cardName: string;
  specs: string[];
  chosen: Target[];
  candidates: Target[];
  /** How many more targets this spec may take. */
  max: number;
  optional: boolean;
  /** Modal spells: pick modes first. */
  modes?: { texts: string[]; n: number; picked: number[] };
}

export interface PlayerS {
  id: Seat;
  name: string;
  human: boolean;
  life: number;
  hand: string[];
  library: string[];
  graveyard: string[];
  exile: string[];
  pool: Pool;
  landsPlayed: number;
  commandZone: { card: string; casts: number; inZone: boolean };
  commanderDamage: Record<string, number>;
  out: boolean;
  outReason?: string;
  gainedLifeThisTurn: boolean;
  lostLifeThisTurn: boolean;
  attackedThisTurn: boolean;
  drewFromEmpty?: boolean;
  lifeGainedThisTurn?: number;
}

export interface CState {
  seats: Seat[];
  players: Record<Seat, PlayerS>;
  human: Seat;
  turn: Seat;
  step: Step;
  turnNumber: number;
  battlefield: Perm[];
  stack: Spell[];
  cards: Record<string, string>;
  tokens: Record<string, CDef>;
  attackers: Record<string, { defender: Seat; blockers: string[] }>;
  selectedAttackers: string[];
  pendingBlocker: string | null;
  /** Seats that have finished declaring blocks this combat. */
  blocksDone: Seat[];
  pending: Pending | null;
  creatureDiedThisTurn: boolean;
  /** The monarch (CR 724), if anyone is. */
  monarch?: Seat | null;
  log: string[];
  refusal: string | null;
  winner: Seat | null;
  seed: number;
  uidCounter: number;
}

export type Action =
  | { type: "playLand"; uid: string }
  | { type: "cast"; uid: string }
  | { type: "castCommander" }
  | { type: "activate"; uid: string; index: number }
  | { type: "chooseTarget"; target: Target }
  | { type: "chooseMode"; index: number }
  | { type: "cycle"; uid: string }
  | { type: "castAlt"; uid: string }
  | { type: "embalm"; card: string }
  | { type: "doneTargets" }
  | { type: "cancelTarget" }
  | { type: "pass" }
  | { type: "goToCombat" }
  | { type: "skipCombat" }
  | { type: "toggleAttacker"; uid: string }
  | { type: "attackPlayer"; seat: Seat }
  | { type: "declareAttackers" }
  | { type: "pickBlocker"; uid: string }
  | { type: "assignBlock"; attackerUid: string }
  | { type: "declareBlockers" }
  | { type: "dealDamage" }
  | { type: "endTurn" };

/* ------------------------------------------------------------------ helpers */

export const def = (s: CState, id: string): CDef => {
  const c = CCARDS[id] ?? s.tokens[id];
  if (!c) throw new Error(`Unknown card ${id}`);
  return c;
};
const pdef = (s: CState, p: Perm): CDef => def(s, p.card);
export const find = (s: CState, uid: string): Perm | undefined => s.battlefield.find((p) => p.uid === uid);
export const player = (s: CState, seat: Seat): PlayerS => s.players[seat]!;
export const active = (s: CState): Seat[] => s.seats.filter((x) => !player(s, x).out);
export const opponentsOf = (s: CState, seat: Seat): Seat[] => active(s).filter((x) => x !== seat);
export const nextSeat = (s: CState, from: Seat): Seat => {
  const i = s.seats.indexOf(from);
  for (let k = 1; k <= s.seats.length; k++) { const seat = s.seats[(i + k) % s.seats.length]!; if (!player(s, seat).out) return seat; }
  return from;
};
export const nameOf = (s: CState, seat: Seat): string => (seat === s.human ? "You" : player(s, seat).name);
const poss = (s: CState, seat: Seat): string => (seat === s.human ? "your" : `${player(s, seat).name}'s`);
const verb = (s: CState, seat: Seat, you: string, they: string) => (seat === s.human ? you : they);

export const log = (s: CState, line: string): CState => ({ ...s, log: [...s.log, line] });
const refuse = (s: CState, why: string): CState => ({ ...s, refusal: why });
const setPlayer = (s: CState, seat: Seat, patch: Partial<PlayerS>): CState => ({ ...s, players: { ...s.players, [seat]: { ...player(s, seat), ...patch } } });
const setPerm = (s: CState, uid: string, fn: (p: Perm) => Perm): CState => ({ ...s, battlefield: s.battlefield.map((p) => (p.uid === uid ? fn(p) : p)) });

export function nextUid(s: CState, prefix = "c"): [CState, string] { const n = s.uidCounter + 1; return [{ ...s, uidCounter: n }, `${prefix}${n}`]; }
/** Deterministic random in [0,1): the seed lives in the state so saved games replay the same shuffles. */
export function rand(s: CState): [CState, number] {
  let x = s.seed | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x |= 0;
  return [{ ...s, seed: x }, ((x >>> 0) % 1_000_000) / 1_000_000];
}
export function shuffleIn(s: CState, list: string[]): [CState, string[]] {
  const a = [...list]; let st = s;
  for (let i = a.length - 1; i > 0; i--) { const [n, r] = rand(st); st = n; const j = Math.floor(r * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return [st, a];
}

export const kindOf = (s: CState, p: Perm) => pdef(s, p).kind;
export const isCreature = (s: CState, p: Perm) => kindOf(s, p) === "creature";
export const isLand = (s: CState, p: Perm) => kindOf(s, p) === "land";
export const keywords = (s: CState, p: Perm): string[] => [...keywordsOf(pdef(s, p)), ...p.bonus.keywords, ...p.granted];
/** The qualities a permanent has protection from: subtypes ("Demons"), colours ("white"), card types ("creature"). */
export function protections(s: CState, p: Perm): string[] {
  const out: string[] = [];
  for (const a of pdef(s, p).abilities) if (a.kind === "protection") out.push(...(a.from ?? []).map((q) => q.replace(/^the chosen card type$/, p.chosen ?? "")));
  for (const src of s.battlefield) if (src.controller === p.controller && isCreature(s, p)) for (const a of statics(s, src)) if (a.op === "protectionChosen" && src.chosen) out.push(src.chosen);
  return out.filter(Boolean);
}
/** Does a source have one of these qualities? Subtype plural ("Demons"), colour word, or card type. */
export function sourceHasQuality(s: CState, source: { card: string } | null, quality: string): boolean {
  if (!source) return false;
  const d = def(s, source.card);
  const q = quality.toLowerCase();
  const colourLetter = (Object.entries(COLOR_WORD).find(([, w]) => w === q)?.[0] ?? "") as string;
  if (colourLetter) return d.colors.includes(colourLetter);
  if (["creature", "artifact", "enchantment", "instant", "sorcery", "land", "planeswalker"].includes(q)) return d.type.toLowerCase().includes(q);
  const sub = q.replace(/s$/, "");
  return subtypesOf(d).some((x) => x.toLowerCase() === sub);
}
export const protectedFrom = (s: CState, p: Perm, source: { card: string } | null): boolean => protections(s, p).some((q) => sourceHasQuality(s, source, q));
export const playerProtectedFrom = (s: CState, seat: Seat, source: { card: string } | null): boolean => s.battlefield.some((src) => src.controller === seat && src.chosen && statics(s, src).some((a) => a.op === "protectionChosen") && sourceHasQuality(s, source, src.chosen!));
export const has = (s: CState, p: Perm, kw: string): boolean => keywords(s, p).includes(kw);
export const power = (s: CState, p: Perm): number => (pdef(s, p).power ?? 0) + p.counters + p.pump.p + p.bonus.p;
export const toughness = (s: CState, p: Perm): number => (pdef(s, p).toughness ?? 0) + p.counters + p.pump.t + p.bonus.t;
const singular = (sub: string) => sub.replace(/s$/, "");
export const hasSubtype = (s: CState, p: Perm, sub: string): boolean => {
  const want = singular(sub).toLowerCase();
  if (want === "creature") return isCreature(s, p);
  if (isCreature(s, p) && has(s, p, "Changeling")) return true;
  return subtypesOf(pdef(s, p)).some((x) => x.toLowerCase() === want);
};
const colorsOf = (s: CState, p: Perm): string => pdef(s, p).colors;
const statics = (s: CState, p: Perm): Ability[] => pdef(s, p).abilities.filter((a) => a.kind === "static");
const triggers = (s: CState, p: Perm): Ability[] => pdef(s, p).abilities.filter((a) => a.kind === "triggered");
export const activated = (s: CState, p: Perm): { index: number; ability: Ability }[] => pdef(s, p).abilities.map((ability, index) => ({ index, ability })).filter((x) => x.ability.kind === "activated" || x.ability.kind === "equip");
export const hasStatic = (s: CState, seat: Seat, op: string): boolean => s.battlefield.some((p) => p.controller === seat && statics(s, p).some((a) => a.op === op));
export const isMain = (s: CState) => s.step === "main1" || s.step === "main2";

/* ------------------------------------------------------------------ statics (CR 611.3) */

/** Conditions on static abilities: "life>=25", "lifeAboveStart>=7", "yourTurn". */
function staticCond(s: CState, holder: Perm, c: string): boolean {
  const pl = player(s, holder.controller);
  let m = /^life>=(\d+)$/.exec(c); if (m) return pl.life >= Number(m[1]);
  m = /^lifeAboveStart>=(\d+)$/.exec(c); if (m) return pl.life - 40 >= Number(m[1]);
  if (c === "yourTurn") return s.turn === holder.controller;
  return false;
}

export function refresh(s: CState): CState {
  const battlefield = s.battlefield.map((p) => {
    const bonus: Perm["bonus"] = { p: 0, t: 0, keywords: [], pacified: false, cantBlock: false, mustAttack: false, blockOnlyFlyers: false, evasion: null };
    const creature = isCreature(s, p);
    for (const src of s.battlefield) {
      for (const a of statics(s, src)) {
        switch (a.op) {
          case "anthem": case "grantAll": {
            if (src.controller !== p.controller) break;
            if (!creature && !a.filter?.anyPermanent) break;
            if (a.filter?.namedCounter && !((p.namedCounters?.[a.filter.namedCounter] ?? 0) > 0)) break;
            if (a.filter?.anyPermanent && a.filter.subtype && !subtypesOf(pdef(s, p)).includes(a.filter.subtype)) break;
            if (a.filter?.other && src.uid === p.uid) break;
            if (a.filter?.subtype && a.filter.subtype !== "chosen" && !a.filter.anyPermanent && !hasSubtype(s, p, a.filter.subtype)) break;
            if (a.filter?.subtype === "chosen" && !(src.chosen && hasSubtype(s, p, src.chosen))) break;
            if (a.filter?.flying && !keywordsOf(pdef(s, p)).includes("Flying") && !p.granted.includes("Flying")) break;
            if (a.cond && !staticCond(s, src, a.cond)) break;
            bonus.p += a.p ?? 0; bonus.t += a.t ?? 0; bonus.keywords.push(...(a.keywords ?? []));
            break;
          }
          case "lieutenant": {
            if (!creature || src.controller !== p.controller) break;
            if (!s.battlefield.some((x) => x.controller === src.controller && x.isCommander)) break;
            if (src.uid === p.uid) { bonus.p += a.p ?? 0; bonus.t += a.t ?? 0; }
            bonus.keywords.push(...(a.keywords ?? []));
            break;
          }
          case "auraStatic": case "equipStatic": {
            if (src.attachedTo !== p.uid) break;
            bonus.p += a.p ?? 0; bonus.t += a.t ?? 0; bonus.keywords.push(...(a.keywords ?? []));
            if (a.pacify) bonus.pacified = true;
            break;
          }
          default: break;
        }
      }
    }
    for (const a of statics(s, p)) {
      switch (a.op) {
        case "selfBuffIf": {
          const c = a.cond ?? "";
          const others = s.battlefield.filter((x) => x.controller === p.controller && x.uid !== p.uid);
          let ok = false;
          const m = /^another (\w+)$/.exec(c);
          if (m) ok = others.some((x) => isCreature(s, x) && hasSubtype(s, x, m[1]!));
          else if (c === "an artifact") ok = others.some((x) => kindOf(s, x) === "artifact");
          else if (c === "an equipment") ok = others.some((x) => isEquipment(pdef(s, x)));
          else if (c === "a creature with power 4 or greater") ok = others.some((x) => isCreature(s, x) && (pdef(s, x).power ?? 0) + x.counters >= 4);
          else ok = staticCond(s, p, c);
          if (ok) { bonus.p += a.p ?? 0; bonus.t += a.t ?? 0; }
          break;
        }
        case "selfKeywordIf": {
          const c = a.cond ?? "";
          const m = /^life>=(\d+)$/.exec(c);
          const ok = m ? player(s, p.controller).life >= Number(m[1]) : c === "yourTurn" ? s.turn === p.controller : false;
          if (ok) bonus.keywords.push(...(a.keywords ?? []));
          break;
        }
        case "cantBlock": bonus.cantBlock = true; break;
        case "mustAttack": bonus.mustAttack = true; break;
        case "blockOnlyFlyers": bonus.blockOnlyFlyers = true; break;
        case "evasion": bonus.evasion = a.what ?? null; break;
        case "evasionPower": bonus.evasion = `powerAtLeast${a.n ?? 0}`; break;
        default: break;
      }
    }
    return { ...p, bonus };
  });
  return { ...s, battlefield };
}

/* ------------------------------------------------------------------ mana */

interface ManaSource { perm: Perm; colors: (Color | "C")[]; n: number; sacrifice: boolean; only?: string; rider?: string }

function manaSources(s: CState, seat: Seat): ManaSource[] {
  const out: ManaSource[] = [];
  for (const p of s.battlefield) {
    if (p.controller !== seat || p.tapped) continue;
    if (isCreature(s, p) && p.summoningSick && !has(s, p, "Haste")) continue;
    for (const a of pdef(s, p).abilities) {
      if (a.kind !== "activated" || typeof a.cost === "string") continue;
      const cost = a.cost ?? {};
      if (!cost.tap || cost.mana || cost.sacrificeCreature) continue;
      const eff = a.effects?.[0];
      if (!eff || eff.op !== "addMana" || (a.effects ?? []).slice(1).some((x) => x.op !== "manaRider" && x.op !== "manaOnly")) continue;
      const only = (a.effects ?? []).find((x) => x.op === "manaOnly")?.subtype;
      const rider = (a.effects ?? []).find((x) => x.op === "manaRider")?.rider;
      const n = eff.per ? s.battlefield.filter((x) => x.controller === seat && isCreature(s, x) && hasSubtype(s, x, eff.per!)).length : eff.n ?? 1;
      if (n <= 0) continue;
      let colors = (eff.colors ?? []) as (Color | "C")[];
      if (colors[0] === ("identity" as string)) colors = (def(s, player(s, seat).commandZone.card).colors.split("") as Color[]);
      if (colors[0] === ("opponentsLands" as string)) {
        const set = new Set<Color | "C">();
        for (const o of opponentsOf(s, seat)) for (const l of s.battlefield) if (l.controller === o && isLand(s, l)) for (const ab of pdef(s, l).abilities) if (ab.kind === "activated" && ab.effects?.[0]?.op === "addMana") for (const col of ab.effects[0].colors ?? []) if (col !== ("identity" as string) && col !== ("opponentsLands" as string)) set.add(col as Color | "C");
        colors = [...set];
      }
      if (!colors.length) continue;
      out.push({ perm: p, colors, n, sacrifice: !!cost.sacrificeSelf, ...(only ? { only } : {}), ...(rider ? { rider } : {}) });
    }
  }
  // Mono-colour lands first, then duals, then anything that has to be sacrificed (Treasure).
  return out.sort((a, b) => Number(a.sacrifice) - Number(b.sacrifice) || Number(!isLand(s, a.perm)) - Number(!isLand(s, b.perm)) || a.colors.length - b.colors.length);
}

/** Pool plus what untapped sources could add, as an upper bound per colour (duals count for each colour). */
export function availableMana(s: CState, seat: Seat): Pool & { total: number } {
  const pool: Pool & { total: number } = { ...player(s, seat).pool, total: 0 };
  for (const c of COLORS) pool.total += pool[c] ?? 0;
  for (const src of manaSources(s, seat)) { for (const c of src.colors) pool[c] = (pool[c] ?? 0) + src.n; pool.total += src.n; }
  return pool;
}

function costAfterReductions(s: CState, seat: Seat, card: CDef, cost: string): string {
  let less = 0;
  for (const p of s.battlefield) if (p.controller === seat) for (const a of statics(s, p)) {
    if (a.op !== "costLess") continue;
    if (a.what === "instantSorcery" && (card.kind === "instant" || card.kind === "sorcery")) less += a.n ?? 0;
    else if (a.what === "subtype" && a.subtype && subtypesOf(card).includes(a.subtype)) less += a.n ?? 0;
    else if (a.what === "chosenType" && p.chosen && card.kind === "creature" && subtypesOf(card).includes(p.chosen)) less += a.n ?? 0;
    else if (a.what === "subtypes" && a.subtypes?.some((x) => subtypesOf(card).includes(x))) less += a.perCounter ? p.counters : a.n ?? 0;
  }
  if (!less) return cost;
  const c = parseCost(cost);
  const generic = Math.max(0, c.generic - less);
  return `${generic || ""}${cost.replace(/\d+/g, "")}`;
}

/** Pays a cost from the pool, tapping (or sacrificing) mana sources as needed. Null when it can't be paid. */
export function pay(s: CState, seat: Seat, cost: string, forCard?: CDef): CState | null {
  const need = parseCost(cost);
  let pool: Pool = { ...player(s, seat).pool };
  let st = s;
  const usable = (x: ManaSource) => !x.only || (!!forCard && subtypesOf(forCard).includes(x.only));
  const sources = manaSources(s, seat).filter(usable);
  const used = new Set<string>();
  const riders: string[] = [];
  const tapFor = (color: Color | null): boolean => {
    const src = sources.find((x) => !used.has(x.perm.uid) && (color === null ? true : x.colors.includes(color)));
    if (!src) return false;
    used.add(src.perm.uid);
    if (src.rider) riders.push(src.rider);
    const c: Color | "C" = color ?? src.colors[0] ?? "C";
    pool[c] = (pool[c] ?? 0) + src.n;
    st = setPerm(st, src.perm.uid, (p) => ({ ...p, tapped: true }));
    if (src.sacrifice) st = leave(st, src.perm.uid, "graveyard", `${pdef(s, src.perm).name} is sacrificed for mana.`);
    return true;
  };
  for (const c of COLORS) {
    while ((pool[c] ?? 0) < (need[c] ?? 0)) if (!tapFor(c)) return null;
    pool[c] = (pool[c] ?? 0) - (need[c] ?? 0);
  }
  let generic = need.generic;
  const spend = () => { for (const c of ["C", ...COLORS] as (Color | "C")[]) while (generic > 0 && (pool[c] ?? 0) > 0) { pool[c] = (pool[c] ?? 0) - 1; generic--; } };
  spend();
  while (generic > 0) {
    if (!tapFor(null)) return null;
    spend();
  }
  for (const c of Object.keys(pool) as (Color | "C")[]) if (!pool[c]) delete pool[c];
  st = setPlayer(st, seat, { pool });
  // Path of Ancestry: "When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1."
  if (riders.includes("scry1IfSharesType") && forCard?.kind === "creature") {
    const cmd = def(st, player(st, seat).commandZone.card);
    if (subtypesOf(forCard).some((x) => subtypesOf(cmd).includes(x))) st = scry(st, seat, 1, "Path of Ancestry");
  }
  return st;
}
export const canAffordFor = (s: CState, seat: Seat, cost: string, forCard: CDef): boolean => pay(s, seat, cost, forCard) !== null;
export const canAfford = (s: CState, seat: Seat, cost: string): boolean => pay(s, seat, cost) !== null;

/** The cost to cast a commander from the command zone right now (CR 903.8). */
export function commanderCost(s: CState, seat: Seat): string | null {
  const cz = player(s, seat).commandZone;
  if (!cz.inZone) return null;
  const base = def(s, cz.card).cost;
  const generic = parseCost(base).generic + 2 * cz.casts;
  return `${generic || ""}${base.replace(/\d+/g, "")}` || "0";
}

/* ------------------------------------------------------------------ zones */

const newPerm = (uid: string, card: string, controller: Seat, turnNumber: number): Perm => ({
  uid, card, controller, owner: controller, tapped: false, summoningSick: true, damage: 0, deathtouched: false, counters: 0, pump: { p: 0, t: 0 }, granted: [],
  bonus: { p: 0, t: 0, keywords: [], pacified: false, cantBlock: false, mustAttack: false, blockOnlyFlyers: false, evasion: null }, enteredTurn: turnNumber,
});

/** Puts a card onto the battlefield under a player's control and fires "enters" triggers. */
export function enter(s: CState, card: string, controller: Seat, opts: { uid?: string; tapped?: boolean; isCommander?: boolean; attachTo?: string | null; isToken?: boolean } = {}): CState {
  let st = s; let uid = opts.uid ?? "";
  if (!uid) [st, uid] = nextUid(st, opts.isToken ? "t" : "c");
  const d = def(st, card);
  let p = newPerm(uid, card, controller, st.turnNumber);
  if (opts.isCommander) p = { ...p, isCommander: true };
  const entersTapped = d.abilities.some((a) => a.kind === "entersTapped" && (!a.unless || !st.battlefield.some((x) => x.controller === controller && hasSubtype(st, x, a.unless!)))) || (d.kind === "creature" && opponentsOf(st, controller).some((o) => hasStatic(st, o, "oppEnterTapped")));
  if (opts.tapped || entersTapped) p = { ...p, tapped: true };
  if (opts.attachTo !== undefined) p = { ...p, attachedTo: opts.attachTo };
  if (d.abilities.some((a) => a.kind === "noteLife")) p = { ...p, noted: player(st, controller).life };
  // Giada: "Each other Angel you control enters with an additional +1/+1 counter on it for each Angel you already control."
  for (const holder of st.battlefield) if (holder.controller === controller && holder.uid !== uid) for (const a of statics(st, holder)) if (a.op === "entersWithCountersPer" && d.kind === "creature" && subtypesOf(d).includes(a.subtype ?? "")) {
    const n = st.battlefield.filter((x) => x.controller === controller && isCreature(st, x) && hasSubtype(st, x, a.per ?? "")).length;
    if (n > 0) { p = { ...p, counters: p.counters + n }; st = log(st, `${pdef(st, holder).name}: ${d.name} enters with ${n} extra +1/+1 counter${n === 1 ? "" : "s"}.`); }
  }
  const choose = d.abilities.find((a) => a.kind === "chooseType");
  if (choose) { const chosen = choose.what === "cardType" ? "creature" : commonestSubtype(st, controller); p = { ...p, chosen }; st = log(st, `${d.name}: ${nameOf(st, controller)} choose${verb(st, controller, "", "s")} ${chosen}.`); }
  st = refresh({ ...st, battlefield: [...st.battlefield, p] });
  const entered = find(st, uid)!;
  // Triggers on the card itself and on everything else that watches creatures entering.
  st = fire(st, "etb", { perm: entered, seat: controller });
  if (d.kind === "creature") {
    st = fire(st, "creatureEnters", { perm: entered, seat: controller });
    if (d.kind === "creature" && !d.token) st = fire(st, "nontokenCreatureEnters", { perm: entered, seat: controller });
  }
  if (d.kind === "land") { st = fire(st, "landfall", { perm: entered, seat: controller }); st = fire(st, "gateEnters", { perm: entered, seat: controller }); }
  return checkState(st);
}

/** The creature type a player's deck has most of (used when a card says "choose a creature type"). */
function commonestSubtype(s: CState, seat: Seat): string {
  const pl = player(s, seat);
  const count = new Map<string, number>();
  const cards = [...pl.library, ...pl.hand.map((u) => s.cards[u] ?? ""), ...s.battlefield.filter((p) => p.controller === seat).map((p) => p.card), pl.commandZone.card];
  for (const c of cards) { const d = c ? def(s, c) : null; if (d?.kind === "creature") for (const sub of subtypesOf(d)) count.set(sub, (count.get(sub) ?? 0) + 1); }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Human";
}

/** Removes a permanent from the battlefield: to a graveyard, exile, hand or the command zone. Handles commanders, tokens, attachments and "until it leaves" exiles. */
export function leave(s: CState, uid: string, to: "graveyard" | "exile" | "hand" | "library" | "command", why?: string): CState {
  const p = find(s, uid);
  if (!p) return s;
  let st: CState = { ...s, battlefield: s.battlefield.filter((x) => x.uid !== uid) };
  const d = pdef(s, p);
  if (why) st = log(st, why);
  // Anything attached to it falls off (auras die at the next state check; equipment just sits there).
  st = { ...st, battlefield: st.battlefield.map((x) => (x.attachedTo === uid ? { ...x, attachedTo: null } : x)) };
  // Cards it exiled "until it leaves" come back under their owners' control (CR 610.3).
  for (const ex of p.exiled ?? []) {
    if (player(st, ex.owner).out) { st = setPlayer(st, ex.owner, { graveyard: [...player(st, ex.owner).graveyard, ex.card] }); continue; }
    if (ex.toHand) { const [n2, huid] = nextUid(st, "h"); st = setPlayer(n2, ex.owner, { hand: [...player(n2, ex.owner).hand, huid] }); st = { ...st, cards: { ...st.cards, [huid]: ex.card } }; st = log(st, `${def(st, ex.card).name} returns to ${poss(st, ex.owner)} hand because ${d.name} left.`); continue; }
    st = log(st, `${def(st, ex.card).name} returns to the battlefield because ${d.name} left.`);
    st = enter(st, ex.card, ex.owner);
  }
  if (d.token) return refresh(st); // tokens cease to exist (CR 111.7)
  if (p.isCommander && (to === "graveyard" || to === "exile" || to === "hand" || to === "library" || to === "command")) {
    // CR 903.9a: the owner may put it into the command zone instead. On this table they always do.
    const cz = player(st, p.owner).commandZone;
    st = setPlayer(st, p.owner, { commandZone: { ...cz, inZone: true } });
    return refresh(log(st, `${d.name} goes back to ${poss(st, p.owner)} command zone.`));
  }
  const owner = player(st, p.owner);
  if (to === "graveyard") st = setPlayer(st, p.owner, { graveyard: [...owner.graveyard, p.card] });
  else if (to === "exile") st = setPlayer(st, p.owner, { exile: [...owner.exile, p.card] });
  else if (to === "hand") { const [n, huid] = nextUid(st, "h"); st = setPlayer(n, p.owner, { hand: [...owner.hand, huid] }); st = { ...st, cards: { ...st.cards, [huid]: p.card } }; }
  else if (to === "library") st = setPlayer(st, p.owner, { library: [...owner.library, p.card] });
  return refresh(st);
}

/** A creature dies (CR 700.4): to the graveyard, with its death triggers. */
function die(s: CState, uid: string, why: string): CState {
  const p = find(s, uid);
  if (!p) return s;
  const creature = isCreature(s, p);
  const wasAttacking = s.attackers[uid] !== undefined && (s.step === "blockers" || s.step === "damage");
  let st = leave(s, uid, "graveyard", why);
  if (creature) {
    st = { ...st, creatureDiedThisTurn: true };
    st = fire(st, "dies", { perm: p, seat: p.controller, wasAttacking });
  }
  return st;
}

export function drawCards(s: CState, seat: Seat, n: number): CState {
  let st = s;
  for (let i = 0; i < n; i++) {
    const pl = player(st, seat);
    const [top, ...rest] = pl.library;
    if (!top) { st = setPlayer(st, seat, { drewFromEmpty: true }); st = log(st, `${nameOf(st, seat)} ${verb(st, seat, "have", "has")} to draw from an empty library.`); break; }
    const [n2, uid] = nextUid(st, "h");
    st = setPlayer(n2, seat, { library: rest, hand: [...pl.hand, uid] });
    st = { ...st, cards: { ...st.cards, [uid]: top } };
    st = fire(st, "drawCard", { seat });
  }
  if (n > 0) st = log(st, `${nameOf(st, seat)} ${verb(st, seat, "draw", "draws")} ${n === 1 ? "a card" : `${n} cards`}.`);
  return st;
}

function gainLife(s: CState, seat: Seat, n: number): CState {
  if (n <= 0 || player(s, seat).out) return s;
  // "Your opponents can't gain life" / "If an opponent would gain life, that player loses that much life instead."
  const foes = opponentsOf(s, seat);
  if (foes.some((o) => hasStatic(s, o, "oppCantGainLife"))) return log(s, `${nameOf(s, seat)} can't gain life.`);
  if (foes.some((o) => hasStatic(s, o, "oppLifeGainToLoss"))) return loseLife(log(s, `${nameOf(s, seat)} would gain ${n} life, but lose${verb(s, seat, "", "s")} it instead.`), seat, n);
  const extra = hasStatic(s, seat, "lifeGainPlusOne") ? 1 : 0;
  const total = n + extra;
  const pl = player(s, seat);
  let st = setPlayer(s, seat, { life: pl.life + total, lifeGainedThisTurn: (pl.lifeGainedThisTurn ?? 0) + total });
  st = log(st, `${nameOf(st, seat)} ${verb(st, seat, "gain", "gains")} ${total} life (now ${pl.life + total}).`);
  const first = !pl.gainedLifeThisTurn;
  st = setPlayer(st, seat, { gainedLifeThisTurn: true });
  st = fire(st, "lifeGain", { seat, amount: total });
  if (first) st = fire(st, "firstLifeGain", { seat, amount: total });
  return st;
}

function loseLife(s: CState, seat: Seat, n: number): CState {
  if (n <= 0 || player(s, seat).out) return s;
  const pl = player(s, seat);
  let st = setPlayer(s, seat, { life: pl.life - n, lostLifeThisTurn: true });
  st = log(st, `${nameOf(st, seat)} ${verb(st, seat, "lose", "loses")} ${n} life (now ${pl.life - n}).`);
  // "Whenever an opponent loses life, you gain that much life."
  for (const p of st.battlefield) if (p.controller !== seat && triggers(st, p).some((a) => a.when === "mirrorLifeLoss")) st = gainLife(st, p.controller, n);
  return st;
}

function damagePlayer(s: CState, seat: Seat, n: number, source: Perm | null): CState {
  if (source && playerProtectedFrom(s, seat, source)) return log(s, `${nameOf(s, seat)} ${verb(s, seat, "have", "has")} protection from ${pdef(s, source).name}: the damage is prevented.`);
  let st = loseLife(s, seat, n);
  if (source && has(s, source, "Lifelink") && n > 0) st = gainLife(st, source.controller, n);
  return st;
}

function damageCreature(s: CState, uid: string, n: number, source: Perm | null): CState {
  const p = find(s, uid);
  if (!p || n <= 0) return s;
  if (source && protectedFrom(s, p, source)) return log(s, `${pdef(s, p).name} has protection from ${pdef(s, source).name}: the damage is prevented.`);
  let st = setPerm(s, uid, (x) => ({ ...x, damage: x.damage + n, deathtouched: x.deathtouched || (!!source && has(s, source, "Deathtouch")) }));
  if (source && has(s, source, "Lifelink")) st = gainLife(st, source.controller, n);
  return st;
}

/* ------------------------------------------------------------------ tokens */

function tokenDef(e: Effect): CDef {
  const colorWord = (e.color ?? "C").toLowerCase();
  const letter = (Object.entries(COLOR_WORD).find(([, w]) => w === colorWord)?.[0] ?? "") as string;
  if (e.artifact === "food") {
    return { id: "token:food", name: "Food", kind: "artifact", type: "Token Artifact — Food", cost: "", colors: "", text: "{2}, {T}, Sacrifice this artifact: You gain 3 life.", artist: "", num: "", rarity: "token", legendary: false, token: true,
      abilities: [{ kind: "activated", cost: { mana: "2", tap: true, sacrificeSelf: true }, effects: [{ op: "gainLife", who: "you", n: 3 }] }] };
  }
  if (e.artifact === "treasure") {
    return { id: "token:treasure", name: "Treasure", kind: "artifact", type: "Token Artifact — Treasure", cost: "", colors: "", text: "{T}, Sacrifice this artifact: Add one mana of any color.", artist: "", num: "", rarity: "token", legendary: false, token: true,
      abilities: [{ kind: "activated", cost: { tap: true, sacrificeSelf: true }, effects: [{ op: "addMana", colors: [...COLORS] }] }] };
  }
  const sub = e.subtype ?? (e.subtypes ?? []).join(" ");
  const kws = e.keywords ?? [];
  const id = `token:${sub}:${e.p}/${e.t}:${letter}:${kws.join("+")}`;
  return { id, name: sub, kind: "creature", type: `Token Creature — ${sub}`, cost: "", colors: letter, text: kws.join("\n"), artist: "", num: "", rarity: "token", legendary: false, token: true, power: e.p ?? 0, toughness: e.t ?? 0,
    abilities: kws.map((k) => ({ kind: "keyword" as const, name: k })) };
}

/* ------------------------------------------------------------------ targets */

const hexproofBlocks = (s: CState, p: Perm, from: Seat, sourceColors: string, sourceCard?: string): boolean => {
  if (sourceCard && protectedFrom(s, p, { card: sourceCard })) return true;
  if (p.controller === from) return false;
  if (has(s, p, "Hexproof")) return true;
  for (const k of keywords(s, p)) { const m = /^Hexproof from (\w+)$/.exec(k); if (m) { const letter = Object.entries(COLOR_WORD).find(([, w]) => w === m[1])?.[0]; if (letter && sourceColors.includes(letter)) return true; } }
  return false;
};

/** Which target specs in an ability need a choice, in order. */
export function targetSpecs(effects: Effect[] | undefined): { spec: string; optional: boolean; max: number }[] {
  const out: { spec: string; optional: boolean; max: number }[] = [];
  for (const e of effects ?? []) {
    if (e.op === "seq") { out.push(...targetSpecs(e.effects)); continue; }
    for (const t of [e.target, e.target2]) {
      if (!t || ["self", "equipped", "that", "self_player", "eachOpponent", "eachPlayer", "eachCreatureYou"].includes(t)) continue;
      out.push({ spec: t, optional: !!e.optional || t === "creatureOptional" || t.startsWith("upTo"), max: t === "upToTwoOtherCreaturesYou" ? 2 : t === "upToThreeOtherCreatures" ? 3 : 1 });
    }
    if (e.who === "player" || e.who === "opponent") out.push({ spec: e.who, optional: !!e.optional, max: 1 });
  }
  return out;
}

export function candidates(s: CState, spec: string, from: Seat, sourceUid: string | null, sourceColors: string, sourceCard?: string): Target[] {
  const perms = (pred: (p: Perm) => boolean): Target[] => s.battlefield.filter((p) => pred(p) && !hexproofBlocks(s, p, from, sourceColors, sourceCard)).map((p) => ({ kind: "perm" as const, uid: p.uid }));
  const seats = (list: Seat[]): Target[] => list.filter((x) => x === from || !hasStatic(s, x, "playerHexproof")).filter((x) => !sourceCard || !playerProtectedFrom(s, x, { card: sourceCard })).map((seat) => ({ kind: "player" as const, seat }));
  const cre = (p: Perm) => isCreature(s, p);
  const other = (p: Perm) => p.uid !== sourceUid;
  const inCombat = (p: Perm) => s.attackers[p.uid] !== undefined || Object.values(s.attackers).some((a) => a.blockers.includes(p.uid));
  switch (spec) {
    case "creature": case "creatureOptional": return perms(cre);
    case "creatureYou": return perms((p) => cre(p) && p.controller === from);
    case "otherCreatureYou": case "upToTwoOtherCreaturesYou": return perms((p) => cre(p) && p.controller === from && other(p));
    case "upToThreeOtherCreatures": return perms((p) => cre(p) && other(p));
    case "creatureYouChosen": { const src = sourceUid ? find(s, sourceUid) : undefined; return perms((p) => cre(p) && p.controller === from && !!src?.chosen && hasSubtype(s, p, src.chosen)); }
    case "otherAttackingCreatureYou": return perms((p) => cre(p) && p.controller === from && other(p) && s.attackers[p.uid] !== undefined);
    case "creatureOpp": return perms((p) => cre(p) && p.controller !== from);
    case "creatureCombat": return perms((p) => cre(p) && inCombat(p));
    case "creatureAttacking": return perms((p) => cre(p) && s.attackers[p.uid] !== undefined);
    case "artifact": return perms((p) => kindOf(s, p) === "artifact");
    case "artifactOrCreature": return perms((p) => kindOf(s, p) === "artifact" || cre(p));
    case "otherNonlandPermanent": return perms((p) => !isLand(s, p) && other(p));
    case "creatureTapped": return perms((p) => cre(p) && p.tapped);
    case "flyer": return perms((p) => cre(p) && has(s, p, "Flying"));
    case "any": return [...perms(cre), ...seats(active(s))];
    case "player": return seats(active(s));
    case "opponent": return seats(opponentsOf(s, from));
    case "enchantment": return perms((p) => kindOf(s, p) === "enchantment");
    case "artifactOrEnchantment": return perms((p) => kindOf(s, p) === "enchantment" || kindOf(s, p) === "artifact");
    case "artifactEnchantmentOrFlyer": return perms((p) => kindOf(s, p) === "enchantment" || kindOf(s, p) === "artifact" || (cre(p) && has(s, p, "Flying")));
    case "artifactEnchantmentOrBigCreature": return perms((p) => kindOf(s, p) === "enchantment" || kindOf(s, p) === "artifact" || (cre(p) && power(s, p) >= 4));
    case "creatureOrEnchantment": return perms((p) => cre(p) || kindOf(s, p) === "enchantment");
    case "nonlandPermanent": return perms((p) => !isLand(s, p));
    case "nonlandPermanentOpp": return perms((p) => !isLand(s, p) && p.controller !== from);
    case "permanent": return perms(() => true);
    case "otherPermanentYou": return perms((p) => p.controller === from && other(p));
    case "land": return perms((p) => isLand(s, p));
    case "spell": return s.stack.filter((x) => x.caster !== from).map((x) => ({ kind: "spell" as const, uid: x.uid }));
    case "creatureSpell": return s.stack.filter((x) => x.caster !== from && def(s, x.card).kind === "creature").map((x) => ({ kind: "spell" as const, uid: x.uid }));
    case "noncreatureSpell": return s.stack.filter((x) => x.caster !== from && def(s, x.card).kind !== "creature").map((x) => ({ kind: "spell" as const, uid: x.uid }));
    default: return [];
  }
}

const condOk = (s: CState, t: Target, cond: Effect["cond"]): boolean => {
  if (!cond || t.kind !== "perm") return true;
  const p = find(s, t.uid);
  if (!p) return false;
  if (cond.toughnessAtLeast !== undefined && toughness(s, p) < cond.toughnessAtLeast) return false;
  if (cond.powerAtLeast !== undefined && power(s, p) < cond.powerAtLeast && isCreature(s, p)) return false;
  if (cond.colors && ![...colorsOf(s, p)].some((c) => cond.colors!.includes(c))) return false;
  return true;
};

/** Rules of thumb for picking targets when nobody is asked (computer players and triggered abilities). */
export function autoTargets(s: CState, effects: Effect[], from: Seat, sourceUid: string | null, sourceColors: string): Target[] | null {
  const out: Target[] = [];
  const helpful = (op: string) => ["pump", "counters", "grant", "untap", "gainLife", "draw", "reanimate", "regrow"].includes(op);
  const flat = (list: Effect[]): Effect[] => list.flatMap((e) => (e.op === "seq" ? flat(e.effects ?? []) : [e]));
  for (const e of flat(effects)) {
    for (const spec of [e.target, e.target2].filter((t): t is string => !!t && !["self", "equipped", "that", "self_player", "eachOpponent", "eachPlayer", "eachCreatureYou"].includes(t))) {
      let list = candidates(s, spec, from, sourceUid, sourceColors).filter((t) => condOk(s, t, e.cond));
      if (spec !== "any" || e.op !== "damage") list = list.filter((t) => t.kind !== "player" || e.op !== "damage" || true);
      const mine = list.filter((t) => t.kind === "perm" && find(s, t.uid)?.controller === from);
      const theirs = list.filter((t) => t.kind === "perm" && find(s, t.uid)?.controller !== from);
      const score = (t: Target) => { const p = t.kind === "perm" ? find(s, t.uid) : undefined; return p ? (isCreature(s, p) ? power(s, p) * 2 + toughness(s, p) + (p.isCommander ? 6 : 0) : 3 + manaValue(pdef(s, p).cost)) : 0; };
      const pick = (arr: Target[]) => [...arr].sort((a, b) => score(b) - score(a))[0];
      let chosen: Target | undefined;
      if (helpful(e.op)) {
        if (e.op === "counters" || e.op === "pump" || e.op === "grant") {
          const attacking = mine.filter((t) => t.kind === "perm" && s.attackers[t.uid] !== undefined);
          chosen = pick(attacking.length ? attacking : mine) ?? (spec === "creature" ? undefined : pick(list));
        } else chosen = pick(mine) ?? pick(list);
      } else if (e.op === "damage" && spec === "any") {
        const players = list.filter((t): t is { kind: "player"; seat: Seat } => t.kind === "player" && t.seat !== from);
        const lethal = players.find((t) => player(s, t.seat).life <= (e.n ?? 0));
        const killable = theirs.filter((t) => t.kind === "perm" && toughness(s, find(s, t.uid)!) - find(s, t.uid)!.damage <= (e.n ?? 0));
        chosen = lethal ?? pick(killable) ?? (players.length ? [...players].sort((a, b) => threat(s, b.seat) - threat(s, a.seat))[0] : undefined);
      } else if (e.op === "damage") {
        const killable = theirs.filter((t) => t.kind === "perm" && toughness(s, find(s, t.uid)!) - find(s, t.uid)!.damage <= (e.n ?? 0) && isCreature(s, find(s, t.uid)!));
        chosen = pick(killable) ?? pick(theirs);
      } else if (spec === "player" || spec === "opponent") {
        const foes = list.filter((t): t is { kind: "player"; seat: Seat } => t.kind === "player" && t.seat !== from);
        chosen = (e.op === "gainLife" ? list.find((t) => t.kind === "player" && t.seat === from) : undefined) ?? [...foes].sort((a, b) => threat(s, b.seat) - threat(s, a.seat))[0];
      } else if (e.op === "bounce" && spec === "otherPermanentYou") {
        chosen = undefined; // "you may": keeping your own permanents is the sensible default
      } else chosen = pick(theirs) ?? (spec.endsWith("You") ? pick(mine) : undefined);
      if (!chosen) {
        if (e.optional || spec === "creatureOptional" || spec.startsWith("upTo")) continue;
        return null;
      }
      out.push(chosen);
    }
    if (e.who === "player" || e.who === "opponent") {
      const list = candidates(s, e.who, from, sourceUid, sourceColors).filter((t): t is { kind: "player"; seat: Seat } => t.kind === "player");
      const foes = list.filter((t) => t.seat !== from);
      const c = e.op === "gainLife" ? list.find((t) => t.seat === from) : [...foes].sort((a, b) => threat(s, b.seat) - threat(s, a.seat))[0];
      if (!c) return null;
      out.push(c);
    }
  }
  return out;
}

/** How dangerous a player looks: board power, life, commander on the table. Used by the computer players and the coach. */
export function threat(s: CState, seat: Seat): number {
  const pl = player(s, seat);
  if (pl.out) return -1;
  let score = 0;
  for (const p of s.battlefield) if (p.controller === seat) score += isCreature(s, p) ? power(s, p) * 2 + toughness(s, p) + (p.isCommander ? 5 : 0) : isLand(s, p) ? 1 : 3;
  score += pl.hand.length;
  score += Math.max(0, 40 - pl.life) * -0.3;
  return score;
}

/* ------------------------------------------------------------------ the interpreter */

/** Puts +1/+1 counters on a permanent and fires "whenever you put counters on this" (once per turn where the card says so). */
function placeCounters(s: CState, uid: string, n: number): CState {
  let st = setPerm(s, uid, (x) => ({ ...x, counters: x.counters + n }));
  const p = find(st, uid);
  if (p) st = fire(st, "countersOnSelf", { perm: p, seat: p.controller, amount: n });
  return st;
}

interface Ctx { source: Perm | null; sourceCard: string; controller: Seat; targets: Target[]; that?: Target; sacrificed?: Perm; wasAttacking?: boolean; destroyedCount?: number; amount?: number; thatPower?: number; thatToughness?: number; thatController?: Seat; castInMain?: boolean; X?: number }

const condition = (s: CState, c: string | undefined, ctx: Ctx): boolean => {
  if (!c) return true;
  const mine = s.battlefield.filter((p) => p.controller === ctx.controller);
  const others = mine.filter((p) => p.uid !== ctx.source?.uid);
  switch (c) {
    case "you control a creature with power 4 or greater": return mine.some((p) => isCreature(s, p) && power(s, p) >= 4);
    case "you control another creature with power 4 or greater": return others.some((p) => isCreature(s, p) && power(s, p) >= 4);
    case "you control three or more creatures": return mine.filter((p) => isCreature(s, p)).length >= 3;
    case "you control two or more other creatures": return others.filter((p) => isCreature(s, p)).length >= 2;
    case "you control six or more lands": return mine.filter((p) => isLand(s, p)).length >= 6;
    case "you control another elf": return others.some((p) => isCreature(s, p) && hasSubtype(s, p, "Elf"));
    case "you attacked this turn": return player(s, ctx.controller).attackedThisTurn;
    case "a creature died this turn": return s.creatureDiedThisTurn;
    case "an opponent lost life this turn": return opponentsOf(s, ctx.controller).some((o) => player(s, o).lostLifeThisTurn);
    case "cast during your main phase": return !!ctx.castInMain;
    case "that player controls more lands than you": { const t = ctx.that; const seat = t?.kind === "player" ? t.seat : t?.kind === "perm" ? find(s, t.uid)?.controller : undefined; if (!seat) return false; const lands = (x: Seat) => s.battlefield.filter((p) => p.controller === x && isLand(s, p)).length; return lands(seat) > lands(ctx.controller); }
    default: {
      let m = /^you gained (\d+) or more life this turn$/.exec(c);
      if (m) return (player(s, ctx.controller).lifeGainedThisTurn ?? 0) >= Number(m[1]);
      m = /^you control an? (\w+)$/.exec(c);
      if (m) { const sub = m[1]!; if (sub === "artifact" || sub === "enchantment") return mine.some((p) => kindOf(s, p) === sub); if (sub === "equipment") return mine.some((p) => isEquipment(pdef(s, p))); return mine.some((p) => isCreature(s, p) && hasSubtype(s, p, sub)); }
      return true;
    }
  }
};

const takeTarget = (ctx: Ctx, spec: string | undefined): Target | null => {
  if (!spec) return null;
  if (spec === "self") return ctx.source ? { kind: "perm", uid: ctx.source.uid } : null;
  if (spec === "equipped") return ctx.source?.attachedTo ? { kind: "perm", uid: ctx.source.attachedTo } : null;
  if (spec === "that") return ctx.that ?? null;
  if (spec === "self_player") return { kind: "player", seat: ctx.controller };
  if (spec === "eachOpponent" || spec === "eachPlayer" || spec === "eachCreatureYou") return null;
  const t = ctx.targets.shift();
  if (t) ctx.that = t;
  return t ?? null;
};
/** Remembers a targeted permanent's power, toughness and controller before it leaves, for "its controller gains life equal to its power". */
const remember = (s: CState, ctx: Ctx, p: Perm) => { ctx.thatPower = power(s, p); ctx.thatToughness = toughness(s, p); ctx.thatController = p.controller; };

const filterPerms = (s: CState, filter: string | undefined, ctx: Ctx, e_subtype?: string): Perm[] => {
  const me = ctx.controller;
  switch (filter) {
    case "creaturesYou": return s.battlefield.filter((p) => p.controller === me && isCreature(s, p));
    case "otherCreaturesYou": return s.battlefield.filter((p) => p.controller === me && isCreature(s, p) && p.uid !== ctx.source?.uid);
    case "creaturesOpp": return s.battlefield.filter((p) => p.controller !== me && isCreature(s, p));
    case "attackingYou": return s.battlefield.filter((p) => p.controller === me && s.attackers[p.uid] !== undefined);
    case "attacking": return s.battlefield.filter((p) => s.attackers[p.uid] !== undefined);
    case "permanentsYou": return s.battlefield.filter((p) => p.controller === me);
    case "counteredCreaturesYou": return s.battlefield.filter((p) => p.controller === me && isCreature(s, p) && p.counters > 0);
    case "subtypeYou": return s.battlefield.filter((p) => p.controller === me && isCreature(s, p) && hasSubtype(s, p, e_subtype ?? ""));
    default: return s.battlefield.filter((p) => isCreature(s, p));
  }
};

const whoSeats = (s: CState, who: string | undefined, ctx: Ctx): Seat[] => {
  switch (who) {
    case "eachOpponent": return opponentsOf(s, ctx.controller);
    case "eachPlayer": return active(s);
    case "player": case "opponent": { const t = ctx.targets.shift(); return t?.kind === "player" ? [t.seat] : []; }
    case "that": return ctx.that?.kind === "player" ? [ctx.that.seat] : ctx.that?.kind === "perm" ? [find(s, ctx.that.uid)?.controller ?? ctx.controller] : [];
    case "thatController": return ctx.that?.kind === "perm" ? [find(s, ctx.that.uid)?.controller ?? ctx.thatController ?? ctx.controller] : ctx.that?.kind === "player" ? [ctx.that.seat] : [ctx.thatController ?? ctx.controller];
    default: return [ctx.controller];
  }
};

/** Should an optional ("you may") effect happen? Upside-only effects do; others only with a sensible target. */
const wantsOptional = (s: CState, e: Effect, ctx: Ctx): boolean => {
  if (e.op === "bounce" && e.target === "otherPermanentYou") return false;
  const me = ctx.controller;
  // Optional costs: only pay them when the price is small and the reward exists.
  if (e.op === "sacrificeAnother") { const others = s.battlefield.filter((p) => p.controller === me && isCreature(s, p) && p.uid !== ctx.source?.uid); const cheapest = [...others].sort((a, b) => power(s, a) + toughness(s, a) - power(s, b) - toughness(s, b))[0]; return !!cheapest && others.length >= 2 && power(s, cheapest) + toughness(s, cheapest) <= 3; }
  if (e.op === "sacrificeLand") return s.battlefield.filter((p) => p.controller === me && isLand(s, p)).length >= 3;
  if (e.op === "discard") return player(s, me).hand.length >= 2;
  if (e.op === "pay") return !!e.then && canAfford(s, me, e.cost ?? "");
  if (e.op === "payX") return (ctx.amount ?? 0) > 0 && canAfford(s, me, "1");
  if (e.op === "putLandFromHand") return player(s, me).hand.some((u) => def(s, s.cards[u] ?? "").kind === "land");
  if (e.target && e.target !== "self") return ctx.targets.length > 0;
  return true;
};

export function run(s: CState, effects: Effect[], ctx: Ctx): CState {
  let st = s;
  for (const e of effects) {
    if (!condition(st, e.if, ctx)) { st = log(st, `(${def(st, ctx.sourceCard).name}: its condition isn't met, so that part doesn't happen.)`); continue; }
    if (e.ifNot && condition(st, e.ifNot, ctx)) continue;
    if (e.optional && !wantsOptional(st, e, ctx)) continue;
    const before = st;
    st = runOne(st, e, ctx);
    if (st.winner) return st;
    // "If you do, ..." runs only when the optional action actually happened.
    if (e.then && st !== before) st = run(st, e.then, ctx);
  }
  return st;
}

function runOne(s: CState, e: Effect, ctx: Ctx): CState {
  let st = s;
  const me = ctx.controller;
  const src = ctx.source ? find(st, ctx.source.uid) ?? ctx.source : null;
  const srcName = def(st, ctx.sourceCard).name;
  const permTarget = (spec: string | undefined): Perm | null => { const t = takeTarget(ctx, spec); if (!t || t.kind !== "perm") return null; const p = find(st, t.uid); if (!p) st = log(st, `${srcName}'s target is gone, so that part does nothing.`); return p ?? null; };
  switch (e.op) {
    case "seq": return run(st, e.effects ?? [], ctx);
    case "pump": {
      const p = permTarget(e.target); if (!p) return st;
      if (e.cond && !condOk(st, { kind: "perm", uid: p.uid }, e.cond)) return st;
      st = setPerm(st, p.uid, (x) => ({ ...x, pump: { p: x.pump.p + (e.p ?? 0), t: x.pump.t + (e.t ?? 0) }, granted: [...x.granted, ...(e.keywords ?? [])] }));
      const after = find(st, p.uid)!;
      return checkState(log(st, `${pdef(st, p).name} is ${power(st, after)}/${toughness(st, after)}${e.keywords?.length ? ` and has ${e.keywords.join(", ").toLowerCase()}` : ""} until end of turn.`));
    }
    case "pumpAll": {
      const list = filterPerms(st, e.filter, ctx);
      const n = e.perAttacking ? Object.keys(st.attackers).filter((u) => find(st, u)?.controller === me).length : 0;
      const dp = (e.p ?? 0) + n, dt = (e.t ?? 0) + n;
      for (const p of list) st = setPerm(st, p.uid, (x) => ({ ...x, pump: { p: x.pump.p + dp, t: x.pump.t + dt }, granted: [...x.granted, ...(e.keywords ?? [])] }));
      if (list.length) st = log(st, `${srcName}: ${list.length} creature${list.length === 1 ? "" : "s"} get${list.length === 1 ? "s" : ""} ${dp >= 0 ? "+" : ""}${dp}/${dt >= 0 ? "+" : ""}${dt}${e.keywords?.length ? ` and ${e.keywords.join(", ").toLowerCase()}` : ""} until end of turn.`);
      return checkState(st);
    }
    case "grant": { const p = permTarget(e.target); if (!p) return st; st = setPerm(st, p.uid, (x) => ({ ...x, granted: [...x.granted, ...(e.keywords ?? [])] })); return log(st, `${pdef(st, p).name} gains ${(e.keywords ?? []).join(", ").toLowerCase()} until end of turn.`); }
    case "grantAll": { const list = filterPerms(st, e.filter, ctx); for (const p of list) st = setPerm(st, p.uid, (x) => ({ ...x, granted: [...x.granted, ...(e.keywords ?? [])] })); return list.length ? log(st, `${srcName}: ${list.length} permanent${list.length === 1 ? "" : "s"} gain ${(e.keywords ?? []).join(", ").toLowerCase()} until end of turn.`) : st; }
    case "counters": {
      if (e.target === "upToTwoOtherCreaturesYou") { let did = 0; while (ctx.targets.length && did < 2) { const p = permTarget(e.target); if (p) { st = setPerm(st, p.uid, (x) => ({ ...x, counters: x.counters + (e.n ?? 1) })); did++; st = log(st, `${pdef(st, p).name} gets a +1/+1 counter.`); } } return st; }
      if (e.target === "eachCreatureYou") { const list = filterPerms(st, "creaturesYou", ctx); for (const p of list) st = placeCounters(st, p.uid, e.n ?? 1); return list.length ? log(st, `${srcName}: each of ${poss(st, me)} creatures gets ${(e.n ?? 1) === 1 ? "a +1/+1 counter" : `${e.n} +1/+1 counters`}.`) : st; }
      const p = permTarget(e.target); if (!p) return st;
      const n = e.per === "lifeGained" ? ctx.amount ?? 0 : e.n ?? 1;
      if (n <= 0) return st;
      st = placeCounters(st, p.uid, n);
      const after = find(st, p.uid)!;
      return log(st, `${pdef(st, p).name} gets ${n === 1 ? "a +1/+1 counter" : `${n} +1/+1 counters`} (now ${power(st, after)}/${toughness(st, after)}).`);
    }
    case "countersAll": { const list = filterPerms(st, e.filter, ctx, e.subtype); for (const p of list) st = placeCounters(st, p.uid, e.n ?? 1); return list.length ? log(st, `${srcName}: each of ${poss(st, me)} ${list.length} creature${list.length === 1 ? "" : "s"} gets a +1/+1 counter.`) : st; }
    case "damage": {
      const n = e.n ?? 0;
      if (e.target === "eachOpponent") { for (const o of opponentsOf(st, me)) { st = log(st, `${srcName} deals ${n} damage to ${nameOf(st, o).toLowerCase() === "you" ? "you" : nameOf(st, o)}.`); st = damagePlayer(st, o, n, src); } return checkState(st); }
      if (e.target === "eachPlayer") { for (const o of active(st)) st = damagePlayer(st, o, n, src); return checkState(st); }
      const t = takeTarget(ctx, e.target);
      if (!t) return st;
      if (t.kind === "player") { st = log(st, `${srcName} deals ${n} damage to ${t.seat === st.human ? "you" : nameOf(st, t.seat)}.`); return checkState(damagePlayer(st, t.seat, n, src)); }
      if (t.kind === "perm") { const p = find(st, t.uid); if (!p) return log(st, `${srcName}'s target is gone, so it does nothing.`); st = log(st, `${srcName} deals ${n} damage to ${pdef(st, p).name}.`); return checkState(damageCreature(st, p.uid, n, src)); }
      return st;
    }
    case "destroy": {
      const p = permTarget(e.target); if (!p) return st;
      if (e.cond && !condOk(st, { kind: "perm", uid: p.uid }, e.cond)) return st;
      if (has(st, p, "Indestructible")) return log(st, `${pdef(st, p).name} is indestructible, so ${srcName} can't destroy it.`);
      remember(st, ctx, p);
      ctx.destroyedCount = (ctx.destroyedCount ?? 0) + 1;
      return checkState(die(st, p.uid, `${srcName} destroys ${pdef(st, p).name}.`));
    }
    case "wipe": {
      const what = e.what ?? "creatures";
      const list = st.battlefield.filter((p) => what === "artifacts" ? kindOf(st, p) === "artifact" : what === "enchantments" ? kindOf(st, p) === "enchantment" : what === "tappedCreatures" ? isCreature(st, p) && p.tapped : isCreature(st, p) && (e.maxMv === undefined || manaValue(pdef(st, p).cost) <= e.maxMv) && (e.minMv === undefined || manaValue(pdef(st, p).cost) >= e.minMv));
      st = log(st, `${srcName}: ${what === "artifacts" ? "every artifact" : what === "enchantments" ? "every enchantment" : what === "tappedCreatures" ? "every tapped creature" : e.maxMv !== undefined ? `every creature with mana value ${e.maxMv} or less` : e.minMv !== undefined ? `every creature with mana value ${e.minMv} or greater` : "every creature"} is destroyed.`);
      let count = 0;
      for (const p of list) { if (has(st, p, "Indestructible")) { st = log(st, `${pdef(st, p).name} is indestructible and stays.`); continue; } count++; st = die(st, p.uid, `${pdef(st, p).name} is destroyed.`); }
      ctx.destroyedCount = count;
      return checkState(st);
    }
    case "exile": {
      const p = permTarget(e.target); if (!p) return st;
      if (e.cond && !condOk(st, { kind: "perm", uid: p.uid }, e.cond)) return st;
      remember(st, ctx, p);
      return checkState(leave(st, p.uid, "exile", `${srcName} exiles ${pdef(st, p).name}.`));
    }
    case "noop": return st;
    case "pay": { const paid = pay(st, me, e.cost ?? ""); if (!paid) return st; return log(paid, `${nameOf(st, me)} ${verb(st, me, "pay", "pays")} {${e.cost}} for ${srcName}.`); }
    case "monarch": { st = { ...st, monarch: me }; return log(st, `${nameOf(st, me)} ${verb(st, me, "become", "becomes")} the monarch: a card at the end of each of ${poss(st, me)} turns, until someone deals combat damage to ${me === st.human ? "you" : "them"}.`); }
    case "investigate": {
      const n = e.per === "opponentsWithMoreCards" ? opponentsOf(st, me).filter((o) => player(st, o).hand.length > player(st, me).hand.length).length : e.n ?? 1;
      const clue: CDef = { id: "token:clue", name: "Clue", kind: "artifact", type: "Token Artifact — Clue", cost: "", colors: "", text: "{2}, Sacrifice this artifact: Draw a card.", artist: "", num: "", rarity: "token", legendary: false, token: true, abilities: [{ kind: "activated", cost: { mana: "2", sacrificeSelf: true }, effects: [{ op: "draw", who: "you", n: 1 }] }] };
      if (!st.tokens[clue.id]) st = { ...st, tokens: { ...st.tokens, [clue.id]: clue } };
      if (n <= 0) return st;
      st = log(st, `${srcName}: ${nameOf(st, me)} investigate${verb(st, me, "", "s")}${n > 1 ? ` ${n} times` : ""} (a Clue token: {2}, sacrifice it: draw a card).`);
      for (let i = 0; i < n; i++) st = enter(st, clue.id, me, { isToken: true });
      return st;
    }
    case "putLandFromHand": {
      const pl = player(st, me);
      const uid = pl.hand.find((u) => def(st, st.cards[u] ?? "").kind === "land");
      if (!uid) return st;
      const card = st.cards[uid]!;
      st = setPlayer(st, me, { hand: pl.hand.filter((u) => u !== uid) });
      st = log(st, `${srcName}: ${nameOf(st, me)} put${verb(st, me, "", "s")} ${def(st, card).name} from hand onto the battlefield.`);
      return enter(st, card, me, { uid });
    }
    case "topToHandIf": {
      const pl = player(st, me);
      const top = pl.library[0];
      if (!top) return st;
      const chosen = ctx.source?.chosen;
      const d = def(st, top);
      if (d.kind === "creature" && chosen && subtypesOf(d).includes(chosen)) {
        const [n2, uid] = nextUid(st, "h");
        st = setPlayer(n2, me, { library: pl.library.slice(1), hand: [...pl.hand, uid] });
        st = { ...st, cards: { ...st.cards, [uid]: top } };
        return log(st, `${srcName}: the top card is ${d.name}, a ${chosen}, so ${nameOf(st, me)} put${verb(st, me, "", "s")} it into ${poss(st, me)} hand.`);
      }
      return log(st, `${srcName}: the top card isn't a ${chosen ?? "creature of the chosen type"}, so it stays.`);
    }
    case "regrowSelf": {
      const pl = player(st, me);
      const idx = pl.graveyard.lastIndexOf(ctx.sourceCard);
      if (idx < 0) return st;
      const [n2, uid] = nextUid(st, "h");
      st = setPlayer(n2, me, { graveyard: pl.graveyard.filter((_, i) => i !== idx), hand: [...pl.hand, uid] });
      st = { ...st, cards: { ...st.cards, [uid]: ctx.sourceCard } };
      return log(st, `${srcName} returns from the graveyard to ${poss(st, me)} hand.`);
    }
    case "exileUntilLeaves": {
      if (!src) return st;
      const many = e.target === "upToThreeOtherCreatures";
      let done = 0;
      do {
        const p = permTarget(e.target); if (!p) break;
        const card = p.card, owner = p.owner;
        st = leave(st, p.uid, "exile", `${srcName} exiles ${pdef(st, p).name} until ${srcName} leaves the battlefield.`);
        // A commander goes to the command zone instead (CR 903.9a) and a token stops existing; only a real card waits in exile.
        if (!pdef(s, p).token && !p.isCommander) { st = setPlayer(st, owner, { exile: player(st, owner).exile.filter((c, i, arr) => !(c === card && i === arr.lastIndexOf(card))) }); st = setPerm(st, src.uid, (x) => ({ ...x, exiled: [...(x.exiled ?? []), { card, owner, ...(e.toHand ? { toHand: true } : {}) }] })); }
        done++;
      } while (many && ctx.targets.length && done < 3);
      return checkState(st);
    }
    case "namedCounter": {
      const p = permTarget(e.target); if (!p) return st;
      st = setPerm(st, p.uid, (x) => ({ ...x, namedCounters: { ...x.namedCounters, [e.name ?? "counter"]: (x.namedCounters?.[e.name ?? "counter"] ?? 0) + 1 } }));
      return refresh(log(st, `${srcName} puts a ${e.name} counter on ${pdef(st, p).name}.`));
    }
    case "drawIfLifeNoted": {
      const noted = src?.noted ?? player(st, me).life;
      const life = player(st, me).life;
      if (life >= noted) { st = log(st, `${srcName}: ${nameOf(st, me)} ${verb(st, me, "are", "is")} at ${life} life, not below the noted ${noted}, so ${verb(st, me, "you draw", "they draw")} a card.`); st = drawCards(st, me, 1); }
      else st = log(st, `${srcName}: ${nameOf(st, me)} ${verb(st, me, "are", "is")} below the noted life total (${life} vs ${noted}), so no card.`);
      if (src) st = setPerm(st, src.uid, (x) => ({ ...x, noted: player(st, me).life }));
      return st;
    }
    case "payX": {
      // Pay as much as is useful: up to the life gained, and only what spare mana allows.
      const max = e.maxPer === "lifeGained" ? ctx.amount ?? 0 : 0;
      let x = 0;
      for (let k = max; k > 0; k--) { if (pay(st, me, String(k))) { x = k; break; } }
      if (x <= 0) return st;
      const paid = pay(st, me, String(x))!;
      ctx.X = x;
      return log(paid, `${nameOf(st, me)} ${verb(st, me, "pay", "pays")} {${x}} for ${srcName}.`);
    }
    case "manaRider": case "manaOnly": return st;
    case "exileGraveyard": { for (const seat of whoSeats(st, e.who, ctx)) { const pl = player(st, seat); st = setPlayer(st, seat, { graveyard: [], exile: [...pl.exile, ...pl.graveyard] }); st = log(st, `${srcName} exiles ${poss(st, seat)} graveyard (${pl.graveyard.length} cards).`); } return st; }
    case "bounce": { const p = permTarget(e.target); if (!p) return st; return checkState(leave(st, p.uid, "hand", `${srcName} returns ${pdef(st, p).name} to its owner's hand.`)); }
    case "bounceAll": { const list = filterPerms(st, e.filter, ctx); st = log(st, `${srcName} returns ${list.length} creature${list.length === 1 ? "" : "s"} to their owners' hands.`); for (const p of list) st = leave(st, p.uid, "hand"); return checkState({ ...st, attackers: {} }); }
    case "counter": {
      const t = takeTarget(ctx, e.target);
      if (!t || t.kind !== "spell") return st;
      const victim = st.stack.find((x) => x.uid === t.uid);
      if (!victim) return log(st, `${srcName} has nothing to counter any more.`);
      st = { ...st, stack: st.stack.filter((x) => x.uid !== t.uid) };
      const vd = def(st, victim.card);
      if (victim.fromCommandZone) { st = setPlayer(st, victim.caster, { commandZone: { ...player(st, victim.caster).commandZone, inZone: true } }); return log(st, `${srcName} counters ${vd.name}. It goes back to the command zone.`); }
      st = setPlayer(st, victim.caster, { graveyard: [...player(st, victim.caster).graveyard, victim.card] });
      return log(st, `${srcName} counters ${vd.name}. It goes to the graveyard without happening.`);
    }
    case "gainLife": {
      let n = e.n ?? 0;
      if (e.per === "attacking") n = (e.n ?? 1) * Object.keys(st.attackers).filter((u) => find(st, u)?.controller === me).length;
      else if (e.per === "gates") n = (e.n ?? 1) * st.battlefield.filter((p) => p.controller === me && hasSubtype(st, p, "Gate")).length;
      else if (e.per === "sacrificedToughness") n = ctx.sacrificed ? toughness(s, ctx.sacrificed) : 0;
      else if (e.per === "destroyedThisWay") n = ctx.destroyedCount ?? 0;
      else if (e.per === "thatPower") n = ctx.thatPower ?? 0;
      else if (e.per === "thatToughness") n = ctx.thatToughness ?? 0;
      for (const seat of whoSeats(st, e.who, ctx)) st = gainLife(st, seat, n);
      return st;
    }
    case "loseLife": { for (const seat of whoSeats(st, e.who, ctx)) st = loseLife(st, seat, e.n ?? 0); return checkState(st); }
    case "draw": {
      if (e.payOptional) { const paid = pay(st, me, e.payOptional); if (!paid) return st; st = log(paid, `${nameOf(st, me)} ${verb(st, me, "pay", "pays")} {${e.payOptional}} for ${srcName}.`); }
      let n = e.n ?? 1;
      if (e.per === "X") n = ctx.X ?? 0;
      if (e.per === "counteredCreaturesYou") n = st.battlefield.filter((p) => p.controller === me && isCreature(st, p) && p.counters > 0).length;
      else if (e.per === "distinctMv") n = new Set(st.battlefield.filter((p) => p.controller === me && !isLand(st, p)).map((p) => manaValue(pdef(st, p).cost))).size;
      for (const seat of whoSeats(st, e.who, ctx)) st = drawCards(st, seat, n);
      return checkState(st);
    }
    case "loot": { st = drawCards(st, me, e.n ?? 1); return discard(st, me, e.n ?? 1, srcName); }
    case "discard": { for (const seat of whoSeats(st, e.who, ctx)) st = discard(st, seat, e.n ?? 1, srcName); return st; }
    case "scry": return scry(st, me, e.n ?? 1, srcName);
    case "surveil": return surveil(st, me, e.n ?? 1, srcName);
    case "mill": { for (const seat of whoSeats(st, e.who, ctx)) { const pl = player(st, seat); const n = Math.min(e.n ?? 1, pl.library.length); st = setPlayer(st, seat, { library: pl.library.slice(n), graveyard: [...pl.graveyard, ...pl.library.slice(0, n)] }); st = log(st, `${nameOf(st, seat)} mill${verb(st, seat, "", "s")} ${n} card${n === 1 ? "" : "s"} (library to graveyard).`); } return st; }
    case "token": {
      let spec: Effect = e;
      if (e.monarchAlt && st.monarch === me) spec = { ...e, ...e.monarchAlt };
      const owners = e.who === "thatController" ? whoSeats(st, "thatController", ctx) : [me];
      for (const owner of owners) {
        let d = tokenDef(spec);
        // "If one or more creature tokens would be created under your control, that many 4/4 Angels are created instead."
        const rep = d.kind === "creature" ? st.battlefield.find((p) => p.controller === owner && statics(st, p).some((a) => a.op === "tokenReplace")) : undefined;
        if (rep) { const a = statics(st, rep).find((x) => x.op === "tokenReplace")!; d = tokenDef({ op: "token", n: e.n ?? 1, p: a.p ?? 0, t: a.t ?? 0, color: a.color ?? "white", subtype: a.subtype ?? "Angel", keywords: a.keywords ?? [] }); }
        if (!st.tokens[d.id]) st = { ...st, tokens: { ...st.tokens, [d.id]: d } };
        const n = e.n ?? 1;
        st = log(st, `${srcName}: ${nameOf(st, owner)} ${verb(st, owner, "create", "creates")} ${n === 1 ? "a" : n} ${d.kind === "creature" ? `${d.power}/${d.toughness} ${d.name} creature token${n === 1 ? "" : "s"}` : `${d.name} token${n === 1 ? "" : "s"}`}.`);
        for (let i = 0; i < n; i++) st = enter(st, d.id, owner, { isToken: true });
      }
      return st;
    }
    case "tap": case "freeze": { const p = permTarget(e.target); if (!p) return st; st = setPerm(st, p.uid, (x) => ({ ...x, tapped: true })); return log(st, `${srcName} taps ${pdef(st, p).name}.`); }
    case "untap": { const p = permTarget(e.target); if (!p) return st; st = setPerm(st, p.uid, (x) => ({ ...x, tapped: false })); return log(st, `${srcName} untaps ${pdef(st, p).name}.`); }
    case "cantBlock": { const p = permTarget(e.target); if (!p) return st; st = setPerm(st, p.uid, (x) => ({ ...x, cantBlockEOT: true })); return log(st, `${pdef(st, p).name} can't block this turn.`); }
    case "sacrificeSelf": { if (!src || !find(st, src.uid)) return st; return checkState(die(st, src.uid, `${srcName} is sacrificed.`)); }
    case "sacrificeAny": {
      for (const seat of whoSeats(st, e.who, ctx)) {
        const mine = st.battlefield.filter((p) => p.controller === seat && isCreature(st, p)).sort((a, b) => power(st, a) + toughness(st, a) - power(st, b) - toughness(st, b));
        const v = mine[0]; if (!v) continue;
        st = die(st, v.uid, `${nameOf(st, seat)} sacrifice${verb(st, seat, "", "s")} ${pdef(st, v).name}.`);
      }
      return checkState(st);
    }
    case "regrow": case "reanimate": {
      const pl = player(st, me);
      const choices = pl.graveyard.filter((c) => def(st, c).kind === "creature");
      const best = [...choices].sort((a, b) => manaValue(def(st, b).cost) - manaValue(def(st, a).cost))[0];
      if (!best) return log(st, `${srcName}: there's no creature card in ${poss(st, me)} graveyard.`);
      const idx = pl.graveyard.lastIndexOf(best);
      st = setPlayer(st, me, { graveyard: pl.graveyard.filter((_, i) => i !== idx) });
      if (e.op === "regrow") { const [n2, uid] = nextUid(st, "h"); st = setPlayer(n2, me, { hand: [...player(n2, me).hand, uid] }); st = { ...st, cards: { ...st.cards, [uid]: best } }; return log(st, `${srcName} returns ${def(st, best).name} from the graveyard to ${poss(st, me)} hand.`); }
      st = log(st, `${srcName} returns ${def(st, best).name} from the graveyard to the battlefield.`);
      return enter(st, best, me);
    }
    case "reanimateAll": {
      const pl = player(st, me);
      const back = pl.graveyard.filter((c) => def(st, c).kind === "creature" && manaValue(def(st, c).cost) <= (e.maxMv ?? 0));
      if (!back.length) return log(st, `${srcName}: nothing in ${poss(st, me)} graveyard qualifies.`);
      st = setPlayer(st, me, { graveyard: pl.graveyard.filter((c) => !back.includes(c)) });
      st = log(st, `${srcName} returns ${back.map((c) => def(st, c).name).join(", ")} to the battlefield.`);
      for (const c of back) st = enter(st, c, me);
      return st;
    }
    case "rampTapped": {
      const want = Math.min(e.n ?? 1, 2);
      let got = 0;
      if (e.who === "thatController") { const seat = whoSeats(st, "thatController", ctx)[0]; if (seat && seat !== me) { const sub: Ctx = { ...ctx, controller: seat, source: null, targets: [] }; const { who: _w, ...rest } = e; void _w; return run(st, [rest], sub); } }
      const needColors = [...new Set(st.battlefield.filter((p) => p.controller === me).flatMap((p) => pdef(st, p).colors.split("")))];
      const identity = def(st, player(st, me).commandZone.card).colors;
      for (let k = 0; k < want; k++) {
        // Re-read the library each time: the land entering can trigger draws (landfall) that change it.
        const lib = player(st, me).library;
        const basics = lib.filter((c) => def(st, c).type.startsWith("Basic Land"));
        const missing = basics.find((c) => { const col = def(st, c).abilities[0]?.effects?.[0]?.colors?.[0] ?? ""; return identity.includes(col) && !needColors.includes(col); });
        const sameAs = e.sameType && got > 0 ? st.battlefield.filter((p) => p.controller === me).slice(-1)[0] : undefined;
        const pick = sameAs ? basics.find((c) => def(st, c).type === pdef(st, sameAs).type) : missing ?? basics[0];
        if (!pick) break;
        const idx = lib.indexOf(pick);
        st = setPlayer(st, me, { library: lib.filter((_, i) => i !== idx) });
        st = log(st, `${srcName}: ${nameOf(st, me)} search${verb(st, me, "", "es")} the library for ${def(st, pick).name} and put${verb(st, me, "", "s")} it onto the battlefield tapped.`);
        st = enter(st, pick, me, { tapped: true });
        got++;
      }
      if (got === 0) st = log(st, `${srcName}: no basic land left to find.`);
      const [n2, shuffled] = shuffleIn(st, player(st, me).library);
      return setPlayer(n2, me, { library: shuffled });
    }
    case "addMana": {
      const pool = { ...player(st, me).pool };
      const c = ((e.colors?.[0] === ("identity" as string) ? def(st, player(st, me).commandZone.card).colors[0] : e.colors?.[0]) ?? "C") as Color | "C";
      pool[c] = (pool[c] ?? 0) + (e.n ?? 1);
      return setPlayer(st, me, { pool });
    }
    case "bite": {
      const a = permTarget(e.target); const b = permTarget(e.target2);
      if (!a || !b) return st;
      st = log(st, `${pdef(st, a).name} deals ${power(st, a)} damage to ${pdef(st, b).name}.`);
      return checkState(damageCreature(st, b.uid, power(st, a), a));
    }
    case "fight": {
      const a = permTarget(e.target); const b = permTarget(e.target2);
      if (!a || !b) return st;
      st = log(st, `${pdef(st, a).name} fights ${pdef(st, b).name}.`);
      st = damageCreature(st, b.uid, power(st, a), a);
      return checkState(damageCreature(st, a.uid, power(st, b), b));
    }
    case "sacrificeAnother": {
      const others = st.battlefield.filter((p) => p.controller === me && isCreature(st, p) && p.uid !== ctx.source?.uid).sort((a, b) => power(st, a) + toughness(st, a) - power(st, b) - toughness(st, b));
      const v = others[0]; if (!v) return st;
      ctx.sacrificed = v;
      return checkState(die(st, v.uid, `${nameOf(st, me)} sacrifice${verb(st, me, "", "s")} ${pdef(st, v).name} to ${srcName}.`));
    }
    case "sacrificeLand": {
      const lands = st.battlefield.filter((p) => p.controller === me && isLand(st, p)).sort((a, b) => Number(b.tapped) - Number(a.tapped));
      const v = lands[0]; if (!v) return st;
      return checkState(leave(st, v.uid, "graveyard", `${nameOf(st, me)} sacrifice${verb(st, me, "", "s")} ${pdef(st, v).name} to ${srcName}.`));
    }
    case "fetchLandToHand": {
      let found = 0;
      for (let k = 0; k < (e.n ?? 1); k++) {
        const pl = player(st, me);
        const pick = pl.library.find((c) => def(st, c).kind === "land" && (!e.basic || def(st, c).type.startsWith("Basic Land")) && (!e.basicType || def(st, c).type.includes(e.basicType)));
        if (!pick) break;
        const idx = pl.library.indexOf(pick);
        const [n2, uid] = nextUid(st, "h");
        st = setPlayer(n2, me, { library: pl.library.filter((_, i) => i !== idx), hand: [...pl.hand, uid] });
        st = { ...st, cards: { ...st.cards, [uid]: pick } };
        st = log(st, `${srcName}: ${nameOf(st, me)} search${verb(st, me, "", "es")} the library for ${def(st, pick).name} and put${verb(st, me, "", "s")} it into ${poss(st, me)} hand.`);
        found++;
      }
      if (!found) return log(st, `${srcName}: no land to find.`);
      const [n3, shuffled] = shuffleIn(st, player(st, me).library);
      return setPlayer(n3, me, { library: shuffled });
    }
    default: return log(st, `(${srcName}: "${e.op}" isn't something this table can do yet, so it's skipped.)`);
  }
}

function discard(s: CState, seat: Seat, n: number, why: string): CState {
  let st = s;
  for (let i = 0; i < n; i++) {
    const pl = player(st, seat);
    if (!pl.hand.length) break;
    // Rule of thumb: throw away the most expensive card you can't cast soon, or a spare land.
    const lands = st.battlefield.filter((p) => p.controller === seat && isLand(st, p)).length;
    const pick = [...pl.hand].sort((a, b) => score(b) - score(a))[0]!;
    function score(uid: string) { const d = def(st, st.cards[uid] ?? ""); if (d.kind === "land") return lands >= 6 ? 10 : -5; return manaValue(d.cost) - lands; }
    const card = st.cards[pick] ?? "";
    st = setPlayer(st, seat, { hand: pl.hand.filter((u) => u !== pick), graveyard: [...pl.graveyard, card] });
    st = log(st, `${why}: ${nameOf(st, seat)} discard${verb(st, seat, "", "s")} ${def(st, card).name}.`);
  }
  return st;
}

function scry(s: CState, seat: Seat, n: number, why: string): CState {
  const pl = player(s, seat);
  const top = pl.library.slice(0, n), rest = pl.library.slice(n);
  const lands = s.battlefield.filter((p) => p.controller === seat && isLand(s, p)).length;
  const handLands = pl.hand.filter((u) => def(s, s.cards[u] ?? "").kind === "land").length;
  const wantLand = lands + handLands < 5;
  const keep = top.filter((c) => (def(s, c).kind === "land") === wantLand || manaValue(def(s, c).cost) <= lands + 1);
  const bottom = top.filter((c) => !keep.includes(c));
  let st = setPlayer(s, seat, { library: [...keep, ...rest, ...bottom] });
  st = log(st, `${why}: ${nameOf(st, seat)} scr${verb(st, seat, "y", "ies")} ${n}${bottom.length ? `, putting ${bottom.map((c) => def(st, c).name).join(", ")} on the bottom` : ", keeping it on top"}.`);
  return st;
}

function surveil(s: CState, seat: Seat, n: number, why: string): CState {
  const pl = player(s, seat);
  const top = pl.library.slice(0, n), rest = pl.library.slice(n);
  const lands = s.battlefield.filter((p) => p.controller === seat && isLand(s, p)).length;
  const keep = top.filter((c) => (def(s, c).kind === "land" ? lands < 6 : manaValue(def(s, c).cost) <= lands + 2));
  const gone = top.filter((c) => !keep.includes(c));
  let st = setPlayer(s, seat, { library: [...keep, ...rest], graveyard: [...pl.graveyard, ...gone] });
  st = log(st, `${why}: ${nameOf(st, seat)} surveil${verb(st, seat, "", "s")} ${n}${gone.length ? `, putting ${gone.map((c) => def(st, c).name).join(", ")} into the graveyard` : ", keeping it on top"}.`);
  return st;
}

/* ------------------------------------------------------------------ triggers (CR 603) */

interface TriggerCtx { perm?: Perm; seat?: Seat; amount?: number; wasAttacking?: boolean; attackers?: string[]; spellKind?: string; spellColors?: string; defender?: Seat; defenders?: Seat[] }

function matches(s: CState, holder: Perm, a: Ability, when: string, c: TriggerCtx): boolean {
  const w = a.when ?? "";
  const self = c.perm?.uid === holder.uid;
  const mineEvent = c.seat === holder.controller;
  switch (when) {
    case "etb": return self && (w === "etb" || w === "etbOrDies" || w === "etbOrAttacks" || (w === "etb:raid" && player(s, holder.controller).attackedThisTurn) || (w === "etb:morbid" && s.creatureDiedThisTurn));
    case "creatureEnters": {
      if (!c.perm || self) return false;
      if (w === "anotherCreatureEnters" || w === "creatureYouEnters") return c.perm.controller === holder.controller;
      if (w === "anotherSubtypeEnters") return c.perm.controller === holder.controller && (hasSubtype(s, c.perm, a.subtype ?? "creature") || (!!a.subtype2 && hasSubtype(s, c.perm, a.subtype2)));
      if (w === "smallCreatureEnters") return c.perm.controller === holder.controller && power(s, c.perm) <= 2;
      if (w === "oppCreatureEnters") return c.perm.controller !== holder.controller;
      if (w === "bigCreatureEnters") return c.perm.controller === holder.controller && power(s, c.perm) >= 4;
      return false;
    }
    case "gateEnters": return w === "gateEnters" && !!c.perm && c.perm.controller === holder.controller && hasSubtype(s, c.perm, "Gate");
    case "targetedByYourSpell": return self && w === "targetedByYourSpell";
    case "nontokenCreatureEnters": return w === "selfOrAnotherSubtypeEnters" && !!c.perm && c.perm.controller === holder.controller && (self || hasSubtype(s, c.perm, a.subtype ?? "creature"));
    case "subtypeYouEnters": return w === "subtypeYouEnters" && !!c.perm && c.perm.controller === holder.controller && hasSubtype(s, c.perm, a.subtype ?? "");
    case "countersOnSelf": return self && w === "countersOnSelf:once" && !(holder.firedThisTurn ?? []).includes(w);
    case "eachEndStep": return w === "eachEndStep";
    case "oppLandEnters": return w === "oppLandEnters" && !!c.perm && c.perm.controller !== holder.controller;
    case "dies": {
      if (!c.perm) return false;
      const token = !!def(s, c.perm.card).token;
      if (w === "anotherNontokenCreatureDies") return !self && !token;
      if (self) return w === "dies" || w === "etbOrDies" || w === "selfOrAnotherDies";
      if (c.perm.controller !== holder.controller) return false;
      return w === "selfOrAnotherDies" || w === "creatureYouDies" || w === "anotherCreatureYouDies" || (w === "nontokenCreatureYouDies" && !token) || (w === "subtypeYouDies" && hasSubtype(s, c.perm, a.subtype ?? ""));
    }
    case "landfall": return (w === "landfall" || w === "landfall:emeria") && mineEvent;
    case "attacks": return self && (w === "attacks" || w === "etbOrAttacks" || (w === "attacks:power4" && s.battlefield.some((p) => p.controller === holder.controller && isCreature(s, p) && power(s, p) >= 4)));
    case "youAttack": return mineEvent && (w === "youAttack" || (w === "youAttack3" && (c.attackers?.length ?? 0) >= 3) || (w === "youAttack2" && (c.attackers?.length ?? 0) >= 2));
    case "otherAttacks2": return !mineEvent && w === "otherAttacks2NotMe" && (c.attackers?.length ?? 0) >= 2 && !(c.defenders ?? []).includes(holder.controller);
    case "creatureAttacks": return w === "whiteCreatureAttacks" && !!c.perm && c.perm.controller === holder.controller && colorsOf(s, c.perm).includes("W");
    case "lifeGain": return w === "lifeGain" && mineEvent;
    case "firstLifeGain": return w === "firstLifeGain" && mineEvent;
    case "drawCard": return w === "drawCard" && mineEvent;
    case "upkeep": case "endStep": case "beginCombat": return mineEvent && (w === when || (when === "endStep" && w === "endStep:raid" && player(s, holder.controller).attackedThisTurn));
    case "cast": return mineEvent && ((w === "castSpell") || (w === "castCreature" && c.spellKind === "creature") || (w === "castNoncreature" && c.spellKind !== "creature") || (w === "castInstantSorcery" && (c.spellKind === "instant" || c.spellKind === "sorcery")) || (w === "castWhiteSpell" && (c.spellColors ?? "").includes("W")));
    case "combatDamageToPlayer": return self && w === "combatDamageToPlayer";
    case "blocked": return self && w === "blocked";
    case "blocks": return self && w === "blocks";
    default: return false;
  }
}

/** Fires every triggered ability that matches an event. Triggers resolve at once (simplification). */
export function fire(s: CState, when: string, c: TriggerCtx): CState {
  let st = s;
  const holders = [...s.battlefield];
  // A creature that just died still sees its own death (CR 603.10a).
  if (when === "dies" && c.perm && !holders.some((p) => p.uid === c.perm!.uid)) holders.push(c.perm);
  for (const holder of holders) {
    if (!find(st, holder.uid) && !(when === "dies" && holder.uid === c.perm?.uid)) continue;
    for (const a of triggers(st, holder)) {
      if (!matches(st, holder, a, when, c)) continue;
      if (a.when === "mirrorLifeLoss") continue;
      if (a.when === "landfall:emeria") {
        const pl = player(st, holder.controller);
        const best = [...pl.graveyard].filter((c) => def(st, c).kind !== "land").sort((x, y) => manaValue(def(st, y).cost) - manaValue(def(st, x).cost))[0];
        if (!best) continue;
        const idx = pl.graveyard.lastIndexOf(best);
        const plains = !!c.perm && hasSubtype(st, c.perm, "Plains");
        st = setPlayer(st, holder.controller, { graveyard: pl.graveyard.filter((_, i) => i !== idx) });
        if (plains) { st = log(st, `${pdef(st, holder).name}: the land was a Plains, so ${def(st, best).name} returns from the graveyard to the battlefield.`); st = enter(st, best, holder.controller); }
        else { const [n2, huid] = nextUid(st, "h"); st = setPlayer(n2, holder.controller, { hand: [...player(n2, holder.controller).hand, huid] }); st = { ...st, cards: { ...st.cards, [huid]: best } }; st = log(st, `${pdef(st, holder).name}: ${def(st, best).name} returns from the graveyard to ${poss(st, holder.controller)} hand.`); }
        continue;
      }
      if (a.when === "otherAttacks2NotMe") { if (c.seat) { st = log(st, `${pdef(st, holder).name} triggers: ${nameOf(st, c.seat)} attacked with two or more creatures and none came at ${holder.controller === st.human ? "you" : nameOf(st, holder.controller)}.`); st = drawCards(st, c.seat, 1); } continue; }
      if (a.when === "countersOnSelf:once") st = setPerm(st, holder.uid, (x) => ({ ...x, firedThisTurn: [...(x.firedThisTurn ?? []), a.when!] }));
      const d = pdef(st, holder);
      const specs = targetSpecs(a.effects);
      let targets: Target[] = [];
      if (specs.length) {
        const t = autoTargets(st, a.effects ?? [], holder.controller, holder.uid, d.colors);
        if (t === null) { st = log(st, `${d.name} triggers, but there's nothing it can target.`); continue; }
        targets = t;
      }
      st = log(st, `${d.name} triggers${c.perm && c.perm.uid !== holder.uid ? ` (${pdef(st, c.perm).name})` : ""}.`);
      const ctx: Ctx = { source: find(st, holder.uid) ?? holder, sourceCard: holder.card, controller: holder.controller, targets, wasAttacking: c.wasAttacking ?? false, ...(c.amount !== undefined ? { amount: c.amount } : {}) };
      if (c.perm && c.perm.uid !== holder.uid) { ctx.that = { kind: "perm", uid: c.perm.uid }; ctx.thatToughness = toughness(st, c.perm); ctx.thatPower = power(st, c.perm); ctx.thatController = c.perm.controller; }
      st = run(st, a.effects ?? [], ctx);
      if (st.winner) return st;
    }
  }
  return st;
}

/* ------------------------------------------------------------------ state-based actions (CR 704) */

export function checkState(s: CState): CState {
  let st = refresh(s);
  if (st.winner) return st;
  for (let guard = 0; guard < 20; guard++) {
    let changed = false;
    for (const p of [...st.battlefield]) {
      if (!find(st, p.uid)) continue;
      const d = pdef(st, p);
      if (d.kind === "creature") {
        if (toughness(st, p) <= 0) { st = die(st, p.uid, `${d.name} has toughness ${toughness(st, p)} and is put into the graveyard.`); changed = true; continue; }
        if ((p.damage >= toughness(st, p) || p.deathtouched) && !has(st, p, "Indestructible")) { st = die(st, p.uid, `${d.name} has lethal damage and is destroyed.`); changed = true; continue; }
      }
      if (isAura(d)) {
        const host = p.attachedTo ? find(st, p.attachedTo) : undefined;
        if (!host || !isCreature(st, host)) { st = leave(st, p.uid, "graveyard", `${d.name} isn't attached to a creature any more and goes to the graveyard.`); changed = true; continue; }
      }
    }
    for (const seat of active(st)) {
      const pl = player(st, seat);
      if (hasStatic(st, seat, "cantLose")) continue;
      const cmd = Object.entries(pl.commanderDamage).find(([, n]) => n >= 21);
      const reason = pl.life <= 0 ? `${nameOf(st, seat)} ${verb(st, seat, "are", "is")} at ${pl.life} life.` : pl.drewFromEmpty ? `${nameOf(st, seat)} tried to draw from an empty library.` : cmd ? `${def(st, cmd[0]).name} has dealt ${nameOf(st, seat).toLowerCase() === "you" ? "you" : nameOf(st, seat)} ${cmd[1]} combat damage: 21 or more from one commander.` : null;
      if (reason) { st = eliminate(st, seat, reason); changed = true; }
    }
    if (!changed) break;
  }
  const left = active(st);
  if (left.length === 1 && !st.winner) { st = { ...st, winner: left[0]! }; st = log(st, left[0] === st.human ? "You are the last player standing. You win the game!" : `${nameOf(st, left[0]!)} is the last player standing and wins the game.`); }
  return refresh(st);
}

/** A player leaves the game (CR 800.4a): everything they own leaves with them. */
export function eliminate(s: CState, seat: Seat, reason: string): CState {
  let st = log(s, `${reason} ${nameOf(s, seat)} ${verb(s, seat, "are", "is")} out of the game.`);
  // Everything they own leaves the game. The table keeps those cards in their graveyard so nothing is lost from the count.
  const gone = st.battlefield.filter((x) => x.owner === seat || x.controller === seat);
  const kept = gone.filter((x) => !pdef(st, x).token).map((x) => x.card);
  for (const p of gone) for (const ex of p.exiled ?? []) { if (!player(st, ex.owner).out && ex.owner !== seat) { st = log(st, `${def(st, ex.card).name} returns to the battlefield because ${pdef(st, p).name} left with ${nameOf(st, seat)}.`); st = enter(st, ex.card, ex.owner); } else kept.push(ex.card); }
  st = { ...st, battlefield: st.battlefield.filter((x) => !gone.some((g) => g.uid === x.uid)) };
  const spells = st.stack.filter((x) => x.caster === seat).map((x) => x.card);
  st = { ...st, battlefield: st.battlefield.map((x) => (x.attachedTo && !find(st, x.attachedTo) ? { ...x, attachedTo: null } : x)), stack: st.stack.filter((x) => x.caster !== seat) };
  const pl0 = player(st, seat);
  st = setPlayer(st, seat, { graveyard: [...pl0.graveyard, ...kept, ...spells, ...pl0.hand.map((u) => st.cards[u] ?? "").filter(Boolean)] });
  // Their attackers and blocks vanish; attacks aimed at them are removed from combat.
  const attackers: CState["attackers"] = {};
  for (const [uid, a] of Object.entries(st.attackers)) { if (!find(st, uid) || a.defender === seat) continue; attackers[uid] = { ...a, blockers: a.blockers.filter((b) => !!find(st, b)) }; }
  st = { ...st, attackers, blocksDone: st.blocksDone.filter((x) => x !== seat) };
  st = setPlayer(st, seat, { out: true, outReason: reason, hand: [], pool: {} });
  if (st.turn === seat && !st.winner) st = { ...st, step: "end" };
  return refresh(st);
}

/* ------------------------------------------------------------------ turn structure */

export function beginTurn(s: CState, seat: Seat): CState {
  let st: CState = { ...s, turn: seat, step: "main1", turnNumber: s.turnNumber + 1, attackers: {}, selectedAttackers: [], pendingBlocker: null, blocksDone: [], pending: null, creatureDiedThisTurn: false };
  st = { ...st, players: Object.fromEntries(Object.entries(st.players).map(([k, p]) => [k, { ...p, pool: {}, gainedLifeThisTurn: false, lostLifeThisTurn: false, attackedThisTurn: false, lifeGainedThisTurn: 0 }])) };
  st = { ...st, battlefield: st.battlefield.map((p) => (p.firedThisTurn?.length ? { ...p, firedThisTurn: [] } : p)) };
  st = setPlayer(st, seat, { landsPlayed: 0 });
  st = { ...st, battlefield: st.battlefield.map((p) => (p.controller === seat ? { ...p, tapped: false, summoningSick: false } : p)) };
  st = log(st, `— Turn ${st.turnNumber}: ${seat === st.human ? "your turn" : `${player(st, seat).name}'s turn`}. ${seat === st.human ? "Your" : "Their"} permanents untap.`);
  st = fire(st, "upkeep", { seat });
  // CR 103.8c: in a game with more than two players, nobody skips the first draw.
  st = drawCards(st, seat, 1);
  return checkState(st);
}

function cleanup(s: CState): CState {
  let st: CState = { ...s, battlefield: s.battlefield.map((p): Perm => ({ ...p, damage: 0, deathtouched: false, pump: { p: 0, t: 0 }, granted: [], cantBlockEOT: false })) };
  const pl = player(st, st.turn);
  if (pl.hand.length > 7 && !hasStatic(st, st.turn, "noHandLimit")) st = discard(st, st.turn, pl.hand.length - 7, "Hand size");
  return refresh(st);
}

export function endTurnFor(s: CState, seat: Seat): CState {
  let st: CState = { ...s, step: "end", attackers: {}, selectedAttackers: [], pendingBlocker: null, pending: null };
  st = fire(st, "endStep", { seat });
  st = fire(st, "eachEndStep", { seat });
  if (st.monarch === seat && !player(st, seat).out) { st = log(st, `${nameOf(st, seat)} ${verb(st, seat, "are", "is")} the monarch and draw${verb(st, seat, "", "s")} a card.`); st = drawCards(st, seat, 1); }
  st = checkState(st);
  if (st.winner) return st;
  st = cleanup(st);
  return beginTurn(st, nextSeat(st, seat));
}

/* ------------------------------------------------------------------ playing cards */

export function playLandFor(s: CState, seat: Seat, uid: string): CState {
  const card = s.cards[uid];
  if (!card) return s;
  const pl = player(s, seat);
  let st = setPlayer(s, seat, { hand: pl.hand.filter((u) => u !== uid), landsPlayed: pl.landsPlayed + 1 });
  st = log(st, `${nameOf(st, seat)} play${verb(st, seat, "", "s")} ${def(st, card).name}.`);
  return enter(st, card, seat, { uid });
}

export const canPlayLand = (s: CState, seat: Seat): boolean => s.turn === seat && isMain(s) && !s.stack.length && player(s, seat).landsPlayed < (hasStatic(s, seat, "extraLand") ? 2 : 1);

/** Casts a spell: pays, moves it to the stack, fires cast triggers. Targets must already be chosen. */
export function castFor(s: CState, seat: Seat, source: { kind: "hand"; uid: string } | { kind: "commander" }, targets: Target[], modes?: number[], useAlt = false): CState | null {
  const pl = player(s, seat);
  const card = source.kind === "hand" ? s.cards[source.uid] ?? "" : pl.commandZone.card;
  const d = def(s, card);
  const cost = source.kind === "commander" ? commanderCost(s, seat) ?? "" : costAfterReductions(s, seat, d, d.cost);
  let st: CState;
  const alt = d.abilities.find((a) => a.kind === "altCost");
  if (useAlt && alt) {
    const paidAlt = pay(s, seat, alt.mana ?? "", d);
    if (!paidAlt) return null;
    const tappers = paidAlt.battlefield.filter((x) => x.controller === seat && isCreature(paidAlt, x) && !x.tapped && has(paidAlt, x, alt.tapCreatures?.keyword ?? "Flying")).slice(0, alt.tapCreatures?.n ?? 0);
    if (tappers.length < (alt.tapCreatures?.n ?? 0)) return null;
    st = { ...paidAlt, battlefield: paidAlt.battlefield.map((x) => (tappers.some((t) => t.uid === x.uid) ? { ...x, tapped: true } : x)) };
    st = log(st, `${nameOf(st, seat)} pay${verb(st, seat, "", "s")} ${d.name}'s other cost: {${alt.mana}} and tapping ${tappers.map((t) => pdef(st, t).name).join(", ")}.`);
  } else {
    const paid = pay(s, seat, cost, d);
    if (!paid) return null;
    st = paid;
  }
  const extra = d.abilities.find((a) => a.kind === "spell")?.additionalCost;
  if (extra?.discard) {
    const others = player(st, seat).hand.filter((u) => !(source.kind === "hand" && u === source.uid));
    if (others.length < extra.discard) return null;
    st = discard({ ...st, players: { ...st.players, [seat]: { ...player(st, seat), hand: others } } }, seat, extra.discard, `${d.name}'s additional cost`);
    if (source.kind === "hand") st = setPlayer(st, seat, { hand: [...player(st, seat).hand, source.uid] });
  }
  if (extra?.sacrificeCreature) {
    const pool = st.battlefield.filter((x) => x.controller === seat && isCreature(st, x)).sort((x, y) => power(st, x) + toughness(st, x) - power(st, y) - toughness(st, y));
    const v = pool[0]; if (!v) return null;
    st = die(st, v.uid, `${nameOf(st, seat)} sacrifice${verb(st, seat, "", "s")} ${pdef(st, v).name} as ${d.name}'s additional cost.`);
  }
  let uid: string;
  if (source.kind === "hand") { uid = source.uid; st = setPlayer(st, seat, { hand: player(st, seat).hand.filter((u) => u !== uid) }); }
  else { [st, uid] = nextUid(st, "c"); st = setPlayer(st, seat, { commandZone: { ...player(st, seat).commandZone, inZone: false, casts: player(st, seat).commandZone.casts + 1 } }); }
  const spell: Spell = { uid, card, caster: seat, targets, ...(source.kind === "commander" ? { fromCommandZone: true } : {}), ...(modes ? { modes } : {}), castInMain: s.turn === seat && isMain(s) && !s.stack.length };
  st = { ...st, stack: [...st.stack, spell] };
  const tnames = targets.map((t) => (t.kind === "player" ? (t.seat === st.human ? "you" : nameOf(st, t.seat)) : t.kind === "perm" ? def(st, find(st, t.uid)?.card ?? "").name : def(st, st.stack.find((x) => x.uid === t.uid)?.card ?? "").name));
  st = log(st, `${nameOf(st, seat)} cast${verb(st, seat, "", "s")} ${d.name}${source.kind === "commander" ? " from the command zone" : ""}${cost ? ` for {${cost}}` : ""}${tnames.length ? `, targeting ${tnames.join(" and ")}` : ""}.`);
  st = fire(st, "cast", { seat, spellKind: d.kind, spellColors: d.colors });
  for (const t of targets) if (t.kind === "perm") { const tp = find(st, t.uid); if (tp && tp.controller === seat) st = fire(st, "targetedByYourSpell", { perm: tp, seat }); }
  // Prowess: "Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn."
  if (d.kind !== "creature") for (const p of st.battlefield) if (p.controller === seat && has(st, p, "Prowess")) { st = setPerm(st, p.uid, (x) => ({ ...x, pump: { p: x.pump.p + 1, t: x.pump.t + 1 } })); st = log(st, `Prowess: ${pdef(st, p).name} gets +1/+1 until end of turn.`); }
  return st;
}

/** Resolves the top of the stack (CR 608). */
export function resolveTop(s: CState): CState {
  const item = s.stack[s.stack.length - 1];
  if (!item) return s;
  let st: CState = { ...s, stack: s.stack.slice(0, -1) };
  const d = def(st, item.card);
  const ctx: Ctx = { source: null, sourceCard: item.card, controller: item.caster, targets: [...item.targets], castInMain: !!item.castInMain };
  if (d.kind === "creature" || d.kind === "artifact" || (d.kind === "enchantment" && !isAura(d))) {
    st = log(st, `${d.name} resolves and enters the battlefield${item.caster === st.human ? "" : ` on ${poss(st, item.caster)} side`}.`);
    return enter(st, item.card, item.caster, { uid: item.uid, isCommander: !!item.fromCommandZone });
  }
  if (isAura(d)) {
    const t = item.targets[0];
    const host = t?.kind === "perm" ? find(st, t.uid) : undefined;
    if (!host) { st = setPlayer(st, item.caster, { graveyard: [...player(st, item.caster).graveyard, item.card] }); return log(st, `${d.name}'s creature is gone, so the aura goes to the graveyard.`); }
    st = log(st, `${d.name} resolves and is attached to ${pdef(st, host).name}.`);
    return enter(st, item.card, item.caster, { uid: item.uid, attachTo: host.uid });
  }
  // Instants and sorceries.
  const spellAbility = d.abilities.find((a) => a.kind === "spell");
  const modal = d.abilities.find((a) => a.kind === "modal");
  st = setPlayer(st, item.caster, { graveyard: [...player(st, item.caster).graveyard, item.card] });
  st = log(st, `${d.name} resolves.`);
  if (spellAbility) st = run(st, spellAbility.effects ?? [], ctx);
  if (modal) for (const i of item.modes ?? []) { const effects = modal.choices?.[i]; if (effects) st = run(st, effects, ctx); }
  return checkState(st);
}

/** Pays an activated ability's cost and runs it (CR 602). Targets already chosen. */
export function activateFor(s: CState, seat: Seat, uid: string, index: number, targets: Target[]): CState | null {
  const p = find(s, uid);
  if (!p || p.controller !== seat) return null;
  const a = pdef(s, p).abilities[index];
  if (!a) return null;
  const d = pdef(s, p);
  if (a.kind === "equip") {
    if (!(s.turn === seat && isMain(s) && !s.stack.length)) return null;
    const host = targets[0]?.kind === "perm" ? find(s, targets[0].uid) : undefined;
    if (!host || host.controller !== seat || !isCreature(s, host)) return null;
    const paid = pay(s, seat, typeof a.cost === "string" ? a.cost : "");
    if (!paid) return null;
    let st = setPerm(paid, uid, (x) => ({ ...x, attachedTo: host.uid }));
    return refresh(log(st, `${nameOf(st, seat)} equip${verb(st, seat, "", "s")} ${pdef(st, host).name} with ${d.name}.`));
  }
  const cost: AbilityCost = typeof a.cost === "object" && a.cost ? a.cost : {};
  if (a.restriction === "sorcery" && !(s.turn === seat && isMain(s) && !s.stack.length)) return null;
  if (a.restriction === "lands>=5" && s.battlefield.filter((x) => x.controller === seat && isLand(s, x)).length < 5) return null;
  if (cost.tap && (p.tapped || (isCreature(s, p) && p.summoningSick && !has(s, p, "Haste")))) return null;
  let st = s;
  if (cost.mana) { const paid = pay(st, seat, cost.mana); if (!paid) return null; st = paid; }
  if (cost.tap) st = setPerm(st, uid, (x) => ({ ...x, tapped: true }));
  const ctx: Ctx = { source: find(st, uid) ?? p, sourceCard: p.card, controller: seat, targets: [...targets] };
  if (cost.sacrificeCreature) {
    const pool = st.battlefield.filter((x) => x.controller === seat && isCreature(st, x) && (cost.sacrificeCreature === "any" || x.uid !== uid)).sort((x, y) => power(st, x) + toughness(st, x) - power(st, y) - toughness(st, y));
    const v = pool[0]; if (!v) return null;
    ctx.sacrificed = v;
    st = die(st, v.uid, `${nameOf(st, seat)} sacrifice${verb(st, seat, "", "s")} ${pdef(st, v).name} to ${d.name}.`);
  }
  st = log(st, `${nameOf(st, seat)} activate${verb(st, seat, "", "s")} ${d.name}${cost.mana ? ` for {${cost.mana}}` : ""}.`);
  if (cost.sacrificeSelf) st = die(st, uid, `${d.name} is sacrificed.`);
  st = run(st, a.effects ?? [], ctx);
  return checkState(st);
}

/** Can this ability be activated right now by its controller (ignoring targets)? */
export function canActivate(s: CState, seat: Seat, p: Perm, a: Ability): boolean {
  if (p.controller !== seat) return false;
  if (a.kind === "equip") return s.turn === seat && isMain(s) && !s.stack.length && canAfford(s, seat, typeof a.cost === "string" ? a.cost : "") && s.battlefield.some((x) => x.controller === seat && isCreature(s, x) && x.uid !== p.attachedTo);
  if (a.kind !== "activated") return false;
  const cost: AbilityCost = typeof a.cost === "object" && a.cost ? a.cost : {};
  if (a.restriction === "sorcery" && !(s.turn === seat && isMain(s) && !s.stack.length)) return false;
  if (a.restriction === "lands>=5" && s.battlefield.filter((x) => x.controller === seat && isLand(s, x)).length < 5) return false;
  if (cost.tap && (p.tapped || (isCreature(s, p) && p.summoningSick && !has(s, p, "Haste")))) return false;
  if (cost.mana && !canAfford(s, seat, cost.mana)) return false;
  if (cost.sacrificeCreature && !s.battlefield.some((x) => x.controller === seat && isCreature(s, x) && (cost.sacrificeCreature === "any" || x.uid !== p.uid))) return false;
  if (a.effects?.[0]?.op === "addMana" && a.effects.length === 1) return false; // mana abilities are used automatically when paying
  return true;
}

/* ------------------------------------------------------------------ combat */

export const canAttack = (s: CState, p: Perm): boolean => p.controller === s.turn && isCreature(s, p) && !p.tapped && (!p.summoningSick || has(s, p, "Haste")) && !has(s, p, "Defender") && !p.bonus.pacified;

export function canBlock(s: CState, blocker: Perm, attacker: Perm): boolean {
  if (!isCreature(s, blocker) || blocker.tapped || blocker.bonus.pacified || blocker.bonus.cantBlock || blocker.cantBlockEOT) return false;
  if (has(s, attacker, "Unblockable")) return false;
  if (protectedFrom(s, attacker, blocker)) return false;
  if (has(s, attacker, "Flying") && !has(s, blocker, "Flying") && !has(s, blocker, "Reach")) return false;
  if (blocker.bonus.blockOnlyFlyers && !has(s, attacker, "Flying")) return false;
  if (attacker.bonus.evasion === "power2" && power(s, blocker) <= 2) return false;
  const big = /^powerAtLeast(\d+)$/.exec(attacker.bonus.evasion ?? "");
  if (big && power(s, blocker) >= Number(big[1])) return false;
  return true;
}

/** Legal, given the blocks already declared: menace needs two, "one blocker only" caps at one. */
export function blocksLegal(s: CState, attackers: CState["attackers"]): string | null {
  for (const [uid, a] of Object.entries(attackers)) {
    const att = find(s, uid); if (!att) continue;
    if (a.blockers.length === 1 && has(s, att, "Menace")) return `${pdef(s, att).name} has menace: it can't be blocked except by two or more creatures.`;
    if (a.blockers.length > 1 && att.bonus.evasion === "one") return `${pdef(s, att).name} can't be blocked by more than one creature.`;
  }
  return null;
}

/** Turn player attacks: taps non-vigilant attackers and fires attack triggers. `attackers` maps uid -> defender. */
export function attackWith(s: CState, attackers: Record<string, Seat>): CState {
  let st: CState = { ...s, step: "blockers", selectedAttackers: [], pendingBlocker: null, blocksDone: [] };
  const list = Object.keys(attackers).filter((uid) => { const p = find(st, uid); return p && canAttack(st, p) && !player(st, attackers[uid]!).out && attackers[uid] !== st.turn; });
  if (!list.length) return { ...st, step: "main2", attackers: {} };
  const rec: CState["attackers"] = {};
  for (const uid of list) rec[uid] = { defender: attackers[uid]!, blockers: [] };
  st = { ...st, attackers: rec };
  st = { ...st, battlefield: st.battlefield.map((p) => (rec[p.uid] && !has(st, p, "Vigilance") ? { ...p, tapped: true } : p)) };
  st = setPlayer(st, st.turn, { attackedThisTurn: true });
  // Exalted (CR 702.83): whenever a creature you control attacks alone, it gets +1/+1 until end of turn for each instance.
  if (list.length === 1) {
    const n = st.battlefield.filter((p) => p.controller === st.turn).reduce((k, p) => k + keywords(st, p).filter((x) => x === "Exalted").length, 0);
    if (n > 0) { st = setPerm(st, list[0]!, (x) => ({ ...x, pump: { p: x.pump.p + n, t: x.pump.t + n } })); st = log(st, `Exalted: ${pdef(st, find(st, list[0]!)!).name} attacks alone and gets +${n}/+${n} until end of turn.`); }
  }
  const byDefender = new Map<Seat, string[]>();
  for (const uid of list) byDefender.set(rec[uid]!.defender, [...(byDefender.get(rec[uid]!.defender) ?? []), pdef(st, find(st, uid)!).name]);
  for (const [dfd, names] of byDefender) st = log(st, `${nameOf(st, st.turn)} attack${verb(st, st.turn, "", "s")} ${dfd === st.human ? "you" : nameOf(st, dfd)} with ${names.join(", ")}.`);
  st = fire(st, "youAttack", { seat: st.turn, attackers: list, defenders: [...byDefender.keys()] });
  st = fire(st, "otherAttacks2", { seat: st.turn, attackers: list, defenders: [...byDefender.keys()] });
  for (const uid of list) { const p = find(st, uid); if (!p) continue; st = fire(st, "attacks", { perm: p, seat: st.turn }); st = fire(st, "creatureAttacks", { perm: p, seat: st.turn }); }
  return checkState(st);
}

/** Records one defending player's blocks (uid of attacker -> blockers) and fires block triggers. */
export function blockWith(s: CState, defender: Seat, blocks: Record<string, string[]>): CState {
  let st = s;
  const attackers = { ...st.attackers };
  for (const [auid, blockers] of Object.entries(blocks)) {
    const a = attackers[auid]; if (!a || a.defender !== defender) continue;
    const legal = blockers.filter((b) => { const bp = find(st, b); const ap = find(st, auid); return bp && ap && bp.controller === defender && canBlock(st, bp, ap) && !Object.values(attackers).some((x) => x.blockers.includes(b)); });
    attackers[auid] = { ...a, blockers: legal };
  }
  st = { ...st, attackers, blocksDone: [...st.blocksDone.filter((x) => x !== defender), defender] };
  const lines = Object.entries(blocks).filter(([auid]) => attackers[auid]?.blockers.length).map(([auid]) => `${attackers[auid]!.blockers.map((b) => pdef(st, find(st, b)!).name).join(" and ")} block${attackers[auid]!.blockers.length === 1 ? "s" : ""} ${pdef(st, find(st, auid)!).name}`);
  st = log(st, lines.length ? `${nameOf(st, defender)} block${verb(st, defender, "", "s")}: ${lines.join("; ")}.` : `${nameOf(st, defender)} ${verb(st, defender, "don't", "doesn't")} block.`);
  for (const [auid, a] of Object.entries(attackers)) {
    if (a.defender !== defender || !a.blockers.length) continue;
    const ap = find(st, auid); if (ap) st = fire(st, "blocked", { perm: ap, seat: ap.controller });
    for (const b of a.blockers) { const bp = find(st, b); if (bp) st = fire(st, "blocks", { perm: bp, seat: defender }); }
  }
  return checkState(st);
}

/** All defenders this combat have declared blocks? */
export const allBlocksIn = (s: CState): boolean => [...new Set(Object.values(s.attackers).map((a) => a.defender))].every((d) => s.blocksDone.includes(d) || player(s, d).out);

function combatDamage(s: CState, firstStrikeOnly: boolean): CState {
  let st = s;
  const strikes = (p: Perm) => (firstStrikeOnly ? has(st, p, "First strike") || has(st, p, "Double strike") : !has(st, p, "First strike") || has(st, p, "Double strike"));
  const dmg: Record<string, { n: number; from: Perm }[]> = {};
  const toPlayers: { seat: Seat; n: number; from: Perm }[] = [];
  const lines: string[] = [];
  for (const [auid, a] of Object.entries(st.attackers)) {
    const att = find(st, auid); if (!att) continue;
    const blockers = a.blockers.map((b) => find(st, b)).filter((b): b is Perm => !!b);
    if (strikes(att)) {
      let left = power(st, att);
      if (!blockers.length) { if (left > 0) { toPlayers.push({ seat: a.defender, n: left, from: att }); lines.push(`${pdef(st, att).name} is unblocked and deals ${left} damage to ${a.defender === st.human ? "you" : nameOf(st, a.defender)}.`); } }
      else {
        for (const b of blockers) {
          if (left <= 0) break;
          const lethal = has(st, att, "Deathtouch") ? 1 : Math.max(0, toughness(st, b) - b.damage - (dmg[b.uid]?.reduce((n, x) => n + x.n, 0) ?? 0));
          const give = has(st, att, "Trample") ? Math.min(left, lethal) : b === blockers[blockers.length - 1] ? left : Math.min(left, Math.max(lethal, 0));
          if (give > 0) { dmg[b.uid] = [...(dmg[b.uid] ?? []), { n: give, from: att }]; lines.push(`${pdef(st, att).name} deals ${give} damage to ${pdef(st, b).name}.`); }
          left -= give;
        }
        if (left > 0 && has(st, att, "Trample")) { toPlayers.push({ seat: a.defender, n: left, from: att }); lines.push(`${pdef(st, att).name} tramples over for ${left} to ${a.defender === st.human ? "you" : nameOf(st, a.defender)}.`); }
      }
    }
    for (const b of blockers) if (strikes(b) && power(st, b) > 0) { dmg[att.uid] = [...(dmg[att.uid] ?? []), { n: power(st, b), from: b }]; lines.push(`${pdef(st, b).name} deals ${power(st, b)} damage to ${pdef(st, att).name}.`); }
  }
  if (!lines.length) return st;
  if (firstStrikeOnly) st = log(st, "First strike damage happens first.");
  for (const l of lines) st = log(st, l);
  for (const [uid, hits] of Object.entries(dmg)) for (const h of hits) st = damageCreature(st, uid, h.n, h.from);
  for (const hit of toPlayers) {
    st = damagePlayer(st, hit.seat, hit.n, hit.from);
    if (hit.from.isCommander) {
      const pl = player(st, hit.seat); const total = (pl.commanderDamage[hit.from.card] ?? 0) + hit.n;
      st = setPlayer(st, hit.seat, { commanderDamage: { ...pl.commanderDamage, [hit.from.card]: total } });
      st = log(st, `Commander damage from ${pdef(st, hit.from).name} to ${hit.seat === st.human ? "you" : nameOf(st, hit.seat)}: ${total} of 21.`);
    }
    if (st.monarch === hit.seat && hit.from.controller !== hit.seat) { st = { ...st, monarch: hit.from.controller }; st = log(st, `${nameOf(st, hit.from.controller)} ${verb(st, hit.from.controller, "take", "takes")} the monarchy from ${nameOf(st, hit.seat)}.`); }
    st = fire(st, "combatDamageToPlayer", { perm: hit.from, seat: hit.from.controller, defender: hit.seat });
  }
  return checkState(st);
}

export function dealDamage(s: CState): CState {
  let st: CState = { ...s, step: "damage", pendingBlocker: null };
  st = combatDamage(st, true);
  if (st.winner) return st;
  st = combatDamage(st, false);
  if (st.winner) return st;
  return { ...st, step: "main2", attackers: {}, blocksDone: [] };
}

/* ------------------------------------------------------------------ the human's reducer */

const human = (s: CState) => s.human;

function startTargeting(s: CState, source: PendingSource, cardName: string, effects: Effect[] | undefined, colors: string, sourceUid: string | null): CState {
  const specs = targetSpecs(effects);
  if (!specs.length) return s;
  const first = specs[0]!;
  const cands = candidates(s, first.spec, human(s), sourceUid, colors);
  if (!cands.length && !first.optional) return refuse(s, `${cardName} needs ${describeSpec(first.spec)}, and there isn't one right now.`);
  return { ...s, pending: { source, cardName, specs: specs.map((x) => x.spec), chosen: [], candidates: cands, max: first.max, optional: first.optional } };
}

export function describeSpec(spec: string): string {
  switch (spec) {
    case "creature": case "creatureOptional": return "a creature to target";
    case "creatureYou": case "otherCreatureYou": case "upToTwoOtherCreaturesYou": return "one of your creatures to target";
    case "upToThreeOtherCreatures": return "up to three other creatures";
    case "creatureYouChosen": return "one of your creatures of the chosen type";
    case "otherAttackingCreatureYou": return "another attacking creature of yours";
    case "creatureOpp": return "an opponent's creature to target";
    case "creatureCombat": return "an attacking or blocking creature";
    case "creatureTapped": return "a tapped creature";
    case "flyer": return "a creature with flying";
    case "any": return "a creature or a player to target";
    case "player": return "a player to target";
    case "opponent": return "an opponent to target";
    case "enchantment": return "an enchantment to target";
    case "artifactOrEnchantment": return "an artifact or enchantment to target";
    case "artifactEnchantmentOrFlyer": return "an artifact, an enchantment or a flying creature";
    case "artifactEnchantmentOrBigCreature": return "an artifact, an enchantment or a creature with power 4 or more";
    case "creatureOrEnchantment": return "a creature or enchantment to target";
    case "nonlandPermanent": case "nonlandPermanentOpp": return "a nonland permanent to target";
    case "permanent": case "otherPermanentYou": return "a permanent to target";
    case "land": return "a land to target";
    case "spell": return "a spell on the stack to counter";
    case "creatureSpell": return "a creature spell on the stack";
    case "noncreatureSpell": return "a noncreature spell on the stack";
    default: return "a target";
  }
}

function finishTargeting(s: CState, pend: Pending): CState {
  const st: CState = { ...s, pending: null };
  const me = human(st);
  const targets = pend.chosen;
  if (pend.source.kind === "ability") {
    const r = activateFor(st, me, pend.source.uid, pend.source.index, targets);
    return r ?? refuse(st, `${pend.cardName} can't be activated right now.`);
  }
  const r = castFor(st, me, pend.source, targets, pend.modes?.picked);
  return r ?? refuse(st, `You can't pay for ${pend.cardName} right now.`);
}

export function reduce(state: CState, action: Action): CState {
  const s: CState = { ...state, refusal: null };
  const me = human(s);
  if (s.winner) return refuse(s, "This game is over.");
  if (player(s, me).out) return refuse(s, "You're out of this game. Watch how it ends, or start a new one.");
  const myTurn = s.turn === me;

  if (s.pending) {
    const pend = s.pending;
    if (action.type === "cancelTarget") return log({ ...s, pending: null }, `You put ${pend.cardName} back.`);
    if (pend.modes && pend.modes.picked.length < pend.modes.n) {
      if (action.type !== "chooseMode") return refuse(s, `Choose ${pend.modes.n === 1 ? "a mode" : `${pend.modes.n} modes`} for ${pend.cardName} first, or cancel it.`);
      if (action.index < 0 || action.index >= pend.modes.texts.length || pend.modes.picked.includes(action.index)) return refuse(s, "That isn't one of the modes.");
      const picked = [...pend.modes.picked, action.index];
      if (picked.length < pend.modes.n) return { ...s, pending: { ...pend, modes: { ...pend.modes, picked } } };
      const d = sourceDef(s, pend.source);
      const modal = d.abilities.find((a) => a.kind === "modal");
      const effects = picked.flatMap((i) => modal?.choices?.[i] ?? []);
      const next = startTargeting({ ...s, pending: null }, pend.source, pend.cardName, effects, d.colors, null);
      if (next.refusal) return next;
      if (next.pending) return { ...next, pending: { ...next.pending, modes: { ...pend.modes, picked } } };
      return castFor({ ...s, pending: null }, me, pend.source as { kind: "hand"; uid: string }, [], picked) ?? refuse(s, `You can't pay for ${pend.cardName} right now.`);
    }
    if (action.type === "chooseTarget") {
      if (!pend.candidates.some((c) => JSON.stringify(c) === JSON.stringify(action.target))) return refuse(s, `${pend.cardName} can't target that.`);
      if (pend.chosen.some((c) => JSON.stringify(c) === JSON.stringify(action.target))) return refuse(s, "You've already chosen that target.");
      const chosen = [...pend.chosen, action.target];
      const idx = chosen.length - 1;
      const specs = targetSpecs(abilityEffects(s, pend.source));
      // Still room in this spec (up to two targets)? Keep collecting; otherwise move to the next spec or cast.
      const spec = specs[Math.min(idx, specs.length - 1)];
      const takenForSpec = chosen.length - specs.slice(0, specs.indexOf(spec!)).reduce((n, x) => n + x.max, 0);
      if (spec && spec.max > 1 && takenForSpec < spec.max) return { ...s, pending: { ...pend, chosen, candidates: pend.candidates.filter((c) => !chosen.some((x) => JSON.stringify(x) === JSON.stringify(c))) } };
      const nextSpecIndex = specs.findIndex((_, i) => specs.slice(0, i + 1).reduce((n, x) => n + x.max, 0) > chosen.length);
      if (nextSpecIndex === -1) return finishTargeting(s, { ...pend, chosen });
      const next = specs[nextSpecIndex]!;
      const d = sourceDef(s, pend.source);
      const cands = candidates(s, next.spec, me, pend.source.kind === "ability" ? pend.source.uid : null, d.colors).filter((c) => !chosen.some((x) => JSON.stringify(x) === JSON.stringify(c)));
      if (!cands.length && !next.optional) return refuse({ ...s, pending: null }, `${pend.cardName} also needs ${describeSpec(next.spec)}, and there isn't one.`);
      return { ...s, pending: { ...pend, chosen, candidates: cands, max: next.max, optional: next.optional } };
    }
    if (action.type === "doneTargets") {
      if (!pend.optional && pend.chosen.length === 0) return refuse(s, `${pend.cardName} needs ${describeSpec(pend.specs[0] ?? "")}.`);
      return finishTargeting(s, pend);
    }
    return refuse(s, `Finish choosing targets for ${pend.cardName} first, or cancel it.`);
  }

  switch (action.type) {
    case "playLand": {
      const card = s.cards[action.uid];
      if (!card || !player(s, me).hand.includes(action.uid)) return refuse(s, "That card isn't in your hand.");
      if (def(s, card).kind !== "land") return refuse(s, `${def(s, card).name} isn't a land. Cast it instead.`);
      if (!canPlayLand(s, me)) return refuse(s, player(s, me).landsPlayed >= 1 && myTurn && isMain(s) ? "You've already played a land this turn." : "You can only play a land in your own main phase, with nothing on the stack.");
      return playLandFor(s, me, action.uid);
    }
    case "cast": {
      const card = s.cards[action.uid];
      if (!card || !player(s, me).hand.includes(action.uid)) return refuse(s, "That card isn't in your hand.");
      const d = def(s, card);
      if (d.kind === "land") return refuse(s, `${d.name} is a land: play it, don't cast it.`);
      const sorcerySpeed = d.kind !== "instant" && !hasFlash(d);
      if (sorcerySpeed && !(myTurn && isMain(s) && !s.stack.length)) return refuse(s, `${d.name} can only be cast in your own main phase, when nothing is on the stack.`);
      if (!canAffordFor(s, me, costAfterReductions(s, me, d, d.cost), d)) return refuse(s, `You don't have enough mana for ${d.name} (it costs {${d.cost}}).`);
      const modal = d.abilities.find((a) => a.kind === "modal");
      if (modal) {
        const texts = d.text.split("\n").filter((l) => l.startsWith("•")).map((l) => l.replace(/^•\s*/, ""));
        return { ...s, pending: { source: { kind: "hand", uid: action.uid }, cardName: d.name, specs: [], chosen: [], candidates: [], max: 1, optional: false, modes: { texts, n: modal.n ?? 1, picked: [] } } };
      }
      const effects = isAura(d) ? [{ op: "attach", target: "creature" }] : d.abilities.find((a) => a.kind === "spell")?.effects;
      const pend = startTargeting(s, { kind: "hand", uid: action.uid }, d.name, effects, d.colors, null);
      if (pend.refusal || pend.pending) return pend;
      return castFor(s, me, { kind: "hand", uid: action.uid }, []) ?? refuse(s, `You can't pay for ${d.name} right now.`);
    }
    case "castAlt": {
      const card = s.cards[action.uid];
      if (!card || !player(s, me).hand.includes(action.uid)) return refuse(s, "That card isn't in your hand.");
      const d = def(s, card);
      if (!d.abilities.some((a) => a.kind === "altCost")) return refuse(s, `${d.name} has no other way to pay for it.`);
      if (!(myTurn && isMain(s) && !s.stack.length)) return refuse(s, `${d.name} can only be cast in your own main phase, when nothing is on the stack.`);
      return castFor(s, me, { kind: "hand", uid: action.uid }, [], undefined, true) ?? refuse(s, `You can't pay ${d.name}'s other cost right now: it needs the mana and enough untapped flying creatures.`);
    }
    case "embalm": {
      const r = embalmFor(s, me, action.card);
      return r ?? refuse(s, "You can't embalm that right now: it must be in your graveyard, in your main phase, and you need the mana.");
    }
    case "cycle": {
      const card = s.cards[action.uid];
      if (!card || !player(s, me).hand.includes(action.uid)) return refuse(s, "That card isn't in your hand.");
      const d = def(s, card);
      const cy = d.abilities.find((a) => a.kind === "cycling");
      if (!cy) return refuse(s, `${d.name} doesn't have cycling.`);
      const paid = pay(s, me, typeof cy.cost === "string" ? cy.cost : "");
      if (!paid) return refuse(s, `Cycling ${d.name} costs {${cy.cost}}. You don't have the mana.`);
      let st = setPlayer(paid, me, { hand: player(paid, me).hand.filter((u) => u !== action.uid), graveyard: [...player(paid, me).graveyard, card] });
      st = log(st, `You cycle ${d.name}: discard it and draw a card.`);
      return checkState(drawCards(st, me, 1));
    }
    case "castCommander": {
      const cz = player(s, me).commandZone;
      if (!cz.inZone) return refuse(s, "Your commander isn't in the command zone right now.");
      if (!(myTurn && isMain(s) && !s.stack.length)) return refuse(s, "Your commander is a creature: cast it in your own main phase, when nothing is on the stack.");
      const cost = commanderCost(s, me) ?? "";
      if (!canAfford(s, me, cost)) return refuse(s, `Your commander costs {${cost}} right now${cz.casts ? ` (that includes ${2 * cz.casts} commander tax)` : ""}. You need more mana.`);
      return castFor(s, me, { kind: "commander" }, []) ?? refuse(s, "You can't pay for your commander right now.");
    }
    case "activate": {
      const p = find(s, action.uid);
      if (!p || p.controller !== me) return refuse(s, "That isn't one of your permanents.");
      const a = pdef(s, p).abilities[action.index];
      if (!a || !canActivate(s, me, p, a)) return refuse(s, `${pdef(s, p).name} can't do that right now.`);
      const effects = a.kind === "equip" ? [{ op: "attach", target: "creatureYou" }] : a.effects;
      const pend = startTargeting(s, { kind: "ability", uid: p.uid, index: action.index }, pdef(s, p).name, effects, pdef(s, p).colors, p.uid);
      if (pend.refusal || pend.pending) return pend;
      return activateFor(s, me, p.uid, action.index, []) ?? refuse(s, `${pdef(s, p).name} can't do that right now.`);
    }
    case "pass": {
      if (!s.stack.length) return refuse(s, "Nothing is waiting on the stack.");
      return resolveTop(s);
    }
    case "goToCombat": {
      if (!myTurn || s.step !== "main1") return refuse(s, "Combat comes after your first main phase.");
      if (s.stack.length) return refuse(s, "Let the stack resolve first.");
      let st: CState = { ...s, step: "attackers", selectedAttackers: [], attackers: {} };
      st = fire(st, "beginCombat", { seat: me });
      return checkState(st);
    }
    case "skipCombat": {
      if (!myTurn || (s.step !== "main1" && s.step !== "attackers")) return refuse(s, "There's no combat to skip right now.");
      return { ...s, step: "main2", selectedAttackers: [], attackers: {} };
    }
    case "toggleAttacker": {
      if (!myTurn || s.step !== "attackers") return refuse(s, "You choose attackers in your attack step.");
      const p = find(s, action.uid);
      if (!p || p.controller !== me) return refuse(s, "That isn't your creature.");
      if (s.attackers[p.uid]) { const { [p.uid]: _, ...rest } = s.attackers; void _; return { ...s, attackers: rest }; }
      if (s.selectedAttackers.includes(p.uid)) return { ...s, selectedAttackers: s.selectedAttackers.filter((u) => u !== p.uid) };
      if (!canAttack(s, p)) return refuse(s, p.tapped ? `${pdef(s, p).name} is tapped, so it can't attack.` : p.summoningSick ? `${pdef(s, p).name} arrived this turn. It can attack from your next turn (unless it has haste).` : has(s, p, "Defender") ? `${pdef(s, p).name} has defender: it can't attack.` : `${pdef(s, p).name} can't attack right now.`);
      return { ...s, selectedAttackers: [...s.selectedAttackers, p.uid] };
    }
    case "attackPlayer": {
      if (!myTurn || s.step !== "attackers") return refuse(s, "You choose who to attack in your attack step.");
      if (action.seat === me || player(s, action.seat).out) return refuse(s, "You can only attack an opponent who is still in the game.");
      if (!s.selectedAttackers.length) return refuse(s, "Tap the creatures that should attack first, then choose who they attack.");
      const attackers = { ...s.attackers };
      for (const uid of s.selectedAttackers) attackers[uid] = { defender: action.seat, blockers: [] };
      return { ...s, attackers, selectedAttackers: [] };
    }
    case "declareAttackers": {
      if (!myTurn || s.step !== "attackers") return refuse(s, "It isn't your attack step.");
      const map: Record<string, Seat> = {};
      for (const [uid, a] of Object.entries(s.attackers)) map[uid] = a.defender;
      // Creatures that must attack join the attack against the biggest threat.
      const must = s.battlefield.filter((p) => p.controller === me && canAttack(s, p) && p.bonus.mustAttack && !map[p.uid]);
      if (must.length) { const t = [...opponentsOf(s, me)].sort((a, b) => threat(s, b) - threat(s, a))[0]!; for (const p of must) map[p.uid] = t; }
      if (!Object.keys(map).length) return { ...s, step: "main2", attackers: {}, selectedAttackers: [] };
      return attackWith(s, map);
    }
    case "pickBlocker": {
      if (s.step !== "blockers" || myTurn || s.blocksDone.includes(me)) return refuse(s, "You choose blockers when someone attacks you.");
      const p = find(s, action.uid);
      if (!p || p.controller !== me) return refuse(s, "That isn't your creature.");
      if (s.pendingBlocker === p.uid) return { ...s, pendingBlocker: null };
      const blocking = Object.entries(s.attackers).find(([, a]) => a.blockers.includes(p.uid));
      if (blocking) return { ...s, attackers: { ...s.attackers, [blocking[0]]: { ...blocking[1], blockers: blocking[1].blockers.filter((b) => b !== p.uid) } } };
      if (p.tapped) return refuse(s, `${pdef(s, p).name} is tapped, so it can't block.`);
      if (p.bonus.cantBlock || p.cantBlockEOT || p.bonus.pacified) return refuse(s, `${pdef(s, p).name} can't block.`);
      return { ...s, pendingBlocker: p.uid };
    }
    case "assignBlock": {
      if (s.step !== "blockers" || myTurn) return refuse(s, "You choose blockers when someone attacks you.");
      const b = s.pendingBlocker ? find(s, s.pendingBlocker) : undefined;
      if (!b) return refuse(s, "Tap one of your creatures first, then the attacker it should block.");
      const a = s.attackers[action.attackerUid]; const att = find(s, action.attackerUid);
      if (!a || !att) return refuse(s, "That creature isn't attacking.");
      if (a.defender !== me) return refuse(s, `${pdef(s, att).name} is attacking ${nameOf(s, a.defender)}, not you. You can only block attackers coming at you.`);
      if (!canBlock(s, b, att)) return refuse(s, has(s, att, "Flying") ? `${pdef(s, att).name} has flying: only a creature with flying or reach can block it.` : att.bonus.evasion === "power2" ? `${pdef(s, att).name} can't be blocked by creatures with power 2 or less.` : `${pdef(s, b).name} can't block ${pdef(s, att).name}.`);
      if (att.bonus.evasion === "one" && a.blockers.length) return refuse(s, `${pdef(s, att).name} can't be blocked by more than one creature.`);
      return { ...s, pendingBlocker: null, attackers: { ...s.attackers, [action.attackerUid]: { ...a, blockers: [...a.blockers, b.uid] } } };
    }
    case "declareBlockers": {
      if (s.step !== "blockers") return refuse(s, "It isn't the block step.");
      if (myTurn) return refuse(s, "Your opponents choose their blocks; you continue to damage.");
      if (s.blocksDone.includes(me)) return refuse(s, "You've already declared your blocks.");
      const illegal = blocksLegal(s, s.attackers);
      if (illegal) return refuse(s, illegal);
      const blocks: Record<string, string[]> = {};
      for (const [uid, a] of Object.entries(s.attackers)) if (a.defender === me) blocks[uid] = a.blockers;
      return blockWith({ ...s, pendingBlocker: null }, me, blocks);
    }
    case "dealDamage": {
      if (s.step !== "blockers" && s.step !== "damage") return refuse(s, "There's no combat damage to deal right now.");
      if (!allBlocksIn(s)) return refuse(s, "Not everyone has declared blocks yet.");
      return dealDamage(s);
    }
    case "endTurn": {
      if (!myTurn) return refuse(s, "It isn't your turn.");
      if (s.stack.length) return refuse(s, "Let the stack resolve first.");
      if (s.step === "attackers" || s.step === "blockers" || s.step === "damage") return refuse(s, "Finish combat first.");
      return endTurnFor(s, me);
    }
    default: return s;
  }
}

function sourceDef(s: CState, src: PendingSource): CDef {
  if (src.kind === "hand") return def(s, s.cards[src.uid] ?? "");
  if (src.kind === "commander") return def(s, player(s, s.human).commandZone.card);
  return def(s, find(s, src.uid)?.card ?? "");
}
function abilityEffects(s: CState, src: PendingSource): Effect[] | undefined {
  const d = sourceDef(s, src);
  if (src.kind === "ability") { const a = d.abilities[src.index]; return a?.kind === "equip" ? [{ op: "attach", target: "creatureYou" }] : a?.effects; }
  if (isAura(d)) return [{ op: "attach", target: "creature" }];
  const modal = d.abilities.find((a) => a.kind === "modal");
  if (modal && s.pending?.modes) return s.pending.modes.picked.flatMap((i) => modal.choices?.[i] ?? []);
  return d.abilities.find((a) => a.kind === "spell")?.effects;
}

/** Hand cards the human could cast right now (timing and mana), for the view and the coach. */
export function castable(s: CState, seat: Seat): string[] {
  const pl = player(s, seat);
  return pl.hand.filter((uid) => {
    const d = def(s, s.cards[uid] ?? "");
    if (d.kind === "land") return canPlayLand(s, seat);
    const sorcerySpeed = d.kind !== "instant" && !hasFlash(d);
    if (sorcerySpeed && !(s.turn === seat && isMain(s) && !s.stack.length)) return false;
    if (!canAffordFor(s, seat, costAfterReductions(s, seat, d, d.cost), d)) return false;
    const modal = d.abilities.find((a) => a.kind === "modal");
    if (modal) return (modal.choices ?? []).some((effects) => targetSpecs(effects).every((sp) => sp.optional || candidates(s, sp.spec, seat, null, d.colors, d.id).length > 0));
    const effects = isAura(d) ? [{ op: "attach", target: "creature" }] : d.abilities.find((a) => a.kind === "spell")?.effects;
    const specs = targetSpecs(effects);
    return specs.every((sp) => sp.optional || candidates(s, sp.spec, seat, null, d.colors, d.id).length > 0);
  });
}
/** Embalm (CR 702.128): from your graveyard, pay the cost and exile the card to make a white Zombie token copy of it. */
export function embalmFor(s: CState, seat: Seat, card: string): CState | null {
  const pl = player(s, seat);
  const d = def(s, card);
  const em = d.abilities.find((a) => a.kind === "embalm");
  if (!em || !pl.graveyard.includes(card)) return null;
  if (!(s.turn === seat && isMain(s) && !s.stack.length)) return null;
  const paid = pay(s, seat, typeof em.cost === "string" ? em.cost : "", d);
  if (!paid) return null;
  const idx = pl.graveyard.lastIndexOf(card);
  let st = setPlayer(paid, seat, { graveyard: pl.graveyard.filter((_, i) => i !== idx), exile: [...pl.exile, card] });
  const tokenId = `token:embalm:${card}`;
  if (!st.tokens[tokenId]) {
    const copy: CDef = { ...d, id: tokenId, name: d.name, token: true, cost: "", colors: "W", type: d.type.replace(/^(Legendary )?Creature —/, "Token Creature — Zombie"), abilities: d.abilities.filter((a) => a.kind !== "embalm") };
    st = { ...st, tokens: { ...st.tokens, [tokenId]: copy } };
  }
  st = log(st, `${nameOf(st, seat)} embalm${verb(st, seat, "", "s")} ${d.name}: it is exiled and a white Zombie token copy enters.`);
  return enter(st, tokenId, seat, { isToken: true });
}
/** Graveyard cards with embalm the player can pay for right now. */
export function embalmable(s: CState, seat: Seat): string[] {
  if (!(s.turn === seat && isMain(s) && !s.stack.length)) return [];
  return [...new Set(player(s, seat).graveyard)].filter((c) => { const em = def(s, c).abilities.find((a) => a.kind === "embalm"); return !!em && canAfford(s, seat, typeof em.cost === "string" ? em.cost : ""); });
}
/** Hand cards whose alternative cost can be paid right now. */
export function altCastable(s: CState, seat: Seat): string[] {
  if (!(s.turn === seat && isMain(s) && !s.stack.length)) return [];
  return player(s, seat).hand.filter((uid) => { const d = def(s, s.cards[uid] ?? ""); const alt = d.abilities.find((a) => a.kind === "altCost"); if (!alt) return false; const tappers = s.battlefield.filter((x) => x.controller === seat && isCreature(s, x) && !x.tapped && has(s, x, alt.tapCreatures?.keyword ?? "Flying")).length; return tappers >= (alt.tapCreatures?.n ?? 0) && canAfford(s, seat, alt.mana ?? ""); });
}
/** Hand cards with cycling the player can pay for. */
export function cyclable(s: CState, seat: Seat): string[] {
  return player(s, seat).hand.filter((uid) => { const d = def(s, s.cards[uid] ?? ""); const cy = d.abilities.find((a) => a.kind === "cycling"); return !!cy && canAfford(s, seat, typeof cy.cost === "string" ? cy.cost : ""); });
}

/** Builds a fresh game. Decks are card id lists (100 cards, the commander separate). */
export function newGame(opts: { seats: { id: Seat; name: string; human: boolean; commander: string; deck: string[] }[]; seed: number }): CState {
  let s: CState = {
    seats: opts.seats.map((x) => x.id), players: {}, human: opts.seats.find((x) => x.human)?.id ?? opts.seats[0]!.id, turn: opts.seats[0]!.id, step: "main1", turnNumber: 0,
    battlefield: [], stack: [], cards: {}, tokens: {}, attackers: {}, selectedAttackers: [], pendingBlocker: null, blocksDone: [], pending: null, creatureDiedThisTurn: false,
    log: [], refusal: null, winner: null, seed: opts.seed || 1, uidCounter: 0,
  };
  for (const seat of opts.seats) {
    const [n, lib] = shuffleIn(s, seat.deck);
    s = n;
    s = { ...s, players: { ...s.players, [seat.id]: { id: seat.id, name: seat.name, human: seat.human, life: 40, hand: [], library: lib, graveyard: [], exile: [], pool: {}, landsPlayed: 0, commandZone: { card: seat.commander, casts: 0, inZone: true }, commanderDamage: {}, out: false, gainedLifeThisTurn: false, lostLifeThisTurn: false, attackedThisTurn: false } } };
  }
  s = log(s, `A four-player Commander game. ${opts.seats.map((x) => `${x.human ? "You" : x.name}: ${def(s, x.commander).name}`).join(". ")}.`);
  s = log(s, "Everyone starts at 40 life. Commanders wait in the command zone. Each player draws seven cards.");
  for (const seat of opts.seats) s = drawCards(s, seat.id, 7);
  return s;
}
