// Settings live in the main area (not a popup). The learner returns with "Back to the lesson".
import { forwardRef } from "react";
import { Icon } from "../../components/Icon";
import { SettingsControls } from "../../components/SettingsControls";
import { useSettings } from "../../theme/SettingsContext";

export const SHORTCUTS: readonly { keys: string; action: string; note?: string }[] = [
  { keys: "← Left arrow", action: "Back one step" },
  { keys: "→ Right arrow", action: "Next step" },
  { keys: "F", action: "Turn Focus Mode on or off" },
  { keys: "R", action: "Read the step aloud", note: "arrives in a later update" },
];

export const SettingsPanel = forwardRef<HTMLHeadingElement, { onClose: () => void }>(function SettingsPanel({ onClose }, headingRef) {
  const { settings, dispatch } = useSettings();
  return (
    <section aria-labelledby="settings-heading" className="grid gap-s5 rounded-lg border border-border bg-surface p-s5 sm:p-s6">
      <div className="flex flex-wrap items-center justify-between gap-s3">
        <h2 id="settings-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Settings</h2>
        <button type="button" onClick={onClose} className="inline-flex min-h-tap items-center gap-s2 rounded-md border-2 border-accent px-s4 font-bold">
          <Icon name="back" /> Back to the lesson
        </button>
      </div>

      <div className="flex items-start justify-between gap-s4 rounded-md bg-surface-2 p-s4">
        <div>
          <span className="font-bold">Focus Mode</span>
          <p className="text-sm text-text-muted">Hides the outline and footer. Shows only the step and the buttons. Shortcut: F.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.focusMode}
          aria-label="Focus Mode"
          onClick={() => dispatch({ type: "toggleFocusMode" })}
          className={`min-h-tap min-w-[5.5rem] shrink-0 rounded-full border-2 px-s3 font-bold ${
            settings.focusMode ? "border-accent bg-accent text-accent-ink" : "border-border-strong bg-surface text-text"
          }`}
        >
          {settings.focusMode ? "On" : "Off"}
        </button>
      </div>

      <SettingsControls />

      <section aria-labelledby="shortcuts-heading" className="grid gap-s3">
        <h3 id="shortcuts-heading" className="text-lg font-bold">Keyboard shortcuts</h3>
        <p className="text-sm text-text-muted">Shortcuts don't work while you're choosing an answer or typing, so they never get in the way.</p>
        <dl className="grid gap-s2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex flex-wrap gap-s3">
              <dt><kbd className="rounded-sm border border-border-strong bg-surface-2 px-s2 font-mono">{s.keys}</kbd></dt>
              <dd>{s.action}{s.note && <span className="text-text-muted"> ({s.note})</span>}</dd>
            </div>
          ))}
        </dl>
      </section>
    </section>
  );
});
