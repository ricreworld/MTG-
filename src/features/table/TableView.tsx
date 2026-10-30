// The Practice Table view: a felt mat under a lamp, the cards, and one sticky bar that always says what to do.
// All game logic lives in TableMachine (src/table/machine.ts); this file only renders and plays cues.
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "../../components/Icon";
import { CARDS, type CardDef } from "../../game/cards";
import { canAttack, canBlock, canPay, commanderCost, def, type Action, type GameState, type Permanent, type Step } from "../../game/engine";
import type { Scenario } from "../../game/scenarios";
import { FrameMeter, installDebug } from "../../table/debug";
import { TableMachine, type Snapshot } from "../../table/machine";
import { useSettings } from "../../theme/SettingsContext";
import { GameCard } from "../practice/GameCard";
import { EffectsLayer, playBatch, type Ghost } from "./cues";
import { DebugPanel } from "./DebugPanel";

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

export const TableView = forwardRef<HTMLHeadingElement, Props>(function TableView({ scenario, exitLabel, onComplete, onExit, onReadMore }, headingRef) {
  const { settings } = useSettings();
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const motion = reducedMotion ? "off" : settings.motion;
  const autoMana = settings.autoPlay && !scenario.manualMana;

  // One machine per table; it outlives renders.
  const machine = useMemo(() => { const m = new TableMachine({ scenario, motion, sound: settings.sound, autoMana, autoResolve: settings.autoPlay }); m.start(); return m; }, [scenario]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { machine.configure({ motion, sound: settings.sound, autoMana, autoResolve: settings.autoPlay }); }, [machine, motion, settings.sound, autoMana, settings.autoPlay]);
  const snap = useSyncExternalStore((fn) => machine.subscribe(fn), () => machine.snapshot(), () => machine.snapshot());
  const { state, mode, feedback, pending } = snap as Snapshot & { state: GameState };

  const [handPick, setHandPick] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [fps, setFps] = useState<{ frames: number; worstMs: number; avgMs: number } | null>(null);
  const completedOnce = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const prevCards = useRef<Map<string, string>>(new Map());
  const effects = useMemo(() => new EffectsLayer(), []);
  const meter = useMemo(() => new FrameMeter(), []);
  const skipRef = useRef<(() => void) | null>(null);

  useEffect(() => { effects.mount(document.body); return () => effects.unmount(); }, [effects]);
  useEffect(() => installDebug(machine, () => skipRef.current?.(), meter, (l) => machine.configure({ motion: l })), [machine, meter]);

  const complete = scenario.isComplete(state);
  useEffect(() => { if (complete && !completedOnce.current) { completedOnce.current = true; onComplete(); } }, [complete, onComplete]);

  // Measure card positions after every render; when a batch is pending, play it against the DOM.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nowRects = new Map<string, DOMRect>();
    const nowCards = new Map<string, string>();
    root.querySelectorAll<HTMLElement>("[data-uid]").forEach((el) => { const uid = el.dataset.uid!; nowRects.set(uid, el.getBoundingClientRect()); nowCards.set(uid, el.dataset.card ?? ""); });
    if (pending && pending.total > 0 && !skipRef.current) {
      meter.start();
      const skip = playBatch({ root, batch: pending, motion, sound: settings.sound, prevRects: prevRects.current, nowRects, prevCards: prevCards.current, effects, setGhosts, onDone: () => { if (skipRef.current !== skip) return; skipRef.current = null; meter.stop(); setFps(meter.read()); machine.cuesDone(); } });
      skipRef.current = skip;
    }
    prevRects.current = nowRects;
    prevCards.current = nowCards;
  }, [snap, pending, motion, settings.sound, effects, machine, meter]);

  useEffect(() => () => { skipRef.current?.(); }, []);

  const busy = !!pending && pending.total > 0;
  const skipCues = () => { skipRef.current?.(); };
  // A tap while cues play skips to the end of them and then does what was tapped: no tap is ever dropped.
  const act = (a: Action) => { if (busy) skipCues(); setHandPick(null); machine.act(a); };
  const castFromHand = (uid: string) => { if (busy) skipCues(); setHandPick(null); machine.castFromHand(uid); };
  const castCommander = () => { if (busy) skipCues(); machine.castCommander(); };
  const undo = () => { skipRef.current?.(); machine.undo(); setHandPick(null); };
  const restart = () => { skipRef.current?.(); completedOnce.current = false; machine.restart(); setHandPick(null); };

  /* ---------- derived view data ---------- */
  const freePlay = !!scenario.advise;
  const commander = state.mode === "commander";
  const advice = useMemo(() => (scenario.advise ? scenario.advise(state) : null), [scenario, state]);
  const mine = state.battlefield.filter((p) => p.owner === "you");
  const theirs = state.battlefield.filter((p) => p.owner === "opp");
  const lands = (list: Permanent[]) => list.filter((p) => def(p.card).kind === "land");
  const creatures = (list: Permanent[]) => list.filter((p) => def(p.card).kind === "creature");
  const myTurn = state.turn === "you";
  const targeting = state.pendingTarget ? def(state.cards[state.pendingTarget] ?? "") : null;
  const stackTop = state.stack[state.stack.length - 1];
  const oppSpellWaiting = !!stackTop && stackTop.caster === "opp";
  const availablePool = () => { const pool = { ...state.you.pool }; for (const p of lands(mine)) if (!p.tapped) pool[def(p.card).color] = (pool[def(p.card).color] ?? 0) + 1; return pool; };
  const canAfford = (cost: string | undefined) => !cost || canPay(autoMana ? availablePool() : state.you.pool, cost);
  const mainPhase = myTurn && (state.step === "main1" || state.step === "main2") && !state.stack.length;
  const canCastNow = (card: CardDef): boolean => {
    if (card.kind === "land") return mainPhase && !state.you.landPlayedThisTurn;
    if (card.kind === "creature") return mainPhase && canAfford(card.cost);
    if (card.effect === "counter" || card.effect === "counterNoncreature") return oppSpellWaiting && canAfford(card.cost) && !(card.effect === "counterNoncreature" && def(stackTop!.card).kind === "creature");
    return canAfford(card.cost) && state.battlefield.some((p) => def(p.card).kind === "creature") && (mainPhase || oppSpellWaiting || state.step === "blockers" || state.step === "damage");
  };
  const handCardDef = (uid: string): CardDef => def(state.cards[uid] ?? "");
  const nameOnTable = (uid: string | null | undefined): string | null => { const p = uid ? state.battlefield.find((x) => x.uid === uid) : undefined; return p ? def(p.card).name : null; };
  const inCombat = state.step === "blockers" || state.step === "damage";

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
    const say = (text: string) => () => machine.say(text);
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
  const permBadge = (p: Permanent): string | undefined => {
    if (state.attackers[p.uid] !== undefined && inCombat) { const b = nameOnTable(state.attackers[p.uid]); return b ? `Attacking · blocked by ${b}` : "Attacking"; }
    const blocks = inCombat ? Object.entries(state.attackers).find(([, b]) => b === p.uid) : undefined;
    if (blocks) { const a = nameOnTable(blocks[0]); return a ? `Blocks ${a}` : "Blocking"; }
    if (state.selectedAttackers.includes(p.uid)) return "Attacking";
    if (state.pendingBlocker === p.uid) return "Chosen to block";
    if (p.summoningSick && def(p.card).kind === "creature" && !def(p.card).keywords?.includes("Haste")) return p.isCommander ? "Commander · arrived this turn" : "Arrived this turn";
    return p.isCommander ? "Commander" : undefined;
  };
  const targetLabel = (t: GameState["stack"][number]["target"]): string => {
    if (!t) return "";
    if (t.kind === "player") return ` → ${t.player === "you" ? "you" : "your opponent"}`;
    const uid = t.uid;
    const name = t.kind === "permanent" ? state.battlefield.find((p) => p.uid === uid)?.card : state.stack.find((x) => x.uid === uid)?.card;
    return ` → ${name ? def(name).name : t.kind === "permanent" ? "a creature" : "a spell"}`;
  };
  const cmdDamageText = (d: Record<string, number> | undefined) => { const entries = Object.entries(d ?? {}); return entries.length ? entries.map(([card, n]) => `${n} of 21 from ${def(card).name}`).join("; ") : "none yet"; };

  /** The one thing to do now. */
  const now = ((): { text: string; button: string; action: Action | (() => void); secondary?: { label: string; action: Action } } => {
    if (busy) return { text: "Watch what happens, or tap Skip ahead.", button: "Skip ahead", action: skipCues };
    if (mode === "DEFEAT") return { text: "This game is over. Undo a few moves to try a different line, or play again.", button: "Play again", action: restart };
    if (mode === "VICTORY" || complete) return { text: freePlay ? "You won. Play again, or leave the game." : "Goal reached. Go back to the list to pick the next scenario.", button: freePlay ? "Play again" : exitLabel ?? "All scenarios", action: freePlay ? restart : onExit };
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
      return { text: `${todo}No creature of yours can attack this turn, so end the turn when you're done.`, button: "End turn", action: () => { if (busy) skipCues(); setHandPick(null); machine.endTurnFromMain1(); } };
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
  const sprite = (p: Permanent, size: "sm" | "md" = "md") => {
    const t = tapOf(p);
    return (
      <div key={p.uid} data-uid={p.uid} data-card={p.card} className="card-shadow">
        <GameCard card={def(p.card)} perm={p} size={size} badge={permBadge(p)} selected={state.selectedAttackers.includes(p.uid) || state.pendingBlocker === p.uid} action={t.label} onClick={t.onClick} highlight={t.prompt} />
      </div>
    );
  };

  return (
    <section aria-labelledby="practice-heading" className="grid gap-s3 pb-[12rem]" ref={rootRef}>
      <p className="sr-only" aria-live="polite">{pending?.announce ?? ""}</p>

      {/* Title row */}
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

      {/* The felt */}
      <div className="felt rail grid gap-s3 rounded-xl p-s3">
        {/* Opponent */}
        <div className="grid gap-s2">
          <p className="flex flex-wrap items-center gap-s2 font-bold">
            <span className="on-felt rounded-sm px-s2">Opponent</span>
            <span data-life="opp" className="on-felt inline-block rounded-sm px-s2 font-mono">Life {state.opp.life}</span>
            {freePlay && <span className="on-felt rounded-sm px-s2 text-sm font-normal">Hand {state.opp.hand.length} · Library {state.opp.library.length}</span>}
            {commander && <span className="on-felt rounded-sm px-s2 text-sm font-normal">Commander damage taken: {cmdDamageText(state.opp.commanderDamage)}</span>}
          </p>
          {commander && state.opp.commandZone && (
            <div className="flex flex-wrap items-center gap-s2 rounded-md border border-dashed border-felt-ink/40 p-s2">
              <span className="on-felt rounded-sm px-s2 text-sm font-bold">Command zone</span>
              {state.opp.commandZone.inZone
                ? <div data-uid={`cz-opp`} data-card={state.opp.commandZone.card} className="card-shadow"><GameCard card={def(state.opp.commandZone.card)} size="sm" badge={state.opp.commandZone.casts ? `Tax +${2 * state.opp.commandZone.casts}` : undefined} /></div>
                : <span className="on-felt rounded-sm px-s2 text-sm">{def(state.opp.commandZone.card).name} is on the battlefield.</span>}
            </div>
          )}
          <div className="flex flex-wrap gap-s2">
            {creatures(theirs).length === 0 && <p className="on-felt rounded-sm px-s2 text-sm">No creatures.</p>}
            {creatures(theirs).map((p) => sprite(p))}
          </div>
          <div className="flex flex-wrap gap-s2">{lands(theirs).map((p) => sprite(p, "sm"))}</div>
        </div>

        {/* The stack */}
        {state.stack.length > 0 && (
          <div className="on-felt grid gap-s1 rounded-lg border-2 border-dashed border-accent p-s3">
            <p className="font-bold">On the stack <span className="text-sm font-normal text-text-muted">(top happens first)</span></p>
            <ol className="grid gap-s1">
              {[...state.stack].reverse().map((item, i) => (
                <li key={item.uid} className="text-sm">{i === 0 ? "▸ " : ""}{item.caster === "you" ? "Your" : "Opponent's"} <strong>{def(item.card).name}</strong>{targetLabel(item.target)}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="h-px bg-felt-ink/25" aria-hidden="true" />

        {/* You */}
        <div className="grid gap-s2">
          <p className="flex flex-wrap items-center gap-s2 font-bold">
            <span className="on-felt rounded-sm px-s2">You</span>
            <span data-life="you" className="on-felt inline-block rounded-sm px-s2 font-mono">Life {state.you.life}</span>
            {freePlay && <span className="on-felt rounded-sm px-s2 text-sm font-normal">Library {state.you.library.length}</span>}
            {commander && <span className="on-felt rounded-sm px-s2 text-sm font-normal">Commander damage taken: {cmdDamageText(state.you.commanderDamage)}</span>}
          </p>
          <div className="flex flex-wrap gap-s2">
            {creatures(mine).length === 0 && <p className="on-felt rounded-sm px-s2 text-sm">No creatures on the battlefield.</p>}
            {creatures(mine).map((p) => sprite(p))}
          </div>
          <div className="flex flex-wrap items-end gap-s2">
            {lands(mine).length === 0 && <p className="on-felt rounded-sm px-s2 text-sm">No lands yet.</p>}
            {lands(mine).map((p) => sprite(p, "sm"))}
            {(!autoMana || Object.values(state.you.pool).some(Boolean)) && (
              <p className="on-felt rounded-sm px-s2 text-sm">Mana pool: {Object.entries(state.you.pool).filter(([, n]) => n).map(([c, n]) => `${n} ${c === "W" ? "white" : c === "U" ? "blue" : c === "B" ? "black" : c === "R" ? "red" : "green"}`).join(", ") || "empty"}</p>
            )}
          </div>
          {commander && state.you.commandZone && (
            <div className="flex flex-wrap items-start gap-s3 rounded-md border border-dashed border-felt-ink/40 p-s2">
              <span className="on-felt rounded-sm px-s2 text-sm font-bold">Your command zone</span>
              {state.you.commandZone.inZone ? (() => {
                const cz = state.you.commandZone; const cost = commanderCost(state, "you") ?? ""; const ok = mainPhase && canAfford(cost);
                return <>
                  <div data-uid="cz-you" data-card={cz.card} className="card-shadow"><GameCard card={def(cz.card)} size="sm" badge={cz.casts ? `Tax +${2 * cz.casts}` : undefined} highlight={ok ? "Can cast" : undefined} action={`Cast commander for ${cost}`} onClick={castCommander} /></div>
                  <span className="on-felt grid gap-s1 rounded-sm px-s2 py-s1 text-sm"><span>Costs <strong>{cost}</strong> now{cz.casts ? ` (${2 * cz.casts} of it is commander tax)` : ""}.</span><button type="button" onClick={castCommander} className={ok ? primary : secondary}>Cast commander</button></span>
                </>;
              })() : <span className="on-felt rounded-sm px-s2 text-sm">{def(state.you.commandZone.card).name} is on the battlefield. If it's destroyed, it comes back here.</span>}
            </div>
          )}
        </div>
      </div>

      {/* Hand tray */}
      <div className="tray grid gap-s2 rounded-lg p-s3">
        <p className="font-bold">Your hand <span className="text-sm font-normal opacity-90">({state.you.hand.length} card{state.you.hand.length === 1 ? "" : "s"})</span>
          {autoMana && <span className="block text-sm font-normal opacity-90">Tap a card to play it. Mana is paid for you.</span>}
        </p>
        <div className="flex flex-wrap gap-s2">
          {state.you.hand.length === 0 && <p className="text-sm">Your hand is empty.</p>}
          {state.you.hand.map((uid) => {
            const card = handCardDef(uid);
            const can = canCastNow(card);
            const verb = card.kind === "land" ? "Play" : (card.effect === "counter" || card.effect === "counterNoncreature") && oppSpellWaiting ? "Counter with" : "Cast";
            return (
              <div key={uid} data-uid={uid} data-card={card.id} className="card-shadow">
                <GameCard card={card} selected={handPick === uid} highlight={can ? (card.kind === "land" ? "Can play" : "Can cast") : undefined} action={autoMana ? (can ? `${verb} ${card.name}` : "Open options") : "Open options"} onClick={() => (autoMana && can ? castFromHand(uid) : setHandPick(handPick === uid ? null : uid))} />
              </div>
            );
          })}
        </div>
        {handPick && state.you.hand.includes(handPick) && (() => {
          const card = handCardDef(handPick);
          const can = canCastNow(card);
          return (
            <div className="on-felt grid gap-s2 rounded-md p-s2" role="group" aria-label={`Options for ${card.name}`}>
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

      {/* Ghosts: destroyed cards fading out where they were */}
      {ghosts.map((g) => (
        <div key={g.uid} data-ghost={g.uid} aria-hidden="true" className="pointer-events-none fixed z-10" style={{ left: g.left, top: g.top, width: g.width, height: g.height }}>
          <GameCard card={CARDS[g.card] ?? def("forest")} size={g.width < 90 ? "sm" : "md"} />
        </div>
      ))}

      {/* Tools and the log */}
      <div className="flex flex-wrap gap-s2">
        <button type="button" onClick={restart} className={secondary}>Restart</button>
        <button type="button" onClick={() => onReadMore(scenario.readMore)} className={secondary}><Icon name="book" /> Read the lesson</button>
      </div>
      <details className="rounded-lg border border-border bg-surface p-s3">
        <summary className="min-h-tap cursor-pointer content-center font-bold">Full game log</summary>
        <ol className="mt-s2 grid gap-s1 text-sm">{state.log.filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}</ol>
      </details>
      {settings.debugPanel && <DebugPanel snap={snap} machine={machine} fps={fps} />}
      <p className="text-sm text-text-muted">
        The {Object.keys(CARDS).length} cards on this table are real Foundations cards with their official rules text and art. © Wizards of the Coast LLC, used under the Fan Content Policy. Data via Scryfall.
      </p>

      {/* The sticky "what now" bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg/95 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-s2 [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid max-w-[64rem] gap-s2">
          {feedback && !busy && (
            <div role="status" className={`grid gap-s1 rounded-md p-s2 text-sm ${feedback.kind === "done" ? "bg-success-soft" : feedback.kind === "opp" ? "bg-surface-2" : "bg-hint-soft"}`}>
              <p className="flex items-start gap-s2"><span className={feedback.kind === "done" ? "text-success" : "text-hint"}><Icon name={feedback.kind === "done" ? "check" : "info"} size={1.1} /></span><span>{feedback.text}</span></p>
              {feedback.lines && <ul className="grid gap-[2px] pl-s5">{feedback.lines.slice(0, 6).map((l, i) => <li key={i}>{l}</li>)}</ul>}
              {feedback.kind === "coach" && snap.canUndo && <div><button type="button" onClick={undo} className={`${secondary} min-h-[2.25rem]`}>Undo that move</button></div>}
            </div>
          )}
          {freePlay && advice && !complete && !state.result && !busy && (
            <p className="text-sm"><strong>Coach:</strong> {advice.move} <button type="button" onClick={() => setShowWhy((v) => !v)} aria-expanded={showWhy} className="underline">{showWhy ? "Hide why" : "Why?"}</button>{showWhy && <span className="block text-text-muted">{advice.why}</span>}</p>
          )}
          <p className="text-sm"><strong>Now:</strong> {now.text}</p>
          <div className="grid grid-cols-[auto_auto_1fr] gap-s2">
            <button type="button" onClick={undo} disabled={!snap.canUndo} className={`${secondary} disabled:opacity-50`}><Icon name="back" /> Undo</button>
            <button type="button" onClick={() => machine.hint()} className={secondary}><Icon name="info" /> Hint</button>
            <button type="button" data-main-button onClick={() => run(now.action)} className={primary}>{now.button} <Icon name="next" /></button>
          </div>
          {now.secondary && !busy && <div><button type="button" onClick={() => act(now.secondary!.action)} className="text-sm underline">{now.secondary.label}</button></div>}
        </div>
      </div>
    </section>
  );
});
