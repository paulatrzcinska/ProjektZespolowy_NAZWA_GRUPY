import { ArrowLeft, PackageCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { createOrder, type CreateOrderPayload } from "../api/orders";
import { useAuth } from "../auth/AuthContext";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { TextArea } from "../components/ui/TextArea";
import { useCart } from "../hooks/useCart";
import { formatPln } from "../lib/format";

function toNull(s: string): string | null {
  const t = s.trim();
  return t ? t : null;
}

export function CheckoutPage() {
  const { user } = useAuth();
  const { cart, loading: cartLoading, refresh } = useCart();
  const navigate = useNavigate();
  const attempt = useRef<{ payload: string; key: string } | null>(null);

  const [shipName, setShipName] = useState("");
  const [shipLine1, setShipLine1] = useState("");
  const [shipLine2, setShipLine2] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipPostal, setShipPostal] = useState("");
  const [shipCountry, setShipCountry] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    setShipName(user.shipping_full_name ?? user.full_name ?? "");
    setShipLine1(user.shipping_address_line1 ?? "");
    setShipLine2(user.shipping_address_line2 ?? "");
    setShipCity(user.shipping_city ?? "");
    setShipPostal(user.shipping_postal_code ?? "");
    setShipCountry(user.shipping_country ?? "");
  }, [user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const name = shipName.trim();
    const line1 = shipLine1.trim();
    const city = shipCity.trim();
    const postal = shipPostal.trim();
    const country = shipCountry.trim();

    if (!name || !line1 || !city || !postal || !country) {
      setError("Uzupełnij wszystkie wymagane pola adresu.");
      return;
    }

    setPending(true);
    try {
      const payload: CreateOrderPayload = {
        shipping_full_name: name,
        shipping_address_line1: line1,
        shipping_address_line2: toNull(shipLine2),
        shipping_city: city,
        shipping_postal_code: postal,
        shipping_country: country,
        shipping_notes: toNull(notes),
      };
      const serialized = JSON.stringify(payload);
      if (attempt.current?.payload !== serialized)
        attempt.current = { payload: serialized, key: crypto.randomUUID() };
      const order = await createOrder(payload, attempt.current.key);
      await refresh();
      void navigate(`/orders/${order.id}/summary`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Nie udało się złożyć zamówienia. Spróbuj ponownie.");
    } finally {
      setPending(false);
    }
  }

  if (cartLoading) {
    return <Spinner className="py-20" />;
  }

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div className="w-full">
      <header className="mb-10 border-b border-line pb-8">
        <Link
          to="/cart"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-subtle transition-colors hover:text-ink no-underline"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
          Wróć do koszyka
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Realizacja zamówienia
        </h1>
        <p className="mt-2 text-subtle">
          Sprawdź podsumowanie i podaj adres wysyłki
        </p>
      </header>

      {isEmpty ? (
        <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <PackageCheck
            className="mx-auto mb-4 size-10 text-subtle"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="font-display text-lg font-semibold text-ink">
            Koszyk jest pusty
          </p>
          <p className="mt-2 text-sm text-subtle">
            Dodaj produkty do koszyka, zanim przejdziesz do realizacji
            zamówienia.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-stone-900 bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-800 no-underline"
          >
            Przeglądaj katalog
          </Link>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(280px,320px)] lg:items-start lg:gap-12">
          <form
            className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8"
            onSubmit={(e) => void onSubmit(e)}
          >
            <div className="border-b border-line pb-5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
                Adres wysyłki
              </p>
            </div>

            {error ? <Alert tone="error">{error}</Alert> : null}

            <Input
              label="Imię i nazwisko na przesyłce"
              name="shipName"
              autoComplete="shipping name"
              required
              value={shipName}
              onChange={(e) => setShipName(e.target.value)}
            />
            <Input
              label="Ulica i numer"
              name="shipLine1"
              autoComplete="address-line1"
              required
              value={shipLine1}
              onChange={(e) => setShipLine1(e.target.value)}
            />
            <Input
              label="Dopisek (np. mieszkanie)"
              name="shipLine2"
              autoComplete="address-line2"
              value={shipLine2}
              onChange={(e) => setShipLine2(e.target.value)}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Kod pocztowy"
                name="shipPostal"
                autoComplete="postal-code"
                required
                value={shipPostal}
                onChange={(e) => setShipPostal(e.target.value)}
              />
              <Input
                label="Miasto"
                name="shipCity"
                autoComplete="address-level2"
                required
                value={shipCity}
                onChange={(e) => setShipCity(e.target.value)}
              />
            </div>
            <Input
              label="Kraj"
              name="shipCountry"
              autoComplete="country-name"
              required
              value={shipCountry}
              onChange={(e) => setShipCountry(e.target.value)}
            />
            <TextArea
              label="Uwagi do zamówienia (opcjonalnie)"
              name="notes"
              placeholder="Np. zadzwoń przed dostawą…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "Składanie zamówienia…" : "Złóż zamówienie"}
            </Button>
          </form>

          <aside className="rounded-2xl border border-line bg-surface p-6 shadow-soft lg:sticky lg:top-28">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
              Podsumowanie
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {cart.items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate text-ink">
                    {it.product.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-subtle">
                    × {it.quantity}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-ink">
                    {formatPln(it.line_total)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-line pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-subtle">Razem</span>
                <span className="font-display text-2xl font-semibold tabular-nums text-ink">
                  {formatPln(cart.subtotal)}
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
