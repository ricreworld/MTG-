// Always-visible navigation: Back, Pause, Focus Mode, Next.
// Phones: one row of four equal buttons (icon above word). Wider screens: one row, Next on the right.
import { Icon, type IconName } from "../../components/Icon";

interface Props {
  canBack: boolean;
  canNext: boolean;
  focusMode: boolean;
  paused: boolean;
  onBack: () => void;
  onNext: () => void;
  onPause: () => void;
  onToggleFocus: () => void;
}

interface BarButtonProps {
  icon: IconName;
  label: string;
  srExtra?: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  primary?: boolean;
  iconAfter?: boolean;
  className?: string;
  /** Visible state word (e.g. "On"), so state is never shown by colour alone. */
  badge?: string | undefined;
}

function BarButton({ icon, label, srExtra, onClick, disabled, pressed, primary, iconAfter, className = "", badge }: BarButtonProps) {
  const look = primary
    ? "bg-accent text-accent-ink"
    : `border-2 ${pressed ? "border-accent bg-accent-soft" : "border-border-strong bg-surface"}`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={`inline-flex min-h-tap min-w-tap flex-col items-center justify-center gap-s1 rounded-md px-s2 py-s1 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 sm:flex-row sm:gap-s2 sm:px-s4 sm:text-base ${iconAfter ? "sm:flex-row-reverse" : ""} ${look} ${className}`}
    >
      <Icon name={icon} />
      <span>{label}{srExtra && <span className="sr-only"> {srExtra}</span>}{badge && <span aria-hidden="true" className="ml-s1 rounded-sm bg-accent px-s1 text-accent-ink">{badge}</span>}</span>
    </button>
  );
}

export function BottomBar({ canBack, canNext, focusMode, paused, onBack, onNext, onPause, onToggleFocus }: Props) {
  return (
    <nav aria-label="Step navigation" className="sticky bottom-0 z-10 border-t border-border bg-bg/95 px-s3 py-s2 [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto grid max-w-[64rem] grid-cols-4 gap-s2 sm:flex sm:items-center">
        <BarButton icon="back" label="Back" onClick={onBack} disabled={!canBack || paused} />
        <BarButton icon={paused ? "play" : "pause"} label={paused ? "Resume" : "Pause"} onClick={onPause} pressed={paused} />
        <BarButton icon="focus" label="Focus" srExtra={`Mode, currently ${focusMode ? "on" : "off"}`} onClick={onToggleFocus} pressed={focusMode} badge={focusMode ? "On" : undefined} />
        <BarButton icon="next" label="Next" onClick={onNext} disabled={!canNext || paused} primary iconAfter className="sm:ml-auto" />
      </div>
    </nav>
  );
}
