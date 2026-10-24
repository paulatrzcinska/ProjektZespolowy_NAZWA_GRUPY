import { Package } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { adminListOrders, updateOrderStatus } from "../api/orders";
import type { OrderDetail, OrderStatus } from "../api/types";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { Select } from "../components/ui/Select";
import { Spinner } from "../components/ui/Spinner";
import { cn } from "../lib/cn";
import { formatPln } from "../lib/format";

const statusLabel: Record<OrderStatus, string> = {
  pending: "Oczekuje",
  paid: "Opłacone",
  shipped: "Wysłane",
  cancelled: "Anulowane",
};

const statusPill: Record<OrderStatus, string> = {
  pending: "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80",
  paid: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80",
  shipped: "bg-blue-50 text-blue-900 ring-1 ring-blue-200/80",
  cancelled: "bg-red-50 text-red-900 ring-1 ring-red-200/80",
};

const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: [],
  cancelled: [],
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

type FilterValue = "all" | OrderStatus;

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [rowBusy, setRowBusy] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await adminListOrders({
          limit: 100,
          ...(filter !== "all" ? { status: filter } : {}),
        });
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
  }, [filter]);

  async function handleStatusChange(orderId: number, newStatus: OrderStatus) {
    setRowBusy((prev) => ({ ...prev, [orderId]: true }));
    setRowErrors((prev) => {
      const n = { ...prev };
      delete n[orderId];
      return n;
    });
    try {
      const updated = await updateOrderStatus(orderId, newStatus);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Nie udało się zmienić statusu.";
      setRowErrors((prev) => ({ ...prev, [orderId]: msg }));
    } finally {
      setRowBusy((prev) => {
        const n = { ...prev };
        delete n[orderId];
        return n;
      });
    }
  }

  return (
    <div className="w-full">
      <div className="mb-10 flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-subtle">
            Panel
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Zamówienia
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-subtle">
            Przeglądaj i zmieniaj statusy zamówień klientów.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Link
            to="/admin"
            className="inline-flex min-h-9 items-center justify-center rounded-full border border-line bg-surface/90 px-4 py-2 text-sm font-semibold text-ink no-underline transition-colors hover:border-stone-300 hover:bg-canvas"
          >
            Produkty
          </Link>
          <Link
            to="/admin/categories"
            className="inline-flex min-h-9 items-center justify-center rounded-full border border-line bg-surface/90 px-4 py-2 text-sm font-semibold text-ink no-underline transition-colors hover:border-stone-300 hover:bg-canvas"
          >
            Kategorie
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <div className="mb-6 max-w-xs">
        <Select
          label="Filtruj po statusie"
          name="status_filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterValue)}
        >
          <option value="all">Wszystkie</option>
          <option value="pending">Oczekuje</option>
          <option value="paid">Opłacone</option>
          <option value="shipped">Wysłane</option>
          <option value="cancelled">Anulowane</option>
        </Select>
      </div>

      {loading ? (
        <Spinner className="py-16" />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Brak zamówień"
          description="Nie znaleziono zamówień spełniających kryteria."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/50">
                  <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                    Nr
                  </th>
                  <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                    Data
                  </th>
                  <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                    Klient
                  </th>
                  <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                    Pozycji
                  </th>
                  <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                    Wartość
                  </th>
                  <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                    Status
                  </th>
                  <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                    Zmień status
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const nextStatuses = transitions[o.status];
                  const busy = rowBusy[o.id] ?? false;
                  const rowErr = rowErrors[o.id];
                  return (
                    <>
                      <tr
                        key={o.id}
                        className="border-b border-line/80 transition-colors hover:bg-canvas/30"
                      >
                        <td className="px-4 py-4 font-semibold tabular-nums text-ink">
                          #{o.id}
                        </td>
                        <td className="px-4 py-4 tabular-nums text-subtle">
                          {formatDate(o.created_at)}
                        </td>
                        <td className="px-4 py-4 text-ink">
                          <p className="font-medium">{o.shipping_full_name}</p>
                          <p className="text-xs text-subtle">
                            {o.shipping_city}
                          </p>
                        </td>
                        <td className="px-4 py-4 tabular-nums text-subtle">
                          {o.items.length}
                        </td>
                        <td className="px-4 py-4 tabular-nums text-ink">
                          {formatPln(o.total_amount)}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider",
                              statusPill[o.status],
                            )}
                          >
                            {statusLabel[o.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {nextStatuses.length > 0 ? (
                            <Select
                              label={`Nowy status zamówienia #${o.id}`}
                              name={`status-${o.id}`}
                              value=""
                              disabled={busy}
                              onChange={(e) => {
                                if (e.target.value)
                                  void handleStatusChange(
                                    o.id,
                                    e.target.value as OrderStatus,
                                  );
                              }}
                              className="min-w-[130px] [&>span]:sr-only"
                            >
                              <option value="" disabled>
                                {busy ? "Zapisywanie…" : "Wybierz…"}
                              </option>
                              {nextStatuses.map((s) => (
                                <option key={s} value={s}>
                                  {statusLabel[s]}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <span className="text-xs text-subtle">—</span>
                          )}
                        </td>
                      </tr>
                      {rowErr ? (
                        <tr
                          key={`${o.id}-err`}
                          className="border-b border-line/60 bg-red-50/40"
                        >
                          <td colSpan={7} className="px-4 py-2">
                            <Alert tone="error">{rowErr}</Alert>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
