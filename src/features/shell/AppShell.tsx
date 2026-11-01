// The wizard layout, designed phone-first:
//   compact top bar (Outline, Settings) → one step card → sticky bottom bar (Back, Pause, Focus, Next).
// On wide screens the course outline also shows as a sidebar.
// Focus Mode hides everything marked data-focus-hide (see index.css).
import { useEffect, useMemo, useReducer, useRef, useState, type TouchEvent } from "react";
import { Icon } from "../../components/Icon";
import { content } from "../../content";
import { STORAGE_KEYS, readJson, writeJson } from "../../lib/storage";
import { useSettings } from "../../theme/SettingsContext";
import { START, isFirst, isLast, navigate, type NavAction, type Position } from "../course/navigation";
import { StepCard } from "../lesson/StepCard";
import { PracticeTable } from "../practice/PracticeTable";
import { clearGame, loadGame } from "../../game/commander/save";
import type { CState } from "../../game/commander/engine";
import { ScenarioPicker } from "../practice/ScenarioPicker";
import { DeckPicker } from "../practice/DeckPicker";
import { lazy, Suspense } from "react";
const CardLibrary = lazy(() => import("../library/CardLibrary").then((m) => ({ default: m.CardLibrary })));
const CommanderSetup = lazy(() => import("../commander/CommanderSetup").then((m) => ({ default: m.CommanderSetup })));
const CommanderTable = lazy(() => import("../commander/CommanderTable").then((m) => ({ default: m.CommanderTable })));
import { makeMatch, type MatchSetup } from "../../game/match";
import { SCENARIOS, scenarioById } from "../../game/scenarios";
import { ModuleChecklist } from "../progress/ModuleChecklist";
import { ProgressBar } from "../progress/ProgressBar";
import { WelcomeBack } from "../progress/WelcomeBack";
import { courseStats, hasSavedProgress, positionOf, progressReducer, sanitizeProgress, stepKey } from "../progress/progress";
import { BottomBar } from "./BottomBar";
import { OutlineList } from "./CourseOutline";
import { SettingsPanel } from "./SettingsPanel";
import { detectSwipe, type TouchPoint } from "./swipe";
import { useShortcuts } from "./useShortcuts";

type View = "lesson" | "outline" | "settings" | "paused" | "welcome" | "finished" | "practice" | "library" | "commander";

const topButton = "inline-flex min-h-tap flex-1 items-center justify-center gap-s2 rounded-md border-2 px-s2 font-bold sm:flex-none sm:px-s3";

export function AppShell() {
  const { modules, glossary, errors } = content;
  const { settings, dispatch } = useSettings();
  // Saved progress is loaded once, repaired against the current content, then autosaved on every change.
  const [progress, dispatchProgress] = useReducer(progressReducer, undefined, () => sanitizeProgress(readJson(STORAGE_KEYS.progress), modules));
  const [position, setPosition] = useState<Position>(() => positionOf(progress, modules));
  const [view, setView] = useState<View>(() => (hasSavedProgress(progress) ? "welcome" : "lesson"));
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [matchSetup, setMatchSetup] = useState<MatchSetup | null>(null);
  const [pickingDeck, setPickingDeck] = useState<null | "standard" | "commander">(null);
  const [cmdGame, setCmdGame] = useState<{ state: CState; deckId: string } | null>(null);
  const savedCmd = useMemo(() => (view === "commander" && !cmdGame ? loadGame() : null), [view, cmdGame]);
  const match = useMemo(() => (matchSetup ? makeMatch(matchSetup) : undefined), [matchSetup]);
  const scenario = match ?? (scenarioId ? scenarioById(scenarioId) : undefined);
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const touchStart = useRef<TouchPoint | null>(null);

  const mod = modules[position.moduleIndex];
  const step = mod?.steps[position.stepIndex];

  useEffect(() => { writeJson(STORAGE_KEYS.progress, progress); }, [progress]);

  // Being on a step in the lesson view marks it as seen (and saves where the learner is).
  useEffect(() => {
    if (view === "lesson" && mod && step) dispatchProgress({ type: "open", moduleId: mod.id, stepId: step.id });
  }, [view, mod, step]);

  const stats = courseStats(progress, modules);
  const startOver = () => {
    dispatchProgress({ type: "reset" });
    setPosition(START);
    setView("lesson");
  };

  const atEnd = isLast(modules, position);
  const go = (action: NavAction) => {
    if (view !== "lesson") return;
    if (action.type === "next" && mod && step) {
      // Moving on is what completes a step (opening it alone doesn't).
      dispatchProgress({ type: "complete", moduleId: mod.id, stepId: step.id });
      if (atEnd) { setView("finished"); return; }
    }
    setPosition((p) => navigate(modules, p, action));
  };
  const toggleView = (v: View) => setView((cur) => (cur === v ? "lesson" : v));
  const goTo = (moduleIndex: number, stepIndex: number) => {
    setView("lesson");
    setPosition((p) => navigate(modules, p, { type: "goto", moduleIndex, stepIndex }));
  };

  // After every step or view change: announce it, and move keyboard/screen-reader focus to the new heading.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const text: Record<View, string> = {
      lesson: mod && step ? `${mod.title}, step ${position.stepIndex + 1} of ${mod.steps.length}: ${step.title}` : "",
      outline: "Course outline",
      settings: "Settings",
      paused: "Paused. Your place is saved.",
      welcome: "Welcome back",
      finished: "You reached the end of the lessons so far",
      practice: scenario ? `Practice: ${scenario.title}` : "Practice Table",
      library: "Card library",
      commander: cmdGame ? "Commander: four players" : "Commander setup",
    };
    setAnnouncement(text[view]);
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [position, view, scenarioId]);

  useShortcuts({
    back: () => go({ type: "back" }),
    next: () => go({ type: "next" }),
    focus: () => dispatch({ type: "toggleFocusMode" }),
  });

  // Optional swipe navigation (Settings → "Swipe to change steps"). Off by default.
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    const target = e.target as HTMLElement;
    // Never treat touches on controls or scrollable rows as swipes.
    touchStart.current = t && !target.closest("button, a, input, label, summary, [data-no-swipe]") ? { x: t.clientX, y: t.clientY, t: e.timeStamp } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    const t = e.changedTouches[0];
    touchStart.current = null;
    if (!settings.swipeToNavigate || !start || !t || e.touches.length > 0) return;
    const dir = detectSwipe(start, { x: t.clientX, y: t.clientY, t: e.timeStamp });
    if (dir) go({ type: dir });
  };

  const outline = <OutlineList modules={modules} position={position} onGo={goTo} progress={progress} />;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-s4 focus:top-s4 focus:z-20 focus:rounded-md focus:bg-surface focus:p-s3">
        Skip to the lesson
      </a>

      <header data-focus-hide className="border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-[64rem] flex-wrap items-center gap-s2 py-s2 [@media(max-height:500px)]:py-s1 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <h1 className="basis-full text-lg font-bold sm:mr-auto sm:basis-auto">Mana Steps</h1>
          <button type="button" onClick={() => toggleView("outline")} aria-pressed={view === "outline"}
            className={`${topButton} lg:hidden ${view === "outline" ? "border-accent bg-accent-soft" : "border-border-strong bg-surface"}`}>
            <Icon name="list" /> Outline
          </button>
          <button type="button" onClick={() => { setScenarioId(null); setMatchSetup(null); setPickingDeck(null); toggleView("practice"); }} aria-pressed={view === "practice" || view === "commander" || view === "library"}
            className={`${topButton} ${view === "practice" ? "border-accent bg-accent-soft" : "border-border-strong bg-surface"}`}>
            <Icon name="play" /> Practice
          </button>
          <button type="button" onClick={() => toggleView("settings")} aria-pressed={view === "settings"}
            className={`${topButton} ${view === "settings" ? "border-accent bg-accent-soft" : "border-border-strong bg-surface"}`}>
            <Icon name="settings" /> Settings
          </button>
        </div>
      </header>

      <div className={`mx-auto grid w-full flex-1 gap-s5 py-s4 [@media(max-height:500px)]:py-s2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:py-s5 ${
        settings.focusMode ? "max-w-[48rem]" : "max-w-[64rem] lg:grid-cols-[16rem_minmax(0,1fr)]"}`}>
        <aside data-focus-hide className="hidden lg:block">
          <nav aria-label="Course outline">
            <h2 className="mb-s4 text-lg font-bold">Course outline</h2>
            {outline}
          </nav>
        </aside>

        <main id="main" className="grid min-w-0 content-start gap-s4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {errors.length > 0 && (
            <div data-focus-hide className="flex items-start gap-s3 rounded-md bg-hint-soft p-s4">
              <span className="text-hint"><Icon name="info" /></span>
              <p>Some lesson content couldn't be loaded, so a few steps may be missing. Everything else works as normal.</p>
            </div>
          )}

          {view === "welcome" && mod && step && (
            <WelcomeBack
              ref={headingRef}
              where={`Module ${position.moduleIndex + 1}, ${mod.title}: step ${position.stepIndex + 1}, "${step.title}"`}
              percent={stats.percent}
              done={stats.done}
              total={stats.total}
              onContinue={() => setView("lesson")}
              onStartOver={startOver}
            />
          )}

          {(view === "lesson" || view === "finished") && <ProgressBar {...stats} />}

          {view === "finished" && (
            <section aria-labelledby="finished-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s5">
              <h2 id="finished-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">You reached the end, for now</h2>
              <p>That's every lesson available so far. More modules are on the way.</p>
              {stats.done < stats.total && (
                <p className="text-text-muted">Some steps don't have their checkmark yet, usually because a quick check question wasn't answered. The outline shows which ones.</p>
              )}
              <div className="flex flex-wrap gap-s3">
                <button type="button" onClick={() => setView("outline")} className="inline-flex min-h-tap items-center gap-s2 rounded-md bg-accent px-s5 font-bold text-accent-ink">
                  <Icon name="list" /> See the course outline
                </button>
                <button type="button" onClick={() => setView("lesson")} className="inline-flex min-h-tap items-center gap-s2 rounded-md border-2 border-border-strong bg-surface px-s5 font-bold">
                  <Icon name="back" /> Back to the last step
                </button>
              </div>
            </section>
          )}

          {view === "outline" && (
            <section aria-labelledby="outline-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s4">
              <div className="flex flex-wrap items-center justify-between gap-s3">
                <h2 id="outline-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Course outline</h2>
                <button type="button" onClick={() => setView("lesson")} className={`${topButton} border-accent`}>
                  <Icon name="back" /> Back to the lesson
                </button>
              </div>
              <nav aria-label="Course outline">{outline}</nav>
            </section>
          )}

          {view === "settings" && <SettingsPanel ref={headingRef} onClose={() => setView("lesson")} />}

          {view === "practice" && !scenario && !pickingDeck && (
            <ScenarioPicker ref={headingRef} completed={progress.scenarios} onPick={(id) => setScenarioId(id)} onPlayGame={() => setPickingDeck("standard")} onPlayCommander={() => setPickingDeck("commander")} onPlayFour={() => { setCmdGame(null); setView("commander"); }} onLibrary={() => setView("library")} onBack={() => setView("lesson")} />
          )}
          {view === "library" && (
            <Suspense fallback={<p className="p-s4">Loading the card library…</p>}>
              <CardLibrary ref={headingRef} onBack={() => setView("practice")} />
            </Suspense>
          )}
          {view === "commander" && !cmdGame && (
            <Suspense fallback={<p className="p-s4">Loading the Commander table…</p>}>
              <CommanderSetup ref={headingRef} saved={savedCmd} onContinue={() => { const g = loadGame(); if (g) setCmdGame({ state: g.state, deckId: g.deckId }); }} onStart={(deckId) => { void import("../../game/commander/start").then((m) => setCmdGame({ state: m.startFourPlayer(deckId, Math.floor(Math.random() * 1e9)), deckId })); }} onBack={() => setView("practice")} onReadMore={(moduleId) => { const mi = modules.findIndex((m) => m.id === moduleId); if (mi >= 0) goTo(mi, 0); }} />
            </Suspense>
          )}
          {view === "commander" && cmdGame && (
            <Suspense fallback={<p className="p-s4">Loading the Commander table…</p>}>
              <CommanderTable key={cmdGame.state.seed + cmdGame.deckId} ref={headingRef} initial={cmdGame.state} deckId={cmdGame.deckId} onExit={() => { setCmdGame(null); setView("practice"); }} onNewGame={() => { clearGame(); setCmdGame(null); }} onReadMore={(moduleId) => { const mi = modules.findIndex((m) => m.id === moduleId); if (mi >= 0) goTo(mi, 0); }} />
            </Suspense>
          )}
          {view === "practice" && !scenario && pickingDeck && (
            <DeckPicker ref={headingRef} mode={pickingDeck} onStart={(yourDeck, oppDeck) => { setMatchSetup({ yourDeck, oppDeck, seed: Math.floor(Math.random() * 1e9), mode: pickingDeck }); setPickingDeck(null); }} onBack={() => setPickingDeck(null)} />
          )}
          {view === "practice" && scenario && (
            <PracticeTable
              key={match ? `match-${matchSetup?.seed}` : scenario.id}
              ref={headingRef}
              scenario={scenario}
              exitLabel={match ? "Leave the game" : "All scenarios"}
              onComplete={() => { if (!match) dispatchProgress({ type: "completeScenario", scenarioId: scenario.id }); }}
              onExit={() => { setScenarioId(null); setMatchSetup(null); setPickingDeck(match ? (matchSetup?.mode ?? "standard") : null); }}
              onReadMore={(moduleId) => { const mi = modules.findIndex((m) => m.id === moduleId); if (mi >= 0) goTo(mi, 0); }}
            />
          )}

          {view === "paused" && (
            <section aria-labelledby="paused-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s5">
              <h2 id="paused-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Paused</h2>
              <p>Take your time. Stretch, get a drink, look away from the screen. Your place is saved on this device, so you can even close the app and come back later.</p>
              <div>
                <button type="button" onClick={() => setView("lesson")} className="inline-flex min-h-tap items-center gap-s2 rounded-md bg-accent px-s5 font-bold text-accent-ink">
                  <Icon name="play" /> Resume the lesson
                </button>
              </div>
            </section>
          )}

          {view === "lesson" && mod && step && (
            <>
              <StepCard
                ref={headingRef}
                key={`${mod.id}/${step.id}`}
                module={mod}
                step={step}
                stepIndex={position.stepIndex}
                glossary={glossary}
                checkPassed={progress.passed.includes(stepKey(mod.id, step.id))}
                onCheckCorrect={() => dispatchProgress({ type: "passCheck", moduleId: mod.id, stepId: step.id })}
              />
              {(() => {
                const sc = (step.tryIt && scenarioById(step.tryIt)) || SCENARIOS.find((x) => x.readMore === mod.id);
                if (!sc) return null;
                return (
                  <div data-focus-hide className="flex flex-wrap items-center gap-s3 rounded-lg border border-border bg-surface p-s4">
                    <span><strong>Try it:</strong> {sc.title}. {sc.teaches}</span>
                    <button type="button" onClick={() => { setScenarioId(sc.id); setView("practice"); }} className="inline-flex min-h-tap items-center gap-s2 rounded-md bg-accent px-s4 font-bold text-accent-ink">
                      <Icon name="play" /> Open the Practice Table
                    </button>
                  </div>
                );
              })()}
              <ModuleChecklist
                module={mod}
                ticked={progress.checklist[mod.id] ?? []}
                onToggle={(itemId) => dispatchProgress({ type: "toggleChecklist", moduleId: mod.id, itemId })}
              />
            </>
          )}
          {view === "lesson" && !step && <p>There are no lessons to show yet.</p>}
        </main>
      </div>

      <footer data-focus-hide className="border-t border-border">
        <p className="mx-auto max-w-[64rem] px-s4 py-s4 text-sm text-text-muted">
          Mana Steps is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC. Card data and images via Scryfall. This app is free and always will be.
        </p>
      </footer>

      {view !== "practice" && view !== "library" && view !== "commander" && <BottomBar
        canBack={view === "lesson" && !isFirst(position)}
        canNext={view === "lesson"}
        nextLabel={atEnd ? "Finish" : "Next"}
        focusMode={settings.focusMode}
        paused={view === "paused"}
        onBack={() => go({ type: "back" })}
        onNext={() => go({ type: "next" })}
        onPause={() => setView(view === "paused" ? "lesson" : "paused")}
        onToggleFocus={() => dispatch({ type: "toggleFocusMode" })}
      />}

      <div aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
    </div>
  );
}
