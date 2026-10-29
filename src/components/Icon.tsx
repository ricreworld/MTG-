// Small stroke icons. Always decorative (aria-hidden): the button or text next to them carries the label.
export type IconName = "back" | "next" | "pause" | "settings" | "focus" | "check" | "info" | "book" | "close" | "play";

const PATHS: Record<IconName, string> = {
  back: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  pause: "M9 5v14M15 5v14",
  settings: "M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4",
  focus: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  check: "M5 12.5l4.5 4.5L19 7.5",
  info: "M12 11v6M12 7.5v.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  book: "M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM17 20H8a3 3 0 0 1-3-3",
  close: "M6 6l12 12M18 6L6 18",
  play: "M8 5v14l11-7z",
};

export function Icon({ name, size = 1.25 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={`${size}rem`} height={`${size}rem`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="shrink-0">
      <path d={PATHS[name]} />
    </svg>
  );
}
