import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ id, label, className = "", ...rest }: Props) {
  const lid = id ?? rest.name;
  return (
    <label
      className={cn("flex w-full flex-col gap-2", className)}
      htmlFor={lid}
    >
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
        {label}
      </span>
      <input
        id={lid}
        className={cn(
          "w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-ink shadow-[inset_0_1px_0_rgb(0_0_0/0.02)] transition-[border-color,box-shadow]",
          "placeholder:text-stone-400",
          "hover:border-stone-300",
          "focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/8",
          "disabled:cursor-not-allowed disabled:bg-stone-50 disabled:opacity-70",
        )}
        {...rest}
      />
    </label>
  );
}
