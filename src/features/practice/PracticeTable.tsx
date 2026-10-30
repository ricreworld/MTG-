// The Practice Table: a calm, turn-based sandbox driven by the pure engine in src/game.
// Every learner action goes through one place (act): refused -> hint; legal but weak -> coach note + Undo;
// otherwise it just happens. There is never a game-over screen.
import { forwardRef, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { CARDS, type CardDef } from "../../game/cards";
import { canPay, commanderCost, def, type Action, type GameState, type Permanent, type Step } from "../../game/engine";
import { step as applyStep, type Scenario } from "../../game/scenarios";
import { GameCard } from "./GameCard";

const STEP_INFO: Record<Step, { name: string; allowed: string }> = {
  main1: { name: "First main phase", allowed: "You can play a land, tap lands for mana, cast creatures and instants, or go to combat." },
  attackers: { name: "Combat: declare attackers", allowed: "Tap your untapped creatures to choose attackers, then choose Attack." },
  blockers: { name: "Combat: declare blockers", allowed: "Tap one of your creatures, then tap the attacker it should block. Then confirm." },
  damage: { name: "Combat damage", allowed: "Damage is dealt." },
  main2: { name: "Second main phase", allowed: "You can play a land (if you haven't), cast spells, or end your turn." },
  end: { name: "End of turn", allowed: "The turn is over." },
};
const PHASES: Step[] = ["main1", "attackers", "blockers", "main2", "end"];

interface Props {
  scenario: Scenario;
  exitLabel?: string | undefined;
  onComplete: () => void;
  onExit: () => void;
  onReadMore: (moduleId: string) => void;
}

interface Coach { kind: "hint" | "coach" | "done"; text: string }

export const PracticeTable = forwardRef<HTMLHeadingElement, Props>(function PracticeTable({ scenario, exitLabel, onComplete, onExit, onReadMore }, headingRef) {
  const [history, setHistory] = useState<GameState[]>(() => [scenario.setup()]);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [handPick, setHandPick] = useState<string | null>(null);
  const state = history[history.length - 1]!;
  const complete = useMemo(() => scenario.isComplete(state), [scenario, state]);
  const [celebrated, setCelebrated] = useState(false);
  const [showCoach, setShowCoach] = useState(true);
  const freePlay = !!scenario.advise;
  const commander = state.mode === "commander";
  const cmdDamageText = (d: Record<string, number> | undefined) => { const entries = Object.entries(d ?? {}); return entries.length ? entries.map(([card, n]) => `${n} of 21 from ${def(card).name}`).join("; ") : "none yet"; };
  const advice = useMemo(() => (scenario.advise ? scenario.advise(state) : null), [scenario, state]);
  if (complete && !celebrated) { setCelebrated(true); setCoach({ kind: "done", text: freePlay ? "You won the game. Well played!" : "Goal reached. Nice work!" }); onComplete(); }

  const act = (action: Action) => {
    if (complete) return;
    const next = applyStep(scenario, state, action);
    setHandPick(null);
    if (next.refusal) { setCoach({ kind: "hint", text: next.refusal }); return; }
    const note = scenario.coach?.(state, next, action) ?? null;
    setHistory((h) => [...h, next]);
    setCoach(note ? { kind: "coach", text: note } : null);
  };
  const undo = () => { if (history.length > 1) { setHistory((h) => h.slice(0, -1)); setCoach(null); setHandPick(null); } };
  const restart = () => { setHistory([scenario.setup()]); setCoach(null); setHintIndex(0); setHandPick(null); setCelebrated(false); };
  const showHint = () => { setCoach({ kind: "hint", text: scenario.hints[Math.min(hintIndex, scenario.hints.length - 1)] ?? "" }); setHintIndex((i) => Math.min(i + 1, scenario.hints.length - 1)); };

  const mine = state.battlefield.filter((p) => p.owner === "you");
  const theirs = state.battlefield.filter((p) => p.owner === "opp");
  const lands = (list: Permanent[]) => list.filter((p) => def(p.card).kind === "land");
  const creatures = (list: Permanent[]) => list.filter((p) => def(p.card).kind === "creature");
  const info = state.step === "blockers" && state.turn === "you"
    ? { name: "Combat: opponent's blocks", allowed: "Your opponent has chosen their blocks (shown on the cards). Continue to see the damage." }
    : state.step === "damage"
      ? { name: "Combat damage", allowed: state.stack.length ? "A spell was cast before damage. Respond, or pass to let it resolve." : "Continue to deal combat damage." }
      : state.turn === "opp" && state.stack.length
        ? { name: STEP_INFO[state.step].name, allowed: "Your opponent cast a spell. You can respond with an instant, or pass to let it resolve." }
        : state.turn === "opp" && state.step !== "blockers"
          ? { name: STEP_INFO[state.step].name, allowed: "Your opponent is taking their turn." }
          : STEP_INFO[state.step];
  const myTurn = state.turn === "you";
  const targeting = state.pendingTarget ? def(state.cards[state.pendingTarget] ?? "") : null;

  // What tapping a permanent means right now (and whether it does anything).
  const permAction = (p: Permanent): { label: string; action: Action } | null => {
    const card = def(p.card);
    if (targeting && card.kind === "creature") return { label: `Choose as the target of ${targeting.name}`, action: { type: "chooseTarget", target: { kind: "permanent", uid: p.uid } } };
    if (p.owner === "you") {
      if (card.kind === "land" && !p.tapped && state.step !== "attackers" && state.step !== "blockers") return { label: "Tap for mana", action: { type: "tapForMana", uid: p.uid } };
      if (card.kind === "creature" && state.step === "attackers" && myTurn) return { label: state.selectedAttackers.includes(p.uid) ? "Remove from attackers" : "Choose as an attacker", action: { type: "toggleAttacker", uid: p.uid } };
      if (card.kind === "creature" && state.step === "blockers" && !myTurn) return { label: state.pendingBlocker === p.uid ? "Unselect blocker" : "Choose as a blocker", action: { type: "pickBlocker", uid: p.uid } };
    } else if (state.step === "blockers" && !myTurn && state.attackers[p.uid] !== undefined && state.pendingBlocker) {
      return { label: "Block this attacker", action: { type: "assignBlock", attackerUid: p.uid } };
    }
    return null;
  };
  // A card with nothing to do right now still answers a tap, so focus never jumps and every tap gets feedback.
  const explain = (p: Permanent): { label: string; action: () => void } => {
    const card = def(p.card);
    const say = (text: string) => () => setCoach({ kind: "hint", text });
    if (p.owner === "you" && card.kind === "land") return { label: p.tapped ? "Already tapped" : "Tap for mana", action: () => act({ type: "tapForMana", uid: p.uid }) };
    if (p.owner === "you") return { label: "About this card", action: say(state.step === "blockers" && myTurn ? `${card.name} is attacking. Continue to see the damage.` : `${card.name} acts in combat: go to combat to attack with it, or block with it when your opponent attacks.`) };
    if (targeting) return { label: "About this card", action: say(`${targeting.name} can't target ${card.name}: it isn't a creature.`) };
    return { label: "About this card", action: say(`${card.name} belongs to your opponent. You can block it when it attacks, or target it with a spell like Stab.`) };
  };
  const tapOf = (p: Permanent): { label: string; onClick: () => void } => {
    const a = permAction(p);
    if (a) return { label: a.label, onClick: () => act(a.action) };
    const e = explain(p);
    return { label: e.label, onClick: e.action };
  };
  const blockerOf = (attackerUid: string) => { const b = state.attackers[attackerUid]; return b ? def(state.battlefield.find((p) => p.uid === b)?.card ?? "").name : null; };
  const permBadge = (p: Permanent): string | undefined => {
    if (state.attackers[p.uid] !== undefined && (state.step === "blockers" || state.step === "damage")) { const b = blockerOf(p.uid); return b ? `Attacking · blocked by ${b}` : "Attacking"; }
    const blocks = Object.entries(state.attackers).find(([, b]) => b === p.uid);
    if (blocks) return `Blocks ${def(state.battlefield.find((x) => x.uid === blocks[0])?.card ?? "").name}`;
    if (state.selectedAttackers.includes(p.uid)) return "Attacking";
    if (state.pendingBlocker === p.uid) return "Chosen to block";
    if (p.summoningSick && def(p.card).kind === "creature" && !def(p.card).keywords?.includes("Haste")) return p.isCommander ? "Commander · arrived this turn" : "Arrived this turn";
    return p.isCommander ? "Commander" : undefined;
  };

  const handCardDef = (uid: string): CardDef => def(state.cards[uid] ?? "");
  const pool = Object.entries(state.you.pool).filter(([, n]) => n && n > 0);
  const targetLabel = (t: GameState["stack"][number]["target"]): string => {
    if (!t) return "";
    if (t.kind === "player") return ` → ${t.player === "you" ? "you" : "your opponent"}`;
    const uid = t.uid;
    const name = t.kind === "permanent" ? state.battlefield.find((p) => p.uid === uid)?.card : state.stack.find((x) => x.uid === uid)?.card;
    return ` → ${name ? def(name).name : t.kind === "permanent" ? "a creature" : "a spell"}`;
  };
  const stackTop = state.stack[state.stack.length - 1];
  const topText = stackTop ? `${stackTop.caster === "you" ? "Your" : "Your opponent's"} ${def(stackTop.card).name}` : null;

  const btn = "inline-flex min-h-tap items-center justify-center gap-s2 rounded-md px-s3 font-bold";
  const primary = `${btn} bg-accent text-accent-ink`;
  const secondary = `${btn} border-2 border-border-strong bg-surface`;

  return (
    <section aria-labelledby="practice-heading" className="grid gap-s4">
      <div className="grid gap-s2 rounded-lg border border-border bg-surface p-s4">
        <div className="flex flex-wrap items-center justify-between gap-s2">
          <h2 id="practice-heading" ref={headingRef} tabIndex={-1} className="text-xl font-bold">Practice: {scenario.title}</h2>
          <button type="button" onClick={onExit} className={secondary}><Icon name="back" /> {exitLabel ?? "All scenarios"}</button>
        </div>
        <p><strong>Goal:</strong> {scenario.goal}</p>
      </div>

      {/* Phase tracker: the current phase, and what's allowed, in words. */}
      <div className="grid gap-s2 rounded-lg border border-border bg-surface p-s3" aria-live="polite">
        <ol className="flex flex-wrap gap-s1" aria-label="Turn phases">
          {PHASES.map((ph) => {
            const current = ph === state.step || (state.step === "damage" && ph === "blockers");
            return (
              <li key={ph} aria-current={current ? "step" : undefined} className={`rounded-sm px-s2 py-s1 text-sm ${current ? "bg-accent font-bold text-accent-ink" : "bg-surface-2 text-text-muted"}`}>
                {current && <span aria-hidden="true">▸ </span>}{ph === "main1" ? "Main 1" : ph === "attackers" ? "Attack" : ph === "blockers" ? "Block" : ph === "main2" ? "Main 2" : "End"}
              </li>
            );
          })}
        </ol>
        <p className="text-sm"><strong>{myTurn ? "Your turn" : "Opponent's turn"} · {info.name}.</strong> {info.allowed}</p>
      </div>

      {/* Free play: the coach's suggestion before each decision */}
      {freePlay && !state.result && (
        <div className="grid gap-s2 rounded-lg border border-border bg-surface p-s3">
          <div className="flex flex-wrap items-center justify-between gap-s2">
            <p className="font-bold"><Icon name="info" /> Coach</p>
            <button type="button" onClick={() => setShowCoach((v) => !v)} aria-expanded={showCoach} className={secondary}>{showCoach ? "Hide" : "Show"}</button>
          </div>
          {showCoach && advice && (
            <div className="grid gap-s1">
              <p><strong>Suggested move:</strong> {advice.move}</p>
              <p className="text-sm"><strong>Why:</strong> {advice.why}</p>
            </div>
          )}
          {showCoach && !advice && <p className="text-sm text-text-muted">Nothing to decide right now.</p>}
        </div>
      )}
      {freePlay && state.result === "lose" && (
        <div role="status" className="grid gap-s2 rounded-lg border-2 border-border-strong bg-surface-2 p-s4">
          <p className="text-lg font-bold">This game is over.</p>
          <p>Your life reached 0, or you had no card to draw. Every Magic player loses games, including the best ones. The useful part is the next one.</p>
          <p className="text-sm">Look at the game log below to see the turn that decided it, or Undo a few moves and try a different line.</p>
          <div className="flex flex-wrap gap-s2">
            <button type="button" onClick={undo} disabled={history.length <= 1} className={`${secondary} disabled:opacity-50`}>Undo</button>
            <button type="button" onClick={restart} className={primary}>Play again</button>
          </div>
        </div>
      )}

      {/* Coach / hint area, inline, never a popup */}
      {coach && (
        <div role="status" className={`flex items-start gap-s3 rounded-md p-s3 ${coach.kind === "done" ? "bg-success-soft" : "bg-hint-soft"}`}>
          <span className={coach.kind === "done" ? "text-success" : "text-hint"}><Icon name={coach.kind === "done" ? "check" : "info"} /></span>
          <div className="grid gap-s2">
            <p>{coach.text}</p>
            {coach.kind === "coach" && history.length > 1 && (
              <div><button type="button" onClick={undo} className={secondary}>Undo that move</button></div>
            )}
          </div>
        </div>
      )}

      {/* Opponent */}
      <div className="grid gap-s2 rounded-lg border border-border bg-surface-2 p-s3">
        <p className="flex flex-wrap items-center gap-s3 font-bold">Opponent <span className="rounded-sm bg-surface px-s2 font-mono">Life {state.opp.life}</span>
          {freePlay && <span className="text-sm font-normal text-text-muted">Hand: {state.opp.hand.length} · Library: {state.opp.library.length}</span>}
          {commander && <span className="text-sm font-normal text-text-muted">Commander damage taken: {cmdDamageText(state.opp.commanderDamage)}</span>}
        </p>
        {commander && state.opp.commandZone && (
          <div className="flex flex-wrap items-center gap-s2 rounded-md border border-dashed border-border-strong p-s2">
            <span className="text-sm font-bold">Command zone:</span>
            {state.opp.commandZone.inZone
              ? <GameCard card={def(state.opp.commandZone.card)} size="sm" badge={state.opp.commandZone.casts ? `Tax: +${2 * state.opp.commandZone.casts}` : undefined} />
              : <span className="text-sm text-text-muted">{def(state.opp.commandZone.card).name} is on the battlefield.</span>}
          </div>
        )}
        <div className="flex flex-wrap gap-s2">{lands(theirs).map((p) => { const t = tapOf(p); return <GameCard key={p.uid} card={def(p.card)} perm={p} size="sm" action={t.label} onClick={t.onClick} />; })}</div>
        <div className="flex flex-wrap gap-s2">
          {creatures(theirs).length === 0 && <p className="text-sm text-text-muted">No creatures.</p>}
          {creatures(theirs).map((p) => { const t = tapOf(p); return <GameCard key={p.uid} card={def(p.card)} perm={p} badge={permBadge(p)} action={t.label} onClick={t.onClick} />; })}
        </div>
      </div>

      {/* The stack */}
      {state.stack.length > 0 && (
        <div className="grid gap-s2 rounded-lg border-2 border-dashed border-accent p-s3">
          <p className="font-bold">The stack <span className="text-sm font-normal text-text-muted">(top happens first)</span></p>
          <ol className="grid gap-s1">
            {[...state.stack].reverse().map((item, i) => (
              <li key={item.uid} className="text-sm">
                {i === 0 ? "▸ " : ""}{item.caster === "you" ? "Your" : "Opponent's"} <strong>{def(item.card).name}</strong>
                {targetLabel(item.target)}
              </li>
            ))}
          </ol>
          <div><button type="button" onClick={() => act({ type: "pass" })} className={primary}>Pass: let {topText} resolve</button></div>
        </div>
      )}

      {/* You */}
      <div className="grid gap-s2 rounded-lg border border-border bg-surface p-s3">
        <p className="flex flex-wrap items-center gap-s3 font-bold">You <span className="rounded-sm bg-surface-2 px-s2 font-mono">Life {state.you.life}</span>
          {freePlay && <span className="text-sm font-normal text-text-muted">Library: {state.you.library.length}</span>}
          {commander && <span className="text-sm font-normal text-text-muted">Commander damage taken: {cmdDamageText(state.you.commanderDamage)}</span>}
          <span className="text-sm font-normal">Mana pool: {pool.length ? pool.map(([c, n]) => `${n} ${c === "W" ? "white" : c === "U" ? "blue" : c === "B" ? "black" : c === "R" ? "red" : "green"}`).join(", ") : "empty"}</span>
        </p>
        <div className="flex flex-wrap gap-s2">
          {creatures(mine).length === 0 && <p className="text-sm text-text-muted">No creatures on the battlefield.</p>}
          {creatures(mine).map((p) => { const t = tapOf(p); return <GameCard key={p.uid} card={def(p.card)} perm={p} badge={permBadge(p)} selected={state.selectedAttackers.includes(p.uid) || state.pendingBlocker === p.uid} action={t.label} onClick={t.onClick} />; })}
        </div>
        <div className="flex flex-wrap gap-s2">
          {lands(mine).length === 0 && <p className="text-sm text-text-muted">No lands yet.</p>}
          {lands(mine).map((p) => { const t = tapOf(p); return <GameCard key={p.uid} card={def(p.card)} perm={p} size="sm" action={t.label} onClick={t.onClick} />; })}
        </div>
      </div>

      {/* Your command zone (Commander games) */}
      {commander && state.you.commandZone && (
        <div className="grid gap-s2 rounded-lg border-2 border-dashed border-border-strong bg-surface p-s3">
          <p className="font-bold">Your command zone</p>
          {state.you.commandZone.inZone ? (() => {
            const cz = state.you.commandZone;
            const cost = commanderCost(state, "you") ?? "";
            const affordable = canPay(state.you.pool, cost);
            return (
              <div className="flex flex-wrap items-start gap-s3">
                <GameCard card={def(cz.card)} badge={cz.casts ? `Cast ${cz.casts}× · tax +${2 * cz.casts}` : "Ready"} />
                <div className="grid gap-s2">
                  <p className="text-sm">Costs <strong>{cost}</strong> right now{cz.casts ? ` (${2 * cz.casts} of that is commander tax)` : ""}. Tap lands for mana, then cast it.</p>
                  <div><button type="button" onClick={() => act({ type: "castCommander" })} className={affordable ? primary : secondary}>Cast commander ({cost})</button></div>
                </div>
              </div>
            );
          })() : <p className="text-sm text-text-muted">{def(state.you.commandZone.card).name} is on the battlefield. If it's destroyed, it comes back here.</p>}
        </div>
      )}

      {/* Hand */}
      <div className="grid gap-s2 rounded-lg border border-border bg-surface p-s3">
        <p className="font-bold">Your hand <span className="text-sm font-normal text-text-muted">({state.you.hand.length} card{state.you.hand.length === 1 ? "" : "s"})</span></p>
        {targeting && (
          <div className="flex flex-wrap items-center gap-s2 rounded-md bg-accent-soft p-s2 text-sm">
            <span>Choose a target for <strong>{targeting.name}</strong>: tap a creature.</span>
            <button type="button" onClick={() => act({ type: "cancelTarget" })} className={secondary}>Cancel</button>
          </div>
        )}
        <div className="flex flex-wrap gap-s2">
          {state.you.hand.length === 0 && <p className="text-sm text-text-muted">Your hand is empty.</p>}
          {state.you.hand.map((uid) => (
            <GameCard key={uid} card={handCardDef(uid)} selected={handPick === uid} action="Open options" onClick={() => setHandPick(handPick === uid ? null : uid)} />
          ))}
        </div>
        {handPick && state.you.hand.includes(handPick) && (() => {
          const card = handCardDef(handPick);
          const affordable = card.cost ? canPay(state.you.pool, card.cost) : true;
          return (
            <div className="flex flex-wrap items-center gap-s2 rounded-md bg-surface-2 p-s2" role="group" aria-label={`Options for ${card.name}`}>
              <span className="text-sm"><strong>{card.name}</strong>{card.text ? `: ${card.text}` : ""}</span>
              {card.kind === "land"
                ? <button type="button" onClick={() => act({ type: "playLand", uid: handPick })} className={primary}>Play this land</button>
                : <button type="button" onClick={() => act({ type: "cast", uid: handPick })} className={affordable ? primary : secondary}>Cast {card.name}{card.cost ? ` (${card.cost})` : ""}</button>}
              <button type="button" onClick={() => setHandPick(null)} className={secondary}>Close</button>
            </div>
          );
        })()}
      </div>

      {/* Actions for the current step */}
      <div className="flex flex-wrap gap-s2">
        {myTurn && state.step === "main1" && !state.stack.length && <>
          <button type="button" onClick={() => act({ type: "goToCombat" })} className={primary}><Icon name="next" /> Go to combat</button>
          <button type="button" onClick={() => act({ type: "skipCombat" })} className={secondary}>Skip combat</button>
        </>}
        {myTurn && state.step === "attackers" && <button type="button" onClick={() => act({ type: "declareAttackers" })} className={primary}>{state.selectedAttackers.length ? `Attack with ${state.selectedAttackers.length}` : "Don't attack"}</button>}
        {!myTurn && state.step === "blockers" && <button type="button" onClick={() => act({ type: "declareBlockers" })} className={primary}>{Object.values(state.attackers).some(Boolean) ? "Confirm blocks" : "No blocks"}</button>}
        {myTurn && state.step === "blockers" && <button type="button" onClick={() => act({ type: "declareBlockers" })} className={primary}><Icon name="next" /> Continue to damage</button>}
        {state.step === "damage" && !state.stack.length && <button type="button" onClick={() => act({ type: "dealDamage" })} className={primary}><Icon name="next" /> Continue to damage</button>}
        {myTurn && state.step === "main2" && !state.stack.length && <button type="button" onClick={() => act({ type: "endTurn" })} className={primary}>End turn</button>}
      </div>

      {/* Table tools: always available */}
      <div className="flex flex-wrap gap-s2 border-t border-border pt-s3">
        <button type="button" onClick={showHint} className={secondary}><Icon name="info" /> Hint</button>
        <button type="button" onClick={undo} disabled={history.length <= 1} className={`${secondary} disabled:opacity-50`}>Undo</button>
        <button type="button" onClick={restart} className={secondary}>Restart</button>
        <button type="button" onClick={() => onReadMore(scenario.readMore)} className={secondary}><Icon name="book" /> Read the lesson</button>
      </div>

      <details className="rounded-lg border border-border bg-surface p-s3">
        <summary className="min-h-tap cursor-pointer content-center font-bold">What happened (game log)</summary>
        <ol className="mt-s2 grid gap-s1 text-sm">
          {state.log.filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}
        </ol>
      </details>
      <p className="text-sm text-text-muted">
        The {Object.keys(CARDS).length} cards on this table are real cards from the Magic: The Gathering set Foundations, with their official rules text and art. Card images and text are © Wizards of the Coast LLC, used under the Wizards Fan Content Policy. Card data via Scryfall.
      </p>
    </section>
  );
});
