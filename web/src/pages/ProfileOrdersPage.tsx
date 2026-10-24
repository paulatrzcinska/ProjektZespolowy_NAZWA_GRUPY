import { ArrowRight, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as ordersApi from "../api/orders";
import type { OrderDetail } from "../api/types";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { formatPln } from "../lib/format";
import { cn } from "../lib/cn";

const statusLabel: Record<OrderDetail["status"], string> = {
  pending: "Oczekuje",
  paid: "Opłacone",
  shipped: "Wysłane",
  cancelled: "Anulowane",
};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ProfileOrdersPage() {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await ordersApi.fetchMyOrders();
        if (!cancelled) setOrders(list);
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiError) setError(e.message);
          else setError("Nie udało się wczytać zamówień.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-ink">
        Historia zamówień
      </h2>
      <p className="mt-1 text-sm text-subtle">
        Lista Twoich zamówień — szczegóły i aktualny status w osobnych widokach.
      </p>

      {error ? (
        <div className="mt-6">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {loading ? (
        <Spinner className="py-16" />
      ) : orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Package}
            title="Brak zamówień"
            description="Gdy złożysz zamówienie, pojawi się ono na tej liście."
            action={
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-stone-900 bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-sm hover:bg-stone-800"
              >
                Do katalogu
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4 p-0">
          {orders.map((o) => (
            <li
              key={o.id}
              className="list-none rounded-2xl border border-line bg-surface p-5 shadow-card sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold text-ink">
                  Zamówienie #{o.id}
                </p>
                <p className="mt-1 text-sm text-subtle">
                  {formatDate(o.created_at)}
                </p>
                <p className="mt-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider",
                      o.status === "paid" || o.status === "shipped"
                        ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80"
                        : o.status === "cancelled"
                          ? "bg-red-50 text-red-900 ring-1 ring-red-200/80"
                          : "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80",
                    )}
                  >
                    {statusLabel[o.status]}
                  </span>
                </p>
                <p className="mt-2 text-sm font-semibold tabular-nums text-ink">
                  {formatPln(o.total_amount)}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
                <Link
                  to={`/orders/${o.id}/summary`}
                  className="inline-flex min-h-9 items-center justify-center rounded-full border border-line bg-surface/90 px-3.5 py-1.5 text-sm font-semibold text-ink no-underline transition-colors hover:border-stone-300 hover:bg-canvas"
                >
                  Podsumowanie
                </Link>
                <Link
                  to={`/orders/${o.id}/status`}
                  className="inline-flex min-h-9 items-center justify-center rounded-full border border-line bg-surface/90 px-3.5 py-1.5 text-sm font-semibold text-ink no-underline transition-colors hover:border-stone-300 hover:bg-canvas"
                >
                  Status
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
