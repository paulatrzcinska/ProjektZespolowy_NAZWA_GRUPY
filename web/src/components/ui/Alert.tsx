import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "../../lib/cn";

const toneConfig = {
  info: {
    className: "border-stone-200 bg-stone-50/90 text-stone-800",
    Icon: Info,
  },
  error: {
    className: "border-red-200 bg-red-50/95 text-red-950",
    Icon: AlertCircle,
  },
  success: {
    className: "border-emerald-200/90 bg-emerald-50/95 text-emerald-950",
    Icon: CheckCircle2,
  },
} as const;

export function Alert({
  tone = "info",
  children,
}: {
  tone?: keyof typeof toneConfig;
  children: ReactNode;
}) {
  const { className, Icon } = toneConfig[tone];
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3.5 text-[0.9375rem] leading-relaxed shadow-[inset_0_1px_0_rgb(255_255_255/0.6)]",
        className,
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon
        className="mt-0.5 size-[1.125rem] shrink-0 opacity-80"
        strokeWidth={2}
        aria-hidden
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
