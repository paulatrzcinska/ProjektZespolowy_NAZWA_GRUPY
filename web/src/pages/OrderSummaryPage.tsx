import { useParams, Navigate, useLocation, Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { useOrder } from "../hooks/useOrder";
import { formatPln } from "../lib/format";

export function OrderSummaryPage() {
  const { user } = useAuth();
  const location = useLocation();
  const params = useParams();
  const orderId = params.orderId ? Number(params.orderId) : NaN;

  const orderQuery = useOrder(
    Number.isSafeInteger(orderId) && orderId >= 1 ? orderId : undefined,
  );

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Zamówienie
        </h1>
        <div className="mt-6">
          <Alert tone="error">Nieprawidłowy identyfikator zamówienia.</Alert>
        </div>
        <Link
          to="/cart"
          className="mt-6 inline-block text-sm font-medium text-ink underline-offset-4 hover:underline"
        >
          Wróć do koszyka
        </Link>
      </div>
    );
  }

  const { data: order, isLoading, isError, error, refetch } = orderQuery;

  const cardClass = "rounded-2xl border border-line bg-surface p-6 shadow-card";

  return (
    <div className="w-full max-w-2xl">
      <header className="mb-10 border-b border-line pb-8">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-subtle">
          Zamówienie
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
          Podsumowanie #{orderId}
        </h1>
      </header>

      {isLoading ? (
        <Spinner className="py-16" />
      ) : isError ? (
        <div className="space-y-6">
          <Alert tone="error">
            {error instanceof ApiError
              ? error.message
              : "Nie udało się wczytać zamówienia."}
          </Alert>
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Spróbuj ponownie
          </Button>
        </div>
      ) : order ? (
        <div className="flex flex-col gap-6">
          <section className={cardClass}>
            <h2 className="font-display text-lg font-semibold text-ink">
              Dostawa
            </h2>
            <p className="mt-4 text-ink">
              <strong>{order.shipping_full_name}</strong>
            </p>
            <p className="mt-1 text-sm text-subtle">
              {order.shipping_address_line1}
              {order.shipping_address_line2
                ? `, ${order.shipping_address_line2}`
                : ""}
            </p>
            <p className="mt-1 text-sm text-subtle">
              {order.shipping_postal_code} {order.shipping_city},{" "}
              {order.shipping_country}
            </p>
            {order.shipping_notes ? (
              <p className="mt-4 text-sm leading-relaxed text-subtle">
                {order.shipping_notes}
              </p>
            ) : null}
          </section>

          <section className={cardClass}>
            <h2 className="font-display text-lg font-semibold text-ink">
              Produkty
            </h2>
            <ul className="mt-4 flex list-none flex-col gap-3 p-0">
              {order.items.map((it) => (
                <li
                  key={it.id}
                  className="flex flex-wrap justify-between gap-2 border-b border-dashed border-line/80 pb-3 text-sm last:border-0 last:pb-0"
                >
                  <span className="font-medium text-ink">
                    {it.product_name_snapshot}
                  </span>
                  <span className="tabular-nums text-subtle">
                    ×{it.quantity} · {formatPln(it.unit_price)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-line pt-4 text-base">
              Razem:{" "}
              <strong className="tabular-nums text-ink">
                {formatPln(order.total_amount)}
              </strong>
              <span className="text-subtle"> (status: {order.status})</span>
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              to={`/orders/${orderId}/status`}
              className="text-sm font-semibold text-ink underline-offset-4 hover:underline"
            >
              Status zamówienia
            </Link>
            <Link
              to="/profil/zamowienia"
              className="text-sm text-subtle hover:underline"
            >
              Historia zamówień
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
