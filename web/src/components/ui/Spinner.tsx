import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

export function Spinner({
  label = "Ładowanie…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-6",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="size-9 animate-spin text-stone-400"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
