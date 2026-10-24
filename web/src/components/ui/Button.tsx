import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "default" | "sm" | "icon";
  children: ReactNode;
};

const variantClass: Record<NonNullable<Props["variant"]>, string> = {
  primary:
    "border border-stone-900 bg-stone-900 text-white shadow-sm hover:bg-stone-800 hover:border-stone-800 active:scale-[0.99]",
  ghost:
    "border border-line bg-surface/90 text-ink hover:bg-canvas hover:border-stone-300 active:scale-[0.99]",
  danger:
    "border border-red-200 bg-danger-bg text-red-900 hover:bg-red-100 hover:border-red-300 active:scale-[0.99]",
};

const sizeClass: Record<NonNullable<Props["size"]>, string> = {
  default: "min-h-11 px-5 py-2.5 text-[0.9375rem]",
  sm: "min-h-9 px-3.5 py-1.5 text-sm",
  icon: "size-10 min-h-10 min-w-10 shrink-0 p-0",
};

export function Button({
  variant = "primary",
  size = "default",
  className = "",
  type = "button",
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-200 disabled:pointer-events-none disabled:opacity-45",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
