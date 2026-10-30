// Free play: a full game against the computer, packaged as a Scenario so the Practice Table can run it.
import { chooseBlocks, maybeCounter, runOpponent } from "./ai";
import { advise, critique } from "./coach";
import { deckById, deckList, rng, shuffle, type Deck } from "./decks";
import { beginTurn, drawCards, makeState, type Action, type GameState } from "./engine";
import type { Scenario } from "./scenarios";

export interface MatchSetup {
  yourDeck: string;
  oppDeck: string;
  seed: number;
}

export const FREE_PLAY_ID = "free-play";

/** Shuffles both decks, deals seven cards each and starts the learner's first turn (no draw on turn 1). */
export function startMatch(you: Deck, opp: Deck, seed: number): GameState {
  const random = rng(seed);
  let s = makeState({ turnNumber: 0, you: { library: shuffle(deckList(you), random) }, opp: { library: shuffle(deckList(opp), random) } });
  s = drawCards(s, "you", 7);
  s = drawCards(s, "opp", 7);
  s = { ...s, log: [`You play ${you.name}. Your opponent plays ${opp.name}.`, "Each player draws seven cards."] };
  s = beginTurn(s, "you");
  return s;
}

/** Runs the computer after each learner action. */
export function afterLearnerAction(before: GameState, after: GameState, action: Action): GameState {
  let s = after;
  if (s.result) return s;
  if (action.type === "endTurn" && s.turn === "you" && s.step === "end") s = beginTurn(s, "opp");
  if ((action.type === "cast" || action.type === "chooseTarget") && s.stack.length && s.stack[s.stack.length - 1]?.caster === "you") s = maybeCounter(s);
  void before;
  return runOpponent(s);
}

export function makeMatch(setup: MatchSetup): Scenario {
  const you = deckById(setup.yourDeck);
  const opp = deckById(setup.oppDeck);
  if (!you || !opp) throw new Error("Unknown deck");
  return {
    id: FREE_PLAY_ID,
    title: `${you.name} vs ${opp.name}`,
    teaches: "A whole game, with the coach beside you.",
    goal: "Bring your opponent's life from 20 to 0. The coach suggests a move each step and explains why. Undo any move.",
    hints: [
      "Each turn: play a land, cast what you can afford, attack when it's safe, then end your turn.",
      "Before attacking, ask: can one of their untapped creatures block mine, destroy it, and survive? If yes, keep it home.",
      "Before blocking, ask the same question the other way round. Taking a little damage is often better than losing a creature.",
      "Keep an instant's mana untapped if you want to respond on their turn.",
    ],
    readMore: "the-turn",
    setup: () => startMatch(you, opp, setup.seed),
    isComplete: (s) => s.result === "win",
    opponent: afterLearnerAction,
    opponentBlocks: chooseBlocks,
    coach: critique,
    advise,
  };
}
