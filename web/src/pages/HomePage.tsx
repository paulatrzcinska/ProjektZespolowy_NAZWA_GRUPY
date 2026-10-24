import { PackageOpen, Search, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { fetchCategories } from "../api/categories";
import { fetchProductPage, type ProductSort } from "../api/products";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Spinner } from "../components/ui/Spinner";
import { ProductCard } from "../components/product/ProductCard";

const PAGE_SIZE = 12;
export function HomePage() {
  const [category, setCategory] = useState("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ProductSort>("newest");
  const [page, setPage] = useState(0);
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const products = useQuery({
    queryKey: ["products", category, search, sort, page],
    queryFn: () =>
      fetchProductPage({
        categoryId: category ? Number(category) : null,
        q: search || undefined,
        sort,
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
  });
  function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(0);
    setSearch(draft.trim());
  }
  const count = products.data?.total;
  const more =
    count != null
      ? (page + 1) * PAGE_SIZE < count
      : products.data?.items.length === PAGE_SIZE;
  return (
    <div className="w-full">
      <section className="mb-12 max-w-3xl lg:mb-16">
        <p className="mb-4 inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-subtle">
          <Sparkles className="size-3.5" aria-hidden />
          Dla Twojego psa
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-[3.25rem]">
          Z Dech Pies — sklep dla Twojego psa
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-subtle">
          Legowiska, smycze, zabawki i miski — wszystko, czego potrzebuje Twój
          pies, w jednym miejscu. Wybierz coś, za czym zamerda ogonem.
        </p>
      </section>
      <h2 className="mb-5 font-display text-xl font-semibold text-ink">
        Produkty
      </h2>
      <div className="mb-8 grid gap-4 border-b border-line pb-8 md:grid-cols-[2fr_1fr_1fr] md:items-end">
        <form onSubmit={onSearch} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Input
              label="Szukaj produktów"
              name="search"
              type="search"
              maxLength={200}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
          <Button type="submit" aria-label="Szukaj">
            <Search className="size-4" aria-hidden />
          </Button>
        </form>
        <Select
          label="Kategoria"
          name="category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(0);
          }}
        >
          <option value="">Wszystkie</option>
          {categories.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          label="Sortowanie"
          name="sort"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as ProductSort);
            setPage(0);
          }}
        >
          <option value="newest">Najnowsze</option>
          <option value="price_asc">Cena rosnąco</option>
          <option value="price_desc">Cena malejąco</option>
          <option value="name">Nazwa</option>
        </Select>
      </div>
      {categories.isError ? (
        <div className="mb-6">
          <Alert tone="info">
            Nie udało się pobrać kategorii. Katalog jest nadal dostępny.
          </Alert>
        </div>
      ) : null}
      {products.isPending ? (
        <Spinner className="py-20" />
      ) : products.isError ? (
        <div className="space-y-4">
          <Alert tone="error">
            Nie udało się załadować katalogu. Sprawdź połączenie i spróbuj
            ponownie.
          </Alert>
          <Button variant="ghost" onClick={() => void products.refetch()}>
            Spróbuj ponownie
          </Button>
        </div>
      ) : products.data.items.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Brak produktów"
          description="Zmień wyszukiwanie lub wybierz inną kategorię."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:gap-10">
          {products.data.items.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
      {!products.isError ? (
        <nav
          aria-label="Strony katalogu"
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Button
            variant="ghost"
            disabled={page === 0 || products.isFetching}
            onClick={() => setPage((value) => value - 1)}
          >
            Poprzednia
          </Button>
          <span className="text-sm text-subtle">
            Strona {page + 1}
            {count != null
              ? ` z ${Math.max(1, Math.ceil(count / PAGE_SIZE))}`
              : ""}
          </span>
          <Button
            variant="ghost"
            disabled={!more || products.isFetching}
            onClick={() => setPage((value) => value + 1)}
          >
            Następna
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
