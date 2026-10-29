// Settings form. Phase 1 shows it on the token preview page; Phase 3 moves it into the settings panel.
import { useId } from "react";
import { useSettings } from "../theme/SettingsContext";
import {
  FONT_LABELS,
  FONT_SIZE_STEPS,
  LETTER_SPACING_STEPS,
  LINE_HEIGHT_STEPS,
  WORD_SPACING_STEPS,
  type FontChoice,
  type Settings,
} from "../theme/settings";

interface ChoiceGroupProps<T extends string | number> {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

function ChoiceGroup<T extends string | number>({ legend, options, value, onChange }: ChoiceGroupProps<T>) {
  const name = useId();
  return (
    <fieldset className="grid gap-s2">
      <legend className="font-bold mb-s2">{legend}</legend>
      <div className="flex flex-wrap gap-s2">
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={String(o.value)}
              className={`inline-flex min-h-tap items-center gap-s2 rounded-md border-2 px-s4 cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-[3px] ${
                checked ? "border-accent bg-accent-soft" : "border-border-strong bg-surface"
              }`}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(o.value)}
              />
              {/* A visible mark, so the selected option isn't shown by color alone. */}
              <span aria-hidden="true" className="font-mono">{checked ? "●" : "○"}</span>
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  const descId = useId();
  return (
    <div className="flex items-start justify-between gap-s4">
      <div>
        <span className="font-bold">{label}</span>
        <p id={descId} className="text-sm text-text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descId}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`min-h-tap min-w-[5.5rem] shrink-0 rounded-full border-2 px-s3 font-bold ${
          checked ? "border-accent bg-accent text-accent-ink" : "border-border-strong bg-surface-2 text-text"
        }`}
      >
        {checked ? "On" : "Off"}
      </button>
    </div>
  );
}

const steps = (values: readonly number[], labels: string[]) => values.map((_, i) => ({ value: i, label: labels[i] ?? String(i) }));

export function SettingsControls() {
  const { settings, dispatch } = useSettings();
  const set = (patch: Partial<Settings>) => dispatch({ type: "set", patch });

  return (
    <div className="grid gap-s5">
      <ChoiceGroup
        legend="Theme"
        options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]}
        value={settings.theme}
        onChange={(theme) => set({ theme })}
      />
      <ChoiceGroup
        legend="Font"
        options={(Object.keys(FONT_LABELS) as FontChoice[]).map((f) => ({ value: f, label: FONT_LABELS[f] }))}
        value={settings.font}
        onChange={(font) => set({ font })}
      />
      <ChoiceGroup
        legend="Text size"
        options={steps(FONT_SIZE_STEPS, ["Normal", "Large", "Larger", "Largest"])}
        value={settings.fontSizeStep}
        onChange={(fontSizeStep) => set({ fontSizeStep })}
      />
      <ChoiceGroup
        legend="Line spacing"
        options={steps(LINE_HEIGHT_STEPS, ["1.5", "1.75", "2.0"])}
        value={settings.lineHeightStep}
        onChange={(lineHeightStep) => set({ lineHeightStep })}
      />
      <ChoiceGroup
        legend="Letter spacing"
        options={steps(LETTER_SPACING_STEPS, ["Normal", "Wider", "Widest"])}
        value={settings.letterSpacingStep}
        onChange={(letterSpacingStep) => set({ letterSpacingStep })}
      />
      <ChoiceGroup
        legend="Word spacing"
        options={steps(WORD_SPACING_STEPS, ["Normal", "Wider", "Widest"])}
        value={settings.wordSpacingStep}
        onChange={(wordSpacingStep) => set({ wordSpacingStep })}
      />
      <Toggle
        label="Animations"
        description="Off by default. If your device asks for reduced motion, animations stay off."
        checked={settings.animations}
        onChange={(animations) => set({ animations })}
      />
      <div>
        <button
          type="button"
          onClick={() => dispatch({ type: "reset" })}
          className="min-h-tap rounded-md border-2 border-border-strong bg-surface px-s4 font-bold"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
