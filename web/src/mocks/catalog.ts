/**
 * Dane makietowe katalogu (Blok 4 / E3).
 *
 * Włączane przez `VITE_USE_MOCK_API=true` w `.env`. Zastępują wyłącznie
 * publiczne odczyty katalogu (lista produktów, szczegóły, kategorie),
 * zachowując kontrakt z `docs/api-contract.md`: te same typy, te same
 * parametry filtrowania/sortowania/paginacji co backend. Dzięki temu
 * przełączenie na prawdziwe API to tylko zmiana zmiennej środowiskowej.
 */
import { ApiError } from "../api/client";
import type { Category, ProductDetail, ProductListItem } from "../api/types";
import type { ListProductsParams } from "../api/products";
import categoriesJson from "./data/categories.json";
import productsJson from "./data/products.json";

export const USE_MOCK_API =
  String(import.meta.env.VITE_USE_MOCK_API ?? "").toLowerCase() === "true";

const MOCK_DELAY_MS = 250;

const categories: Category[] = categoriesJson as Category[];
const products: ProductDetail[] = productsJson as ProductDetail[];

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS));
}

function toListItem(product: ProductDetail): ProductListItem {
  const { description: _description, ...item } = product;
  return item;
}

export function mockCategories(): Promise<Category[]> {
  return delay(categories.map((category) => ({ ...category })));
}

export function mockProductPage(
  params: ListProductsParams = {},
): Promise<{ items: ProductListItem[]; total: number | null }> {
  let items = products.filter((product) =>
    params.includeInactive ? true : product.is_active,
  );
  if (params.categoryId) {
    items = items.filter((product) => product.category_id === params.categoryId);
  }
  if (params.q) {
    const needle = params.q.toLowerCase();
    items = items.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        (product.description ?? "").toLowerCase().includes(needle),
    );
  }
  if (params.minPrice != null && params.minPrice !== "") {
    const min = Number(params.minPrice);
    items = items.filter((product) => Number(product.price) >= min);
  }
  if (params.maxPrice != null && params.maxPrice !== "") {
    const max = Number(params.maxPrice);
    items = items.filter((product) => Number(product.price) <= max);
  }
  switch (params.sort) {
    case "price_asc":
      items.sort((a, b) => Number(a.price) - Number(b.price));
      break;
    case "price_desc":
      items.sort((a, b) => Number(b.price) - Number(a.price));
      break;
    case "name":
      items.sort((a, b) => a.name.localeCompare(b.name, "pl"));
      break;
    case "newest":
    default:
      items.sort((a, b) => b.id - a.id);
  }
  const total = items.length;
  const skip = params.skip ?? 0;
  const limit = params.limit ?? total;
  const page = items.slice(skip, skip + limit).map(toListItem);
  return delay({ items: page, total });
}

export function mockProduct(id: number): Promise<ProductDetail> {
  const product = products.find((item) => item.id === id && item.is_active);
  if (!product) {
    return Promise.reject(
      new ApiError("Nie znaleziono produktu.", 404, {
        detail: "Product not found",
      }),
    );
  }
  return delay({ ...product });
}
