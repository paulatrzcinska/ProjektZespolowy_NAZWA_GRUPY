import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as cartApi from "../api/cart";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../hooks/useCart";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { formatPln } from "../lib/format";

export function CartPage() {
  const { user } = useAuth();
  const { cart, loading, error, updateCart } = useCart();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          icon={ShoppingBag}
          title="Koszyk jest dostępny po zalogowaniu"
          description="Zaloguj się, aby dodać produkty i kontynuować zamówienie."
          action={
            <Link
              to="/login"
              state={{ from: "/cart" }}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-stone-900 bg-stone-900 px-5 py-2.5 text-[0.9375rem] font-semibold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-[0.99] no-underline"
            >
              Przejdź do logowania
            </Link>
          }
        />
      </div>
    );
  }

  async function updateQty(itemId: number, q: number) {
    setBusyId(itemId);
    setMsg(null);
    try {
      updateCart(await cartApi.updateCartItem(itemId, q));
    } catch (e) {
      if (e instanceof ApiError) setMsg(e.message);
      else setMsg("Błąd aktualizacji koszyka");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(itemId: number) {
    setBusyId(itemId);
    setMsg(null);
    try {
      updateCart(await cartApi.removeCartItem(itemId));
    } catch (e) {
      if (e instanceof ApiError) setMsg(e.message);
      else setMsg("Błąd usuwania pozycji");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full">
      <header className="mb-10 border-b border-line pb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Koszyk
        </h1>
        <p className="mt-2 text-subtle">Podsumowanie wybranych produktów</p>
      </header>

      {msg ? (
        <div className="mb-6">
          <Alert tone="error">{msg}</Alert>
        </div>
      ) : null}
      {error ? (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {loading ? (
        <Spinner className="py-20" />
      ) : !cart || cart.items.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Koszyk jest pusty"
          description="Dodaj produkty z katalogu — wrócisz tu, gdy coś wybierzesz."
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-stone-900 bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-800"
            >
              Przeglądaj katalog
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          }
        />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(280px,320px)] lg:items-start lg:gap-12">
          <ul className="flex flex-col gap-4">
            {cart.items.map((it) => (
              <li
                key={it.id}
                className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/products/${it.product_id}`}
                    className="font-display text-lg font-semibold text-ink no-underline transition-colors hover:text-stone-600"
                  >
                    {it.product.name}
                  </Link>
                  <p className="mt-1 text-sm tabular-nums text-subtle">
                    {formatPln(it.product.price)} × {it.quantity}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                  <div className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas/80 p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-8 min-w-8 rounded-full border-0 px-0 shadow-none"
                      disabled={busyId !== null || it.quantity <= 1}
                      onClick={() => void updateQty(it.id, it.quantity - 1)}
                      aria-label="Zmniejsz ilość"
                    >
                      −
                    </Button>
                    <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums">
                      {it.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-8 min-w-8 rounded-full border-0 px-0 shadow-none"
                      disabled={
                        busyId !== null ||
                        it.quantity >= Math.min(999, it.product.stock_quantity)
                      }
                      onClick={() => void updateQty(it.id, it.quantity + 1)}
                      aria-label="Zwiększ ilość"
                    >
                      +
                    </Button>
                  </div>
                  <p className="min-w-[5rem] text-right text-base font-semibold tabular-nums text-ink">
                    {formatPln(it.line_total)}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 rounded-full text-danger hover:border-red-200 hover:bg-red-50"
                    disabled={busyId !== null}
                    onClick={() => void remove(it.id)}
                  >
                    <Trash2
                      className="size-3.5"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    Usuń
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <aside className="rounded-2xl border border-line bg-surface p-6 shadow-soft lg:sticky lg:top-28">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
              Podsumowanie
            </p>
            <p className="mt-4 font-display text-2xl font-semibold tabular-nums text-ink">
              {formatPln(cart.subtotal)}
            </p>
            <Link
              to="/checkout"
              className="mt-5 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-full border border-stone-900 bg-stone-900 px-5 py-2.5 text-[0.9375rem] font-semibold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-[0.99] no-underline"
            >
              Przejdź do realizacji
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
