import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
};

export function Select({
  id,
  label,
  className = "",
  children,
  ...rest
}: Props) {
  const lid = id ?? rest.name;
  return (
    <label
      className={cn("flex w-full flex-col gap-2", className)}
      htmlFor={lid}
    >
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
        {label}
      </span>
      <div className="relative">
        <select
          id={lid}
          className={cn(
            "w-full cursor-pointer appearance-none rounded-lg border border-line bg-surface py-3 pl-3.5 pr-10 text-ink shadow-[inset_0_1px_0_rgb(0_0_0/0.02)] transition-[border-color,box-shadow]",
            "hover:border-stone-300",
            "focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/8",
            "disabled:cursor-not-allowed disabled:bg-stone-50 disabled:opacity-70",
          )}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
          aria-hidden
        />
      </div>
    </label>
  );
}
