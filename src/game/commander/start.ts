// Builds a fresh four-player game: your deck, then the other three decks for Mara, Theo and Ines, clockwise.
import { CDECKS } from "./decks";
import { newGame, type CState } from "./engine";

export const COMPUTER_NAMES = ["Mara", "Theo", "Ines"];

export function startFourPlayer(yourDeckId: string, seed: number): CState {
  const yours = CDECKS.find((d) => d.id === yourDeckId) ?? CDECKS[0]!;
  const rest = CDECKS.filter((d) => d.id !== yours.id);
  return newGame({
    seed,
    seats: [
      { id: "you", name: "You", human: true, commander: yours.commander, deck: yours.cards },
      ...rest.map((d, i) => ({ id: `cpu${i + 1}`, name: COMPUTER_NAMES[i]!, human: false, commander: d.commander, deck: d.cards })),
    ],
  });
}
