// One button for the whole app: three looks, always at least 44px tall, icon optional, never an arrow glued to text.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "../Icon";

export type ButtonLook = "primary" | "secondary" | "quiet";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  look?: ButtonLook;
  icon?: IconName | undefined;
  /** True when the button shows a chosen state (tabs, filters). */
  pressed?: boolean | undefined;
  children: ReactNode;
  full?: boolean;
}

const LOOK: Record<ButtonLook, string> = {
  primary: "bg-accent text-accent-ink border-2 border-accent",
  secondary: "border-2 border-border-strong bg-surface text-text",
  quiet: "border-2 border-transparent bg-transparent text-text underline decoration-accent decoration-2 underline-offset-4",
};

export function Button({ look = "secondary", icon, pressed, children, full, type = "button", ...rest }: Props) {
  const chosen = pressed ? "border-accent bg-accent-soft" : "";
  return (
    <button type={type} aria-pressed={pressed} className={`inline-flex min-h-tap items-center justify-center gap-s2 rounded-md px-s4 font-bold disabled:opacity-50 ${LOOK[look]} ${chosen} ${full ? "w-full" : ""}`} {...rest}>
      {icon && <Icon name={icon} size={1.1} />}
      <span>{children}</span>
    </button>
  );
}
