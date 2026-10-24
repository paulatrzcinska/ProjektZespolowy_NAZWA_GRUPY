import { ArrowLeft, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as cartApi from "../api/cart";
import { ApiError } from "../api/client";
import { fetchProduct } from "../api/products";
import type { ProductDetail } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../hooks/useCart";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { formatPln } from "../lib/format";
import { cn } from "../lib/cn";

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateCart } = useCart();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pid = Number(id);
    if (!Number.isSafeInteger(pid) || pid < 1) {
      setError("Nieprawidłowy identyfikator produktu");
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setProduct(null);
      setQty(1);
      setError(null);
      try {
        const p = await fetchProduct(pid);
        if (!cancelled) setProduct(p);
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiError && e.status === 404)
            setError("Produkt nie został znaleziony.");
          else setError("Nie udało się wczytać produktu.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onAdd() {
    if (!product || !user) {
      navigate("/login", { state: { from: `/products/${product?.id ?? id}` } });
      return;
    }
    setAdding(true);
    setError(null);
    try {
      updateCart(await cartApi.addCartItem(product.id, qty));
      navigate("/cart");
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Nie udało się dodać do koszyka.");
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return <Spinner className="min-h-[40vh] py-24" />;
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-lg">
        {error ? (
          <div className="mb-6">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-subtle no-underline hover:text-ink"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
          Wróć do katalogu
        </Link>
      </div>
    );
  }

  const cap = Math.max(1, Math.min(999, product.stock_quantity));
  const out = product.stock_quantity < 1 || !product.is_active;

  return (
    <div className="w-full">
      {error ? (
        <div className="mb-8">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <Link
        to="/"
        className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-subtle no-underline transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
        Katalog
      </Link>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-16">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt=""
              className="max-h-[min(70vh,36rem)] w-full object-cover"
            />
          ) : (
            <div
              className="aspect-[4/3] w-full bg-gradient-to-br from-stone-200 via-stone-100 to-stone-50"
              aria-hidden
            />
          )}
        </div>

        <div className="flex flex-col lg:pt-2">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-subtle">
            Produkt
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-5 text-2xl font-semibold tabular-nums text-ink">
            {formatPln(product.price)}
          </p>

          {product.description ? (
            <p className="mt-8 max-w-prose text-[0.9375rem] leading-[1.7] text-subtle">
              {product.description}
            </p>
          ) : null}

          <p className="mt-8 text-sm text-subtle">
            Stan magazynowy:{" "}
            <span
              className={cn("font-semibold text-ink", out && "text-danger")}
            >
              {product.stock_quantity}
            </span>
          </p>

          <div className="mt-10 space-y-8 border-t border-line pt-10">
            <div>
              <span className="mb-3 block text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
                Ilość
              </span>
              <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1.5 shadow-[inset_0_1px_0_rgb(0_0_0/0.02)]">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full border-0 shadow-none"
                  disabled={qty <= 1}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Zmniejsz ilość"
                >
                  <Minus className="size-4" strokeWidth={1.75} />
                </Button>
                <span className="min-w-[2.75rem] text-center text-sm font-semibold tabular-nums text-ink">
                  {qty}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full border-0 shadow-none"
                  disabled={qty >= cap}
                  onClick={() => setQty((q) => Math.min(cap, q + 1))}
                  aria-label="Zwiększ ilość"
                >
                  <Plus className="size-4" strokeWidth={1.75} />
                </Button>
              </div>
            </div>

            <Button
              type="button"
              className="w-full max-w-sm sm:w-auto"
              onClick={() => void onAdd()}
              disabled={adding || out}
            >
              {user
                ? adding
                  ? "Dodawanie…"
                  : "Dodaj do koszyka"
                : "Zaloguj się, by kupić"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
