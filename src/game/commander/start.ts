// Builds a fresh four-player game: your deck, then the other three decks for Mara, Theo and Ines, clockwise.
import { ALL_DECKS, FULL_DECKS } from "./decks";
import { newGame, type CState } from "./engine";

export const COMPUTER_NAMES = ["Mara", "Theo", "Ines"];

export function startFourPlayer(yourDeckId: string, seed: number, custom?: { commander: string; cards: string[] }): CState {
  const yours = custom ?? (ALL_DECKS.find((d) => d.id === yourDeckId) ?? ALL_DECKS[0]!);
  // Opponents come from the same group as your deck: starter decks against a starter deck, full-pool decks otherwise.
  const picked = ALL_DECKS.find((d) => d.id === yourDeckId);
  const group = picked && picked.pool === "starter" ? ALL_DECKS.filter((d) => d.pool === "starter") : FULL_DECKS;
  const rest = group.filter((d) => d.id !== yourDeckId).slice(0, 3);
  return newGame({
    seed,
    seats: [
      { id: "you", name: "You", human: true, commander: yours.commander, deck: yours.cards },
      ...rest.map((d, i) => ({ id: `cpu${i + 1}`, name: COMPUTER_NAMES[i]!, human: false, commander: d.commander, deck: d.cards })),
    ],
  });
}
