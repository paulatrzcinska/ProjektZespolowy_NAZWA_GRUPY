import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 px-8 py-16 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.8)]",
        className,
      )}
    >
      <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-canvas ring-1 ring-line">
        <Icon className="size-6 text-subtle" strokeWidth={1.5} aria-hidden />
      </div>
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-sm text-[0.9375rem] leading-relaxed text-subtle">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}
