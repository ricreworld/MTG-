import { useEffect, useRef } from "react";

export interface ShortcutHandlers {
  back: () => void;
  next: () => void;
  focus: () => void;
  read?: () => void;
}

/** True when a key press belongs to a control (typing, choosing a radio option, a select…). */
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** ← Back, → Next, F Focus Mode, R Read aloud. Ignored while the learner is using a form control. */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented || isInteractiveTarget(e.target)) return;
      const h = ref.current;
      if (e.key === "ArrowLeft") { e.preventDefault(); h.back(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); h.next(); }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); h.focus(); }
      else if ((e.key === "r" || e.key === "R") && h.read) { e.preventDefault(); h.read(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
