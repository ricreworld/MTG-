// The wizard layout, designed phone-first:
//   compact top bar (Outline, Settings) → one step card → sticky bottom bar (Back, Pause, Focus, Next).
// On wide screens the course outline also shows as a sidebar.
// Focus Mode hides everything marked data-focus-hide (see index.css).
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { Icon } from "../../components/Icon";
import { content } from "../../content";
import { useSettings } from "../../theme/SettingsContext";
import { START, isFirst, isLast, navigate, type NavAction, type Position } from "../course/navigation";
import { StepCard } from "../lesson/StepCard";
import { BottomBar } from "./BottomBar";
import { OutlineList } from "./CourseOutline";
import { SettingsPanel } from "./SettingsPanel";
import { detectSwipe, type TouchPoint } from "./swipe";
import { useShortcuts } from "./useShortcuts";

type View = "lesson" | "outline" | "settings" | "paused";

const topButton = "inline-flex min-h-tap items-center gap-s2 rounded-md border-2 px-s3 font-bold";

export function AppShell() {
  const { modules, glossary, errors } = content;
  const { settings, dispatch } = useSettings();
  const [position, setPosition] = useState<Position>(START);
  const [view, setView] = useState<View>("lesson");
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const touchStart = useRef<TouchPoint | null>(null);

  const mod = modules[position.moduleIndex];
  const step = mod?.steps[position.stepIndex];

  const go = (action: NavAction) => {
    if (view !== "lesson") return;
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
      paused: "Paused. Take your time.",
    };
    setAnnouncement(text[view]);
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [position, view]);

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

  const outline = <OutlineList modules={modules} position={position} onGo={goTo} />;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-s4 focus:top-s4 focus:z-20 focus:rounded-md focus:bg-surface focus:p-s3">
        Skip to the lesson
      </a>

      <header data-focus-hide className="border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-[64rem] items-center gap-s2 py-s2 [@media(max-height:500px)]:py-s1 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <p className="mr-auto text-lg font-bold">Mana Steps</p>
          <button type="button" onClick={() => toggleView("outline")} aria-pressed={view === "outline"}
            className={`${topButton} lg:hidden ${view === "outline" ? "border-accent bg-accent-soft" : "border-border-strong bg-surface"}`}>
            <Icon name="list" /> Outline
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

          {view === "paused" && (
            <section aria-labelledby="paused-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s5">
              <h2 id="paused-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Paused</h2>
              <p>Take your time. Stretch, get a drink, look away from the screen. Your place is kept, and nothing changes while you're away.</p>
              <div>
                <button type="button" onClick={() => setView("lesson")} className="inline-flex min-h-tap items-center gap-s2 rounded-md bg-accent px-s5 font-bold text-accent-ink">
                  <Icon name="play" /> Resume the lesson
                </button>
              </div>
            </section>
          )}

          {view === "lesson" && mod && step && (
            <StepCard ref={headingRef} key={`${mod.id}/${step.id}`} module={mod} step={step} stepIndex={position.stepIndex} glossary={glossary} />
          )}
          {view === "lesson" && !step && <p>There are no lessons to show yet.</p>}
        </main>
      </div>

      <footer data-focus-hide className="border-t border-border">
        <p className="mx-auto max-w-[64rem] px-s4 py-s4 text-sm text-text-muted">
          Mana Steps is an unofficial fan-made learning tool. It isn't produced or endorsed by Wizards of the Coast. Example cards are made up.
        </p>
      </footer>

      <BottomBar
        canBack={!isFirst(position)}
        canNext={!isLast(modules, position)}
        focusMode={settings.focusMode}
        paused={view === "paused"}
        onBack={() => go({ type: "back" })}
        onNext={() => go({ type: "next" })}
        onPause={() => setView(view === "paused" ? "lesson" : "paused")}
        onToggleFocus={() => dispatch({ type: "toggleFocusMode" })}
      />

      <div aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
    </div>
  );
}
