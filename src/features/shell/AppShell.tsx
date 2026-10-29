// The wizard layout: header, course outline, one step card, sticky bottom bar, footer.
// Focus Mode hides everything marked data-focus-hide (see index.css).
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { content } from "../../content";
import { useSettings } from "../../theme/SettingsContext";
import { START, isFirst, isLast, navigate, type NavAction, type Position } from "../course/navigation";
import { StepCard } from "../lesson/StepCard";
import { BottomBar } from "./BottomBar";
import { CourseOutline } from "./CourseOutline";
import { SettingsPanel } from "./SettingsPanel";
import { useShortcuts } from "./useShortcuts";

type View = "lesson" | "settings" | "paused";

export function AppShell() {
  const { modules, glossary, errors } = content;
  const { settings, dispatch } = useSettings();
  const [position, setPosition] = useState<Position>(START);
  const [view, setView] = useState<View>("lesson");
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const mod = modules[position.moduleIndex];
  const step = mod?.steps[position.stepIndex];

  const go = (action: NavAction) => {
    if (view !== "lesson") return;
    setPosition((p) => navigate(modules, p, action));
  };

  // After every step or view change: announce it, and move keyboard focus to the new heading.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (view === "lesson" && mod && step) setAnnouncement(`${mod.title}, step ${position.stepIndex + 1} of ${mod.steps.length}: ${step.title}`);
    if (view === "paused") setAnnouncement("Paused. Take your time.");
    if (view === "settings") setAnnouncement("Settings");
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [position, view]);

  useShortcuts({
    back: () => go({ type: "back" }),
    next: () => go({ type: "next" }),
    focus: () => dispatch({ type: "toggleFocusMode" }),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-s4 focus:top-s4 focus:z-20 focus:rounded-md focus:bg-surface focus:p-s3">
        Skip to the lesson
      </a>

      <header data-focus-hide className="border-b border-border">
        <div className="mx-auto flex max-w-[64rem] flex-wrap items-center gap-s3 px-s4 py-s3">
          <p className="text-xl font-bold">Mana Steps</p>
          <button
            type="button"
            onClick={() => setView(view === "settings" ? "lesson" : "settings")}
            aria-pressed={view === "settings"}
            className="ml-auto inline-flex min-h-tap items-center gap-s2 rounded-md border-2 border-border-strong bg-surface px-s4 font-bold"
          >
            <Icon name="settings" /> Settings
          </button>
        </div>
      </header>

      <div className={`mx-auto grid w-full flex-1 gap-s5 px-s4 py-s5 ${settings.focusMode ? "max-w-[48rem]" : "max-w-[64rem] lg:grid-cols-[16rem_minmax(0,1fr)]"}`}>
        <aside data-focus-hide>
          <CourseOutline
            modules={modules}
            position={position}
            onGo={(moduleIndex, stepIndex) => { setView("lesson"); setPosition(navigate(modules, position, { type: "goto", moduleIndex, stepIndex })); }}
          />
        </aside>

        <main id="main" className="grid min-w-0 content-start gap-s4">
          {errors.length > 0 && (
            <div data-focus-hide className="flex items-start gap-s3 rounded-md bg-hint-soft p-s4">
              <span className="text-hint"><Icon name="info" /></span>
              <p>Some lesson content couldn't be loaded, so a few steps may be missing. Everything else works as normal.</p>
            </div>
          )}

          {view === "settings" && <SettingsPanel ref={headingRef} onClose={() => setView("lesson")} />}

          {view === "paused" && (
            <section aria-labelledby="paused-heading" className="grid gap-s4 rounded-lg border border-border bg-surface p-s6">
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
