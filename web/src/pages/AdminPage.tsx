import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCategories } from "../api/categories";
import { ApiError } from "../api/client";
import * as productsApi from "../api/products";
import type { Category, ProductDetail, ProductListItem } from "../api/types";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Spinner } from "../components/ui/Spinner";
import { TextArea } from "../components/ui/TextArea";
import { formatPln, slugify } from "../lib/format";
import { cn } from "../lib/cn";

type Draft = {
  name: string;
  slug: string;
  description: string;
  price: string;
  stock_quantity: number;
  category_id: number;
  image_url: string;
  is_active: boolean;
};

function emptyDraft(categoryId: number): Draft {
  return {
    name: "",
    slug: "",
    description: "",
    price: "99.00",
    stock_quantity: 0,
    category_id: categoryId,
    image_url: "",
    is_active: true,
  };
}

function fromProduct(p: ProductDetail): Draft {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description ?? "",
    price: p.price,
    stock_quantity: p.stock_quantity,
    category_id: p.category_id,
    image_url: p.image_url ?? "",
    is_active: p.is_active,
  };
}

export function AdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | number>("all");

  async function refreshLists() {
    const cats = await fetchCategories();
    setCategories(cats);
    const prods = await productsApi.fetchAllProducts({ includeInactive: true });
    setProducts(prods);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cats = await fetchCategories();
        if (cancelled) return;
        setCategories(cats);
        const prods = await productsApi.fetchAllProducts({
          includeInactive: true,
        });
        if (cancelled) return;
        setProducts(prods);
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiError) setError(e.message);
          else setError("Nie udało się wczytać danych admina.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function startNew() {
    const first = categories[0]?.id ?? 1;
    setEditingId("new");
    setDraft(emptyDraft(first));
  }

  async function startEdit(id: number) {
    setError(null);
    try {
      const p = await productsApi.fetchProduct(id, true);
      setEditingId(id);
      setDraft(fromProduct(p));
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Nie udało się wczytać produktu.");
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draft.name,
        slug: draft.slug,
        description: draft.description.trim() ? draft.description : null,
        price: draft.price,
        stock_quantity: draft.stock_quantity,
        category_id: draft.category_id,
        image_url: draft.image_url.trim() ? draft.image_url.trim() : null,
        is_active: draft.is_active,
      };
      if (editingId === "new") {
        await productsApi.createProduct(payload);
      } else if (typeof editingId === "number") {
        await productsApi.updateProduct(editingId, payload);
      }
      cancelEdit();
      await refreshLists();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Zapis nie powiódł się.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    if (!window.confirm("Ukryć produkt w katalogu?")) return;
    setError(null);
    try {
      await productsApi.deleteProduct(id);
      if (editingId === id) cancelEdit();
      await refreshLists();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Nie udało się ukryć produktu.");
    }
  }

  const dashboardStats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.is_active).length;
    const hidden = total - active;
    const inventory = products.reduce((sum, p) => sum + p.stock_quantity, 0);
    return { total, active, hidden, inventory };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter === "active" && !p.is_active) return false;
      if (statusFilter === "inactive" && p.is_active) return false;
      if (categoryFilter !== "all" && p.category_id !== categoryFilter)
        return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
      );
    });
  }, [products, query, statusFilter, categoryFilter]);

  if (loading) {
    return <Spinner className="min-h-[50vh] py-24" />;
  }

  return (
    <div className="w-full">
      <div className="mb-10 flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-subtle">
            Panel
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Administrator
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-subtle">
            Zarządzaj ofertą, cenami i dostępnością produktów.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Link
            to="/admin/orders"
            className="inline-flex min-h-9 items-center justify-center rounded-full border border-line bg-surface/90 px-4 py-2 text-sm font-semibold text-ink no-underline transition-colors hover:border-stone-300 hover:bg-canvas"
          >
            Zamówienia
          </Link>
          <Link
            to="/admin/categories"
            className="inline-flex min-h-9 items-center justify-center rounded-full border border-line bg-surface/90 px-4 py-2 text-sm font-semibold text-ink no-underline transition-colors hover:border-stone-300 hover:bg-canvas"
          >
            Kategorie
          </Link>
          <Button
            type="button"
            onClick={() => startNew()}
            disabled={categories.length === 0}
            className="gap-2"
          >
            <Plus className="size-4" strokeWidth={1.75} aria-hidden />
            Nowy produkt
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {categories.length === 0 ? (
        <div className="mb-8">
          <Alert tone="info">
            Brak kategorii w bazie — dodaj je przez API lub SQL, zanim utworzysz
            produkt.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[1fr_minmax(300px,380px)] lg:items-start xl:gap-12">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-xl border border-line bg-surface px-4 py-3 shadow-soft">
              <p className="text-xs uppercase tracking-[0.1em] text-subtle">
                Wszystkie
              </p>
              <p className="mt-1 text-2xl font-semibold text-ink">
                {dashboardStats.total}
              </p>
            </article>
            <article className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 shadow-soft">
              <p className="text-xs uppercase tracking-[0.1em] text-emerald-800">
                Aktywne
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-900">
                {dashboardStats.active}
              </p>
            </article>
            <article className="rounded-xl border border-stone-200 bg-stone-100/70 px-4 py-3 shadow-soft">
              <p className="text-xs uppercase tracking-[0.1em] text-stone-600">
                Ukryte
              </p>
              <p className="mt-1 text-2xl font-semibold text-stone-800">
                {dashboardStats.hidden}
              </p>
            </article>
            <article className="rounded-xl border border-line bg-surface px-4 py-3 shadow-soft">
              <p className="text-xs uppercase tracking-[0.1em] text-subtle">
                Sztuki na stanie
              </p>
              <p className="mt-1 text-2xl font-semibold text-ink">
                {dashboardStats.inventory}
              </p>
            </article>
          </div>

          <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft sm:grid-cols-3">
            <Input
              label="Szukaj"
              name="search"
              placeholder="Nazwa lub slug"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              label="Status"
              name="status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "active" | "inactive")
              }
            >
              <option value="all">Wszystkie</option>
              <option value="active">Tylko aktywne</option>
              <option value="inactive">Tylko ukryte</option>
            </Select>
            <Select
              label="Kategoria"
              name="category_filter"
              value={String(categoryFilter)}
              onChange={(e) =>
                setCategoryFilter(
                  e.target.value === "all" ? "all" : Number(e.target.value),
                )
              }
            >
              <option value="all">Wszystkie kategorie</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-canvas/50">
                    <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                      Nazwa
                    </th>
                    <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                      Cena
                    </th>
                    <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                      Stan
                    </th>
                    <th className="px-4 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                      Status
                    </th>
                    <th className="px-4 py-3.5 text-right text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                      Akcje
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-line/80 transition-colors hover:bg-canvas/30"
                    >
                      <td className="px-4 py-4 font-medium text-ink">
                        {p.name}
                      </td>
                      <td className="px-4 py-4 tabular-nums text-subtle">
                        {formatPln(p.price)}
                      </td>
                      <td className="px-4 py-4 tabular-nums text-subtle">
                        {p.stock_quantity}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider",
                            p.is_active
                              ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80"
                              : "bg-stone-100 text-stone-600 ring-1 ring-stone-200",
                          )}
                        >
                          {p.is_active ? "Aktywny" : "Ukryty"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void startEdit(p.id)}
                          >
                            Edytuj
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => void onDelete(p.id)}
                          >
                            Ukryj
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-sm text-subtle"
                      >
                        Brak produktów spełniających wybrane filtry.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {editingId !== null && draft ? (
          <aside className="rounded-2xl border border-line bg-surface p-6 shadow-soft lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            <h2 className="font-display text-xl font-semibold text-ink">
              {editingId === "new" ? "Nowy produkt" : "Edycja produktu"}
            </h2>
            <div className="mt-6 flex flex-col gap-5">
              <Input
                label="Nazwa"
                name="name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Input
                    label="Slug"
                    name="slug"
                    value={draft.slug}
                    onChange={(e) =>
                      setDraft({ ...draft, slug: e.target.value })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    setDraft({ ...draft, slug: slugify(draft.name) })
                  }
                >
                  Z nazwy
                </Button>
              </div>
              <TextArea
                label="Opis"
                name="description"
                rows={4}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
              <Input
                label="Cena (PLN)"
                name="price"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
              <Input
                label="Stan magazynowy"
                name="stock"
                type="number"
                min={0}
                value={String(draft.stock_quantity)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    stock_quantity: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
              <Select
                label="Kategoria"
                name="category_id"
                value={String(draft.category_id)}
                onChange={(e) =>
                  setDraft({ ...draft, category_id: Number(e.target.value) })
                }
              >
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Input
                label="URL zdjęcia (opcjonalnie)"
                name="image_url"
                value={draft.image_url}
                onChange={(e) =>
                  setDraft({ ...draft, image_url: e.target.value })
                }
              />
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-canvas/40 px-3 py-3">
                <input
                  type="checkbox"
                  className="size-4 rounded border-line text-stone-900 focus:ring-stone-900/20"
                  checked={draft.is_active}
                  onChange={(e) =>
                    setDraft({ ...draft, is_active: e.target.checked })
                  }
                />
                <span className="text-sm font-medium text-ink">
                  Aktywny w sklepie
                </span>
              </label>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => void onSave()}
                  disabled={saving}
                >
                  {saving ? "Zapisywanie…" : "Zapisz"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => cancelEdit()}
                >
                  Anuluj
                </Button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
