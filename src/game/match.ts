// Free play: a full game against the computer, packaged as a Scenario so the Practice Table can run it.
import { chooseBlocks, maybeCounter, runOpponent } from "./ai";
import { advise, critique } from "./coach";
import { deckById, deckList, rng, shuffle, type Deck } from "./decks";
import { CARDS } from "./cards";
import { beginTurn, drawCards, makeState, type Action, type GameState } from "./engine";
import type { Scenario } from "./scenarios";

export interface MatchSetup {
  yourDeck: string;
  oppDeck: string;
  seed: number;
  /** "commander": 40 life, commanders in the command zone, commander tax and commander damage. */
  mode?: "standard" | "commander";
}

export const FREE_PLAY_ID = "free-play";
export const COMMANDER_PLAY_ID = "commander-play";

/** Shuffles both decks, deals seven cards each and starts the learner's first turn (no draw on turn 1). */
export function startMatch(you: Deck, opp: Deck, seed: number, mode: "standard" | "commander" = "standard"): GameState {
  const random = rng(seed);
  const commander = mode === "commander";
  const life = commander ? 40 : 20;
  let s = makeState({ turnNumber: 0, you: { life, library: shuffle(deckList(you), random) }, opp: { life, library: shuffle(deckList(opp), random) } });
  if (commander) {
    s = { ...s, mode: "commander",
      you: { ...s.you, commandZone: you.commander ? { card: you.commander, casts: 0, inZone: true } : null, commanderDamage: {} },
      opp: { ...s.opp, commandZone: opp.commander ? { card: opp.commander, casts: 0, inZone: true } : null, commanderDamage: {} } };
  }
  s = drawCards(s, "you", 7);
  s = drawCards(s, "opp", 7);
  const intro = commander
    ? [`Commander game: you lead ${you.name} with ${you.commander ? CARDS[you.commander]?.name : "no commander"}. Your opponent leads ${opp.name} with ${opp.commander ? CARDS[opp.commander]?.name : "no commander"}.`, "Both players start at 40 life. Commanders wait in the command zone.", "Each player draws seven cards."]
    : [`You play ${you.name}. Your opponent plays ${opp.name}.`, "Each player draws seven cards."];
  s = { ...s, log: intro };
  s = beginTurn(s, "you");
  return s;
}

/** Runs the computer after each learner action. */
export function afterLearnerAction(before: GameState, after: GameState, action: Action): GameState {
  let s = after;
  if (s.result) return s;
  if (action.type === "endTurn" && s.turn === "you" && s.step === "end") s = beginTurn(s, "opp");
  if ((action.type === "cast" || action.type === "chooseTarget" || action.type === "castCommander") && s.stack.length && s.stack[s.stack.length - 1]?.caster === "you") s = maybeCounter(s);
  void before;
  return runOpponent(s);
}

export function makeMatch(setup: MatchSetup): Scenario {
  const you = deckById(setup.yourDeck);
  const opp = deckById(setup.oppDeck);
  if (!you || !opp) throw new Error("Unknown deck");
  const commander = setup.mode === "commander";
  return {
    id: commander ? COMMANDER_PLAY_ID : FREE_PLAY_ID,
    title: commander ? `Commander: ${you.name} vs ${opp.name}` : `${you.name} vs ${opp.name}`,
    teaches: commander ? "A Commander game against one opponent: the command zone, the tax and commander damage." : "A whole game, with the coach beside you.",
    goal: commander
      ? "Bring your opponent from 40 life to 0, or deal them 21 combat damage with your commander. Your commander waits in the command zone: cast it from there, and it comes back there when it's destroyed (costing {2} more each time)."
      : "Bring your opponent's life from 20 to 0. The coach suggests a move each step and explains why. Undo any move.",
    hints: [
      ...(commander ? ["Your commander is always available in the command zone. Cast it when you can afford it, and attack with it: 21 combat damage from one commander wins on its own.", "This is a two-player Commander game, so the first player skips their first draw. Real Commander is usually four players with 100-card decks; these short decks are for practising the commander rules."] : []),
      "Each turn: play a land, cast what you can afford, attack when it's safe, then end your turn.",
      "Before attacking, ask: can one of their untapped creatures block mine, destroy it, and survive? If yes, keep it home.",
      "Before blocking, ask the same question the other way round. Taking a little damage is often better than losing a creature.",
      "Keep an instant's mana untapped if you want to respond on their turn.",
    ],
    readMore: "the-turn",
    setup: () => startMatch(you, opp, setup.seed, setup.mode ?? "standard"),
    isComplete: (s) => s.result === "win",
    opponent: afterLearnerAction,
    opponentBlocks: chooseBlocks,
    coach: critique,
    advise,
  };
}
