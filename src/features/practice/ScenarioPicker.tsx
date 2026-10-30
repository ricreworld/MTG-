// The list of guided scenarios, with a checkmark on the ones the learner has completed.
import { forwardRef } from "react";
import { Icon } from "../../components/Icon";
import { SCENARIOS } from "../../game/scenarios";

interface Props {
  completed: readonly string[];
  onPick: (id: string) => void;
  onPlayGame: () => void;
  onPlayCommander: () => void;
  onLibrary: () => void;
  onBack: () => void;
}

export const ScenarioPicker = forwardRef<HTMLHeadingElement, Props>(function ScenarioPicker({ completed, onPick, onPlayGame, onPlayCommander, onLibrary, onBack }, headingRef) {
  return (
    <section aria-labelledby="scenarios-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s4">
      <div className="flex flex-wrap items-center justify-between gap-s3">
        <h2 id="scenarios-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Practice Table</h2>
        <button type="button" onClick={onBack} className="inline-flex min-h-tap items-center gap-s2 rounded-md border-2 border-border-strong bg-surface px-s3 font-bold"><Icon name="back" /> Lessons</button>
      </div>
      <p>Short, guided practice with real Foundations cards. Each scenario has a goal, a Hint button and Undo. You can't lose here: a mistake just gets a hint.</p>
      <ol className="grid gap-s2">
        {SCENARIOS.map((sc, i) => {
          const done = completed.includes(sc.id);
          return (
            <li key={sc.id}>
              <button type="button" onClick={() => onPick(sc.id)} className="grid min-h-tap w-full grid-cols-[auto_1fr_auto] items-center gap-s3 rounded-md border-2 border-border-strong bg-surface px-s3 py-s2 text-left hover:bg-surface-2 active:bg-surface-2">
                <span className="font-mono text-text-muted">{i + 1}</span>
                <span><span className="font-bold">{sc.title}</span><span className="block text-sm text-text-muted">{sc.teaches}</span></span>
                {done && <span className="inline-flex items-center gap-s1 text-sm text-success"><Icon name="check" size={1} /> Done</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="grid gap-s2 rounded-md border-2 border-accent bg-accent-soft p-s3">
        <p className="font-bold">Ready for a whole game?</p>
        <p className="text-sm">Pick a deck and play the computer. The coach suggests a move each step and explains why, and you can undo anything.</p>
        <div className="flex flex-wrap gap-s2">
          <button type="button" onClick={onPlayGame} className="inline-flex min-h-tap items-center gap-s2 rounded-md bg-accent px-s4 font-bold text-accent-ink"><Icon name="play" /> Play a game</button>
          <button type="button" onClick={onPlayCommander} className="inline-flex min-h-tap items-center gap-s2 rounded-md border-2 border-accent bg-surface px-s4 font-bold"><Icon name="play" /> Play Commander</button>
        </div>
        <p className="text-sm">Commander: 40 life, your commander in the command zone, commander tax and commander damage, against one opponent.</p>
      </div>
      <div className="grid gap-s2 rounded-md border border-border bg-surface-2 p-s3">
        <p className="font-bold">Curious about the other cards?</p>
        <p className="text-sm">Browse every card in the Foundations set, with its official text and picture.</p>
        <div><button type="button" onClick={onLibrary} className="inline-flex min-h-tap items-center gap-s2 rounded-md border-2 border-border-strong bg-surface px-s4 font-bold"><Icon name="book" /> Card library</button></div>
      </div>
    </section>
  );
});
