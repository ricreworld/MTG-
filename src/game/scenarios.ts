// Guided Practice Table scenarios. Each teaches one thing, has a goal, hints, and a way to check success.
// Scenarios are pure data + pure functions over GameState, so they're testable without the UI.
import {
  def,
  has,
  makeState,
  opponentAttacks,
  opponentCasts,
  power,
  reduce,
  toughness,
  type Action,
  type GameState,
} from "./engine";

export interface Scenario {
  id: string;
  title: string;
  /** What the learner is practising, in one line. */
  teaches: string;
  /** The goal shown at the top of the table. */
  goal: string;
  /** Hints, from gentle to specific. The Hint button steps through them. */
  hints: string[];
  /** Which lesson to read if stuck: module id. */
  readMore: string;
  setup: () => GameState;
  /** True when the learner has reached the goal. */
  isComplete: (s: GameState) => boolean;
  /** Runs the scripted opponent after the learner's action, if the scenario needs one. */
  opponent?: (before: GameState, after: GameState, action: Action) => GameState;
  /** When the learner attacks: which of the opponent's creatures block which attackers. Default: no blocks. */
  opponentBlocks?: (s: GameState) => Record<string, string>;
  /** A coaching note when a legal action is a weaker choice. Returns null when the move is fine. */
  coach?: (before: GameState, after: GameState, action: Action) => string | null;
  /** Free play: what the coach suggests before the next decision, and why. */
  advise?: (s: GameState) => { move: string; why: string } | null;
  /** This scenario teaches mana itself, so the table never pays it automatically here. */
  manualMana?: boolean;
}

const bf = (s: GameState, card: string, owner: "you" | "opp" = "you") => s.battlefield.find((p) => p.card === card && p.owner === owner);

export const SCENARIOS: Scenario[] = [
  {
    id: "play-a-land",
    title: "Play a land",
    teaches: "Lands are free, one per turn, in your main phase.",
    goal: "Play the Forest from your hand.",
    hints: ["Lands don't cost anything. You play them instead of casting them.", "Tap the Forest card in your hand, then choose Play this land."],
    readMore: "mana-and-lands",
    setup: () => makeState({ you: { hand: ["forest", "cub"] } }),
    isComplete: (s) => !!bf(s, "forest"),
  },
  {
    id: "cast-a-creature",
    title: "Tap mana and cast a creature",
    teaches: "Tap lands for mana, then pay a creature's cost.",
    goal: "Cast Bear Cub. It costs {1}{G}: one green mana and one of any colour.",
    hints: [
      "Mana comes from tapping lands. Tap a land on the battlefield to add its mana to your pool.",
      "You need two mana in your pool, and at least one must be green. Tap both lands, then cast the Cub.",
      "Tap Forest, tap Mountain, then tap Bear Cub in your hand and choose Cast.",
    ],
    readMore: "mana-and-lands",
    manualMana: true,
    setup: () => makeState({ you: { hand: ["cub"], battlefield: ["forest", "mountain"] } }),
    isComplete: (s) => !!bf(s, "cub"),
  },
  {
    id: "attack",
    title: "Attack",
    teaches: "Only creatures you've controlled since your turn began can attack (unless they have Haste).",
    goal: "Attack your opponent with every creature that's allowed to attack.",
    hints: [
      "Thornweald Archer arrived this turn, so it has summoning sickness. Brazen Scourge has Haste, so it doesn't care.",
      "Go to combat, then tap Bear Cub and Brazen Scourge to choose them. Then choose Attack.",
    ],
    readMore: "combat",
    setup: () => makeState({ you: { battlefield: ["cub", { card: "scourge", sick: true }, { card: "archer", sick: true }] }, opp: { life: 20 } }),
    isComplete: (s) => s.opp.life <= 15,
    coach: (before, after, action) => {
      if (action.type === "declareAttackers" && before.selectedAttackers.length === 1) {
        return "That works, but you could attack with Brazen Scourge too. Haste means it can attack the turn it arrives. Undo if you'd like to send both.";
      }
      if (action.type === "declareAttackers" && before.selectedAttackers.length === 0) return "You chose not to attack. Your opponent has no creatures, so attacking is safe. Undo and try sending some attackers.";
      void after;
      return null;
    },
  },
  {
    id: "block",
    title: "Block",
    teaches: "Choose blocks where your creature survives, or trades well. Flying needs Flying or Reach.",
    goal: "Your opponent attacks with Highborn Vampire (4/3) and Leonin Skyhunter (2/2, Flying). Block both so you take no damage.",
    hints: [
      "Compare power and toughness: your Magnigoth Sentry (4/4) survives the Skyhunter (2/2) and destroys it. Bear Cub (2/2) would die to the Vampire for nothing.",
      "Leonin Skyhunter has Flying. Only creatures with Flying or Reach can block it: your Sentry and your Archer both have Reach.",
      "Thornweald Archer has Deathtouch: any damage it deals destroys the Vampire, even though the Archer dies too. That's a fair trade.",
      "Tap Magnigoth Sentry, then tap Leonin Skyhunter. Tap Thornweald Archer, then tap Highborn Vampire. Then choose Confirm blocks.",
    ],
    readMore: "combat",
    setup: () => {
      let s = makeState({ turn: "opp", you: { battlefield: ["sentry", "archer", "cub"] }, opp: { battlefield: ["vampire", "skyhunter"] } });
      s = opponentAttacks(s, [bf(s, "vampire", "opp")!.uid, bf(s, "skyhunter", "opp")!.uid]);
      return s;
    },
    isComplete: (s) => s.step === "main2" && s.you.life === 20,
    coach: (before, _after, action) => {
      if (action.type !== "declareBlockers") return null;
      const blocks = Object.entries(before.attackers);
      // A block that loses a creature for nothing is the most useful thing to point out first.
      for (const [a, b] of blocks) {
        if (!b) continue;
        const attacker = before.battlefield.find((p) => p.uid === a)!;
        const blocker = before.battlefield.find((p) => p.uid === b)!;
        if (power(attacker) >= toughness(blocker) && power(blocker) < toughness(attacker) && !has(blocker, "Deathtouch")) {
          return `${def(blocker.card).name} would be destroyed by ${def(attacker.card).name} without destroying it. Undo and try a stronger blocker.`;
        }
      }
      const unblocked = blocks.filter(([, b]) => !b).map(([a]) => def(before.battlefield.find((p) => p.uid === a)!.card).name);
      if (unblocked.length) return `${unblocked.join(" and ")} would get through and hurt you. Undo and block with a creature that's allowed to.`;
      return null;
    },
  },
  {
    id: "respond",
    title: "Respond with an instant",
    teaches: "Spells wait on the stack. You can respond before they resolve.",
    goal: "Your opponent cast Stab at your Bear Cub. Counter it with Negate before it resolves.",
    hints: [
      "Stab is on the stack, waiting. If you pass, it resolves: the Cub gets -2/-2 and is destroyed.",
      "Negate costs {1}{U}. Your two Islands can pay for it.",
      "Tap Negate in your hand and choose Cast in response. It goes on top of the stack and happens first, so Stab is countered.",
    ],
    readMore: "the-stack",
    setup: () => {
      let s = makeState({ you: { hand: ["negate"], battlefield: ["island", "island", "cub"] } });
      s = opponentCasts(s, "stab", { kind: "permanent", uid: bf(s, "cub")!.uid });
      return s;
    },
    isComplete: (s) => s.stack.length === 0 && !!bf(s, "cub") && s.log.some((l) => /countered/.test(l)),
    coach: (before, _after, action) => {
      if (action.type === "pass" && before.stack.length === 1 && before.stack[0]?.caster === "opp") {
        return "If you pass now, Stab resolves and your Bear Cub is destroyed. Undo, tap your Islands and cast Negate in response.";
      }
      return null;
    },
  },
];

export const scenarioById = (id: string): Scenario | undefined => SCENARIOS.find((s) => s.id === id);

/** Applies a learner action plus any scripted opponent reaction. */
export function step(scenario: Scenario, state: GameState, action: Action): GameState {
  let after = reduce(state, action);
  if (after.refusal) return after;
  // Scripted scenarios (no computer opponent) have no combat tricks, so blocks lead straight to damage.
  if (!scenario.opponent && action.type === "declareBlockers" && after.step === "damage" && !after.stack.length) after = reduce(after, { type: "dealDamage" });
  if (action.type === "declareAttackers" && after.turn === "you" && after.step === "blockers") {
    // The scripted opponent chooses its blocks now, so the learner can see them before damage.
    const blocks = scenario.opponentBlocks?.(after) ?? {};
    const attackers = { ...after.attackers };
    for (const [a, b] of Object.entries(blocks)) if (attackers[a] !== undefined) attackers[a] = b;
    const named = Object.entries(blocks).map(([a, b]) => `${def(after.battlefield.find((p) => p.uid === b)?.card ?? "")?.name} blocks ${def(after.battlefield.find((p) => p.uid === a)?.card ?? "")?.name}`);
    after = { ...after, attackers, log: [...after.log, named.length ? `Your opponent blocks: ${named.join("; ")}.` : "Your opponent has no blocks."] };
  }
  return scenario.opponent ? scenario.opponent(state, after, action) : after;
}
