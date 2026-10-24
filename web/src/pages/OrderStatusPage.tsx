import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import type { OrderStatus } from "../api/types";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { useOrder } from "../hooks/useOrder";

const statuses: Record<
  OrderStatus,
  { tone: "info" | "success" | "error"; text: string }
> = {
  pending: {
    tone: "info",
    text: "Zamówienie oczekuje na realizację. Status odświeża się automatycznie.",
  },
  paid: { tone: "success", text: "Zamówienie opłacone. Dziękujemy!" },
  shipped: { tone: "success", text: "Zamówienie zostało wysłane." },
  cancelled: { tone: "error", text: "Zamówienie zostało anulowane." },
};

export function OrderStatusPage() {
  const { orderId: param } = useParams();
  const orderId = Number(param);
  const valid = Number.isSafeInteger(orderId) && orderId > 0;
  const query = useOrder(valid ? orderId : undefined, {
    refetchIntervalMsWhenPending: 5000,
  });
  const banner = query.data ? statuses[query.data.status] : null;
  return (
    <div className="w-full max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-semibold text-ink">
        Status zamówienia {valid ? `#${orderId}` : ""}
      </h1>
      {!valid ? (
        <Alert tone="error">Nieprawidłowy identyfikator zamówienia.</Alert>
      ) : query.isPending ? (
        <Spinner className="py-16" />
      ) : query.isError ? (
        <Alert tone="error">
          {query.error instanceof ApiError
            ? query.error.message
            : "Nie udało się pobrać zamówienia."}
        </Alert>
      ) : banner ? (
        <Alert tone={banner.tone}>{banner.text}</Alert>
      ) : null}
      {valid ? (
        <Button
          type="button"
          variant="ghost"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Odśwież status
        </Button>
      ) : null}
      <div>
        <Link to={valid ? `/orders/${orderId}/summary` : "/profil/zamowienia"}>
          Podsumowanie zamówienia
        </Link>
      </div>
    </div>
  );
}
