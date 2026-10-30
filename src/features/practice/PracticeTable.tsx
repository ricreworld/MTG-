// The Practice Table: a calm, turn-based sandbox driven by the pure engine in src/game.
// Designed around one question: "what do I tap next?"
//   - A sticky bar at the bottom always shows the one thing to do now, one big button, Undo and Hint.
//   - Feedback (hints, coach notes, what the computer did) appears right above that bar.
//   - Cards that can be used right now carry a visible prompt ("Can cast", "Can attack", "Can block").
//   - With "do the fiddly bits" on (default), tapping a card pays its mana and your spells resolve on their own.
// Every learner action goes through one place (act): refused -> hint; legal but weak -> coach note + Undo.
import { forwardRef, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { CARDS, type CardDef } from "../../game/cards";
import { canAttack, canBlock, canPay, commanderCost, def, tapLandsFor, type Action, type GameState, type Permanent, type Step } from "../../game/engine";
import { step as applyStep, type Scenario } from "../../game/scenarios";
import { useSettings } from "../../theme/SettingsContext";
import { GameCard } from "./GameCard";

const PHASES: { step: Step; label: string }[] = [
  { step: "main1", label: "Main 1" }, { step: "attackers", label: "Attack" }, { step: "blockers", label: "Block" }, { step: "main2", label: "Main 2" }, { step: "end", label: "End" },
];

interface Props {
  scenario: Scenario;
  exitLabel?: string | undefined;
  onComplete: () => void;
  onExit: () => void;
  onReadMore: (moduleId: string) => void;
}

interface Note { kind: "hint" | "coach" | "done" | "opp"; text: string; lines?: string[] }

export const PracticeTable = forwardRef<HTMLHeadingElement, Props>(function PracticeTable({ scenario, exitLabel, onComplete, onExit, onReadMore }, headingRef) {
  const { settings } = useSettings();
  const [history, setHistory] = useState<GameState[]>(() => [scenario.setup()]);
  const [note, setNote] = useState<Note | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [handPick, setHandPick] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const state = history[history.length - 1]!;
  const complete = useMemo(() => scenario.isComplete(state), [scenario, state]);
  const freePlay = !!scenario.advise;
  const commander = state.mode === "commander";
  const autoMana = settings.autoPlay && !scenario.manualMana;
  const autoResolve = settings.autoPlay;
  const advice = useMemo(() => (scenario.advise ? scenario.advise(state) : null), [scenario, state]);
  if (complete && !celebrated) { setCelebrated(true); setNote({ kind: "done", text: freePlay ? "You won the game. Well played!" : "Goal reached. Nice work!" }); onComplete(); }

  /** Runs one learner action (optionally from a prepared state), then auto-resolves the learner's own spells. */
  const act = (action: Action, from: GameState = state) => {
    if (complete) return;
    const before = state;
    let next = applyStep(scenario, from, action);
    setHandPick(null);
    if (next.refusal) { setNote({ kind: "hint", text: next.refusal }); return; }
    const coachNote = scenario.coach?.(before, next, action) ?? null;
    // Your own spell on top of the stack with no response from the computer: let it happen.
    let guard = 0;
    while (autoResolve && !next.result && next.stack.length && next.stack[next.stack.length - 1]?.caster === "you" && guard++ < 5) {
      const resolved = applyStep(scenario, next, { type: "pass" });
      if (resolved.refusal) break;
      next = resolved;
    }
    setHistory((h) => [...h, next]);
    // What the computer did since the learner's action, in plain lines.
    const fresh = next.log.slice(before.log.length).filter((l) => /^Your opponent|^Commander damage|^Blocks:|resolves and enters the battlefield on your opponent's side|^\(Why:/.test(l));
    const oppActed = next.turn === "you" && (action.type === "endTurn" || action.type === "pass" || action.type === "declareBlockers" || action.type === "dealDamage") && fresh.length > 0;
    if (coachNote) setNote({ kind: "coach", text: coachNote });
    else if (oppActed) setNote({ kind: "opp", text: "While you waited, your opponent:", lines: fresh.map((l) => l.replace(/^Your opponent /, "").replace(/^\(Why: (.*)\)$/, "Why: $1")) });
    else setNote(null);
  };
  const undo = () => { if (history.length > 1) { setHistory((h) => h.slice(0, -1)); setNote(null); setHandPick(null); } };
  const restart = () => { setHistory([scenario.setup()]); setNote(null); setHintIndex(0); setHandPick(null); setCelebrated(false); };
  const showHint = () => { setNote({ kind: "hint", text: scenario.hints[Math.min(hintIndex, scenario.hints.length - 1)] ?? "" }); setHintIndex((i) => Math.min(i + 1, scenario.hints.length - 1)); };

  /** Casts a card from hand, paying its mana first when the table does that for you. */
  const castFromHand = (uid: string) => {
    const card = def(state.cards[uid] ?? "");
    if (card.kind === "land") return act({ type: "playLand", uid });
    if (autoMana && card.cost && !canPay(state.you.pool, card.cost)) {
      const paid = tapLandsFor(state, "you", card.cost);
      if (paid) return act({ type: "cast", uid }, paid);
    }
    return act({ type: "cast", uid });
  };
  const castCommander = () => {
    const cost = commanderCost(state, "you") ?? "";
    if (autoMana && !canPay(state.you.pool, cost)) {
      const paid = tapLandsFor(state, "you", cost);
      if (paid) return act({ type: "castCommander" }, paid);
    }
    return act({ type: "castCommander" });
  };

  const mine = state.battlefield.filter((p) => p.owner === "you");
  const theirs = state.battlefield.filter((p) => p.owner === "opp");
  const lands = (list: Permanent[]) => list.filter((p) => def(p.card).kind === "land");
  const creatures = (list: Permanent[]) => list.filter((p) => def(p.card).kind === "creature");
  const myTurn = state.turn === "you";
  const targeting = state.pendingTarget ? def(state.cards[state.pendingTarget] ?? "") : null;
  const stackTop = state.stack[state.stack.length - 1];
  const oppSpellWaiting = !!stackTop && stackTop.caster === "opp";
  const canAfford = (cost: string | undefined) => !cost || canPay(autoMana ? availablePool() : state.you.pool, cost);
  function availablePool() { const pool = { ...state.you.pool }; for (const p of lands(mine)) if (!p.tapped) pool[def(p.card).color] = (pool[def(p.card).color] ?? 0) + 1; return pool; }
  const mainPhase = myTurn && (state.step === "main1" || state.step === "main2") && !state.stack.length;
  const canCastNow = (card: CardDef): boolean => {
    if (card.kind === "land") return mainPhase && !state.you.landPlayedThisTurn;
    if (card.kind === "creature") return mainPhase && canAfford(card.cost);
    if (card.effect === "counter" || card.effect === "counterNoncreature") return oppSpellWaiting && canAfford(card.cost) && !(card.effect === "counterNoncreature" && def(stackTop!.card).kind === "creature");
    return canAfford(card.cost) && state.battlefield.some((p) => def(p.card).kind === "creature") && (mainPhase || oppSpellWaiting || state.step === "blockers" || state.step === "damage");
  };

  // What tapping a permanent means right now.
  const permAction = (p: Permanent): { label: string; action: Action; prompt?: string } | null => {
    const card = def(p.card);
    if (targeting && card.kind === "creature") return { label: `Choose as the target of ${targeting.name}`, action: { type: "chooseTarget", target: { kind: "permanent", uid: p.uid } }, prompt: "Target" };
    if (p.owner === "you") {
      if (card.kind === "land" && !p.tapped && state.step !== "attackers" && state.step !== "blockers") return { label: "Tap for mana", action: { type: "tapForMana", uid: p.uid } };
      if (card.kind === "creature" && state.step === "attackers" && myTurn) {
        const chosen = state.selectedAttackers.includes(p.uid);
        return { label: chosen ? "Remove from attackers" : "Choose as an attacker", action: { type: "toggleAttacker", uid: p.uid }, ...(canAttack(p, state) && !chosen ? { prompt: "Can attack" } : {}) };
      }
      if (card.kind === "creature" && state.step === "blockers" && !myTurn) {
        const blocking = Object.values(state.attackers).includes(p.uid);
        return { label: state.pendingBlocker === p.uid ? "Unselect blocker" : blocking ? "Remove this block" : "Choose as a blocker", action: { type: "pickBlocker", uid: p.uid }, ...(!p.tapped && !blocking && state.pendingBlocker !== p.uid ? { prompt: "Can block" } : {}) };
      }
    } else if (state.step === "blockers" && !myTurn && state.attackers[p.uid] !== undefined && state.pendingBlocker) {
      const blocker = state.battlefield.find((x) => x.uid === state.pendingBlocker);
      return { label: "Block this attacker", action: { type: "assignBlock", attackerUid: p.uid }, ...(blocker && canBlock(blocker, p) && !state.attackers[p.uid] ? { prompt: "Tap to block it" } : {}) };
    }
    return null;
  };
  const explain = (p: Permanent): { label: string; action: () => void } => {
    const card = def(p.card);
    const say = (text: string) => () => setNote({ kind: "hint", text });
    if (p.owner === "you" && card.kind === "land") return { label: p.tapped ? "Already tapped" : "Tap for mana", action: () => act({ type: "tapForMana", uid: p.uid }) };
    if (p.owner === "you") return { label: "About this card", action: say(state.step === "blockers" && myTurn ? `${card.name} is attacking. Tap Continue to see the damage.` : `${card.name} acts in combat: tap Go to combat to attack with it, or block with it when your opponent attacks.`) };
    if (targeting) return { label: "About this card", action: say(`${targeting.name} can't target ${card.name}: it isn't a creature.`) };
    return { label: "About this card", action: say(`${card.name} belongs to your opponent. You can block it when it attacks, or target it with a spell like Stab.`) };
  };
  const tapOf = (p: Permanent): { label: string; onClick: () => void; prompt?: string | undefined } => {
    const a = permAction(p);
    if (a) return { label: a.label, onClick: () => act(a.action), prompt: a.prompt };
    const e = explain(p);
    return { label: e.label, onClick: e.action };
  };
  const nameOnTable = (uid: string | null | undefined): string | null => { const p = uid ? state.battlefield.find((x) => x.uid === uid) : undefined; return p ? def(p.card).name : null; };
  const inCombat = state.step === "blockers" || state.step === "damage";
  const permBadge = (p: Permanent): string | undefined => {
    if (state.attackers[p.uid] !== undefined && inCombat) { const b = nameOnTable(state.attackers[p.uid]); return b ? `Attacking · blocked by ${b}` : "Attacking"; }
    const blocks = inCombat ? Object.entries(state.attackers).find(([, b]) => b === p.uid) : undefined;
    if (blocks) { const a = nameOnTable(blocks[0]); return a ? `Blocks ${a}` : "Blocking"; }
    if (state.selectedAttackers.includes(p.uid)) return "Attacking";
    if (state.pendingBlocker === p.uid) return "Chosen to block";
    if (p.summoningSick && def(p.card).kind === "creature" && !def(p.card).keywords?.includes("Haste")) return p.isCommander ? "Commander · arrived this turn" : "Arrived this turn";
    return p.isCommander ? "Commander" : undefined;
  };
  const handCardDef = (uid: string): CardDef => def(state.cards[uid] ?? "");
  const targetLabel = (t: GameState["stack"][number]["target"]): string => {
    if (!t) return "";
    if (t.kind === "player") return ` → ${t.player === "you" ? "you" : "your opponent"}`;
    const uid = t.uid;
    const name = t.kind === "permanent" ? state.battlefield.find((p) => p.uid === uid)?.card : state.stack.find((x) => x.uid === uid)?.card;
    return ` → ${name ? def(name).name : t.kind === "permanent" ? "a creature" : "a spell"}`;
  };
  const cmdDamageText = (d: Record<string, number> | undefined) => { const entries = Object.entries(d ?? {}); return entries.length ? entries.map(([card, n]) => `${n} of 21 from ${def(card).name}`).join("; ") : "none yet"; };

  /** The one thing to do now: a plain sentence and the main button. */
  const now = ((): { text: string; button: string; action: Action | (() => void); secondary?: { label: string; action: Action } } => {
    if (state.result === "lose") return { text: "This game is over. Undo a few moves to try a different line, or play again.", button: "Play again", action: restart };
    if (complete) return { text: freePlay ? "You won. Play again, or leave the game." : "Goal reached. Go back to the list to pick the next scenario.", button: freePlay ? "Play again" : exitLabel ?? "All scenarios", action: freePlay ? restart : onExit };
    if (targeting) return { text: `Tap a creature to be the target of ${targeting.name}, or cancel.`, button: `Cancel ${targeting.name}`, action: { type: "cancelTarget" } };
    if (stackTop && stackTop.caster === "opp") {
      const counters = state.you.hand.map(handCardDef).filter((c) => canCastNow(c) && (c.effect === "counter" || c.effect === "counterNoncreature"));
      return { text: `Your opponent cast ${def(stackTop.card).name}${targetLabel(stackTop.target).replace(" → ", ", aimed at ")}. ${counters.length ? `You can counter it with ${counters[0]!.name} from your hand, or let it happen.` : "You can respond with an instant from your hand, or let it happen."}`, button: `Let ${def(stackTop.card).name} happen`, action: { type: "pass" } };
    }
    if (stackTop) return { text: `${def(stackTop.card).name} is waiting on the stack. Continue to let it happen.`, button: "Continue", action: { type: "pass" } };
    if (myTurn && state.step === "main1") {
      const land = state.you.hand.map(handCardDef).find((c) => c.kind === "land");
      const ready = creatures(mine).filter((p) => canAttack(p, state));
      const parts: string[] = [];
      if (land && !state.you.landPlayedThisTurn) parts.push("play a land");
      if (state.you.hand.some((u) => handCardDef(u).kind !== "land" && canCastNow(handCardDef(u)))) parts.push("cast a card from your hand");
      if (commander && commanderCost(state, "you") && canAfford(commanderCost(state, "you") ?? "")) parts.push("cast your commander");
      const todo = parts.length ? `You can ${parts.join(", ")}. ` : "";
      if (ready.length) return { text: `${todo}When you're ready, go to combat to attack.`, button: "Go to combat", action: { type: "goToCombat" }, secondary: { label: "Skip combat", action: { type: "skipCombat" } } };
      return { text: `${todo}No creature of yours can attack this turn, so end the turn when you're done.`, button: "End turn", action: () => { const after = applyStep(scenario, state, { type: "skipCombat" }); act({ type: "endTurn" }, after.refusal ? state : after); } };
    }
    if (myTurn && state.step === "attackers") {
      const ready = creatures(mine).filter((p) => canAttack(p, state));
      const n = state.selectedAttackers.length;
      return { text: ready.length ? `Tap the creatures that should attack (${n} chosen), then attack.` : "None of your creatures can attack right now.", button: n ? `Attack with ${n}` : "Don't attack", action: { type: "declareAttackers" } };
    }
    if (!myTurn && state.step === "blockers") {
      const blocks = Object.values(state.attackers).filter(Boolean).length;
      return { text: state.pendingBlocker ? "Now tap the attacker it should block." : `Your opponent is attacking. Tap one of your creatures, then tap the attacker it should block (${blocks} block${blocks === 1 ? "" : "s"} set). Or take the damage.`, button: blocks ? `Confirm ${blocks} block${blocks === 1 ? "" : "s"}` : "No blocks, take the damage", action: { type: "declareBlockers" } };
    }
    if (myTurn && state.step === "blockers") return { text: "Your opponent's blocks are shown on the cards. Continue to see the damage.", button: "Continue to damage", action: { type: "declareBlockers" } };
    if (state.step === "damage") return { text: "Combat damage happens now.", button: "Continue", action: { type: "dealDamage" } };
    if (myTurn && state.step === "main2") {
      const canStill = state.you.hand.some((u) => canCastNow(handCardDef(u)));
      return { text: canStill ? "You can still play a land or cast a card. Then end your turn." : "Nothing left to do. End your turn.", button: "End turn", action: { type: "endTurn" } };
    }
    return { text: "Your opponent is taking their turn.", button: "Continue", action: { type: "pass" } };
  })();

  const btn = "inline-flex min-h-tap items-center justify-center gap-s2 rounded-md px-s3 font-bold";
  const primary = `${btn} bg-accent text-accent-ink`;
  const secondary = `${btn} border-2 border-border-strong bg-surface`;
  const run = (a: Action | (() => void)) => (typeof a === "function" ? a() : act(a));

  return (
    <section aria-labelledby="practice-heading" className="grid gap-s3 pb-[11rem]">
      {/* Title row: compact, with the goal one tap away */}
      <div className="grid gap-s2 rounded-lg border border-border bg-surface p-s3">
        <div className="flex flex-wrap items-center justify-between gap-s2">
          <h2 id="practice-heading" ref={headingRef} tabIndex={-1} className="text-lg font-bold">{scenario.title}</h2>
          <button type="button" onClick={onExit} className={secondary}><Icon name="back" /> {exitLabel ?? "All scenarios"}</button>
        </div>
        <details open={!freePlay}>
          <summary className="min-h-tap cursor-pointer content-center text-sm font-bold">Goal</summary>
          <p className="text-sm">{scenario.goal}</p>
        </details>
        <ol className="flex flex-wrap gap-s1" aria-label="Turn phases">
          {PHASES.map((ph) => {
            const current = ph.step === state.step || (state.step === "damage" && ph.step === "blockers");
            return <li key={ph.step} aria-current={current ? "step" : undefined} className={`rounded-sm px-s2 py-s1 text-sm ${current ? "bg-accent font-bold text-accent-ink" : "bg-surface-2 text-text-muted"}`}>{current ? "▸ " : ""}{ph.label}</li>;
          })}
          <li className="ml-auto self-center text-sm text-text-muted">{myTurn ? "Your turn" : "Opponent's turn"}</li>
        </ol>
      </div>

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
        <div className="flex flex-wrap gap-s2">
          {creatures(theirs).length === 0 && <p className="text-sm text-text-muted">No creatures.</p>}
          {creatures(theirs).map((p) => { const t = tapOf(p); return <GameCard key={p.uid} card={def(p.card)} perm={p} badge={permBadge(p)} action={t.label} onClick={t.onClick} highlight={t.prompt} />; })}
        </div>
        <div className="flex flex-wrap gap-s2">{lands(theirs).map((p) => { const t = tapOf(p); return <GameCard key={p.uid} card={def(p.card)} perm={p} size="sm" action={t.label} onClick={t.onClick} />; })}</div>
      </div>

      {/* The stack, only when something is waiting */}
      {state.stack.length > 0 && (
        <div className="grid gap-s1 rounded-lg border-2 border-dashed border-accent p-s3">
          <p className="font-bold">On the stack <span className="text-sm font-normal text-text-muted">(top happens first)</span></p>
          <ol className="grid gap-s1">
            {[...state.stack].reverse().map((item, i) => (
              <li key={item.uid} className="text-sm">{i === 0 ? "▸ " : ""}{item.caster === "you" ? "Your" : "Opponent's"} <strong>{def(item.card).name}</strong>{targetLabel(item.target)}</li>
            ))}
          </ol>
        </div>
      )}

      {/* You */}
      <div className="grid gap-s2 rounded-lg border border-border bg-surface p-s3">
        <p className="flex flex-wrap items-center gap-s3 font-bold">You <span className="rounded-sm bg-surface-2 px-s2 font-mono">Life {state.you.life}</span>
          {freePlay && <span className="text-sm font-normal text-text-muted">Library: {state.you.library.length}</span>}
          {commander && <span className="text-sm font-normal text-text-muted">Commander damage taken: {cmdDamageText(state.you.commanderDamage)}</span>}
        </p>
        <div className="flex flex-wrap gap-s2">
          {creatures(mine).length === 0 && <p className="text-sm text-text-muted">No creatures on the battlefield.</p>}
          {creatures(mine).map((p) => { const t = tapOf(p); return <GameCard key={p.uid} card={def(p.card)} perm={p} badge={permBadge(p)} selected={state.selectedAttackers.includes(p.uid) || state.pendingBlocker === p.uid} action={t.label} onClick={t.onClick} highlight={t.prompt} />; })}
        </div>
        <div className="flex flex-wrap items-end gap-s2">
          {lands(mine).length === 0 && <p className="text-sm text-text-muted">No lands yet.</p>}
          {lands(mine).map((p) => { const t = tapOf(p); return <GameCard key={p.uid} card={def(p.card)} perm={p} size="sm" action={t.label} onClick={t.onClick} />; })}
          {(!autoMana || Object.values(state.you.pool).some(Boolean)) && (
            <p className="text-sm text-text-muted">Mana pool: {Object.entries(state.you.pool).filter(([, n]) => n).map(([c, n]) => `${n} ${c === "W" ? "white" : c === "U" ? "blue" : c === "B" ? "black" : c === "R" ? "red" : "green"}`).join(", ") || "empty"}</p>
          )}
        </div>
        {commander && state.you.commandZone && (
          <div className="flex flex-wrap items-start gap-s3 rounded-md border border-dashed border-border-strong p-s2">
            <span className="text-sm font-bold">Your command zone:</span>
            {state.you.commandZone.inZone ? (() => {
              const cz = state.you.commandZone; const cost = commanderCost(state, "you") ?? ""; const ok = mainPhase && canAfford(cost);
              return <>
                <GameCard card={def(cz.card)} size="sm" badge={cz.casts ? `Tax +${2 * cz.casts}` : undefined} highlight={ok ? "Can cast" : undefined} action={`Cast commander for ${cost}`} onClick={castCommander} />
                <span className="grid gap-s1 text-sm"><span>Costs <strong>{cost}</strong> now{cz.casts ? ` (${2 * cz.casts} of it is commander tax)` : ""}.</span><button type="button" onClick={castCommander} className={ok ? primary : secondary}>Cast commander</button></span>
              </>;
            })() : <span className="text-sm text-text-muted">{def(state.you.commandZone.card).name} is on the battlefield. If it's destroyed, it comes back here.</span>}
          </div>
        )}
      </div>

      {/* Hand: tapping a card plays it (lands) or casts it (spells), with mana paid for you */}
      <div className="grid gap-s2 rounded-lg border border-border bg-surface p-s3">
        <p className="font-bold">Your hand <span className="text-sm font-normal text-text-muted">({state.you.hand.length} card{state.you.hand.length === 1 ? "" : "s"})</span>
          {autoMana && <span className="block text-sm font-normal text-text-muted">Tap a card to play it. Mana is paid for you.</span>}
        </p>
        <div className="flex flex-wrap gap-s2">
          {state.you.hand.length === 0 && <p className="text-sm text-text-muted">Your hand is empty.</p>}
          {state.you.hand.map((uid) => {
            const card = handCardDef(uid);
            const can = canCastNow(card);
            const verb = card.kind === "land" ? "Play" : (card.effect === "counter" || card.effect === "counterNoncreature") && oppSpellWaiting ? "Counter with" : "Cast";
            return <GameCard key={uid} card={card} selected={handPick === uid} highlight={can ? (card.kind === "land" ? "Can play" : "Can cast") : undefined} action={autoMana ? (can ? `${verb} ${card.name}` : "Open options") : "Open options"} onClick={() => (autoMana && can ? castFromHand(uid) : setHandPick(handPick === uid ? null : uid))} />;
          })}
        </div>
        {handPick && state.you.hand.includes(handPick) && (() => {
          const card = handCardDef(handPick);
          const can = canCastNow(card);
          return (
            <div className="grid gap-s2 rounded-md bg-surface-2 p-s2" role="group" aria-label={`Options for ${card.name}`}>
              <span className="text-sm"><strong>{card.name}</strong>{card.text ? `: ${card.text.replace(/\n/g, " ")}` : ""}</span>
              {!can && <span className="text-sm text-text-muted">{card.kind === "land" ? (state.you.landPlayedThisTurn ? "You've already played a land this turn." : "Lands are played in your main phase.") : card.kind === "creature" ? (mainPhase ? `You need ${card.cost} of mana. Play more lands first.` : "Creatures are cast in your main phase, when nothing is on the stack.") : "This instant has nothing useful to do right now."}</span>}
              <div className="flex flex-wrap gap-s2">
                <button type="button" onClick={() => castFromHand(handPick)} className={can ? primary : secondary}>{card.kind === "land" ? "Play this land" : `Cast ${card.name}${card.cost ? ` (${card.cost})` : ""}`}</button>
                <button type="button" onClick={() => setHandPick(null)} className={secondary}>Close</button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tools and the log */}
      <div className="flex flex-wrap gap-s2">
        <button type="button" onClick={restart} className={secondary}>Restart</button>
        <button type="button" onClick={() => onReadMore(scenario.readMore)} className={secondary}><Icon name="book" /> Read the lesson</button>
      </div>
      <details className="rounded-lg border border-border bg-surface p-s3">
        <summary className="min-h-tap cursor-pointer content-center font-bold">Full game log</summary>
        <ol className="mt-s2 grid gap-s1 text-sm">{state.log.filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}</ol>
      </details>
      <p className="text-sm text-text-muted">
        The {Object.keys(CARDS).length} cards on this table are real Foundations cards with their official rules text and art. © Wizards of the Coast LLC, used under the Fan Content Policy. Data via Scryfall.
      </p>

      {/* The sticky "what now" bar: feedback, the one instruction, the one button */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg/95 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-s2 [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid max-w-[64rem] gap-s2">
          {note && (
            <div role="status" className={`grid gap-s1 rounded-md p-s2 text-sm ${note.kind === "done" ? "bg-success-soft" : note.kind === "opp" ? "bg-surface-2" : "bg-hint-soft"}`}>
              <p className="flex items-start gap-s2"><span className={note.kind === "done" ? "text-success" : "text-hint"}><Icon name={note.kind === "done" ? "check" : "info"} size={1.1} /></span><span>{note.text}</span></p>
              {note.lines && <ul className="grid gap-[2px] pl-s5">{note.lines.slice(0, 6).map((l, i) => <li key={i}>{l}</li>)}</ul>}
              {note.kind === "coach" && history.length > 1 && <div><button type="button" onClick={undo} className={`${secondary} min-h-[2.25rem]`}>Undo that move</button></div>}
            </div>
          )}
          {freePlay && advice && !complete && !state.result && (
            <p className="text-sm"><strong>Coach:</strong> {advice.move} <button type="button" onClick={() => setShowWhy((v) => !v)} aria-expanded={showWhy} className="underline">{showWhy ? "Hide why" : "Why?"}</button>{showWhy && <span className="block text-text-muted">{advice.why}</span>}</p>
          )}
          <p className="text-sm"><strong>Now:</strong> {now.text}</p>
          <div className="grid grid-cols-[auto_auto_1fr] gap-s2">
            <button type="button" onClick={undo} disabled={history.length <= 1} className={`${secondary} disabled:opacity-50`}><Icon name="back" /> Undo</button>
            <button type="button" onClick={showHint} className={secondary}><Icon name="info" /> Hint</button>
            <button type="button" onClick={() => run(now.action)} className={primary}>{now.button} <Icon name="next" /></button>
          </div>
          {now.secondary && <div><button type="button" onClick={() => act(now.secondary!.action)} className="text-sm underline">{now.secondary.label}</button></div>}
        </div>
      </div>
    </section>
  );
});
