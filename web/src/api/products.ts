import { apiFetch, apiResponse } from "./client";
import type { ProductDetail, ProductListItem } from "./types";
import { USE_MOCK_API, mockProduct, mockProductPage } from "../mocks/catalog";

export type ProductSort = "newest" | "price_asc" | "price_desc" | "name";

export type ListProductsParams = {
  q?: string;
  sort?: ProductSort;
  minPrice?: string;
  maxPrice?: string;
  skip?: number;
  limit?: number;
  categoryId?: number | null;
  includeInactive?: boolean;
};

export async function fetchProductPage(
  params: ListProductsParams = {},
): Promise<{ items: ProductListItem[]; total: number | null }> {
  if (USE_MOCK_API) return mockProductPage(params);
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.sort) sp.set("sort", params.sort);
  if (params.minPrice != null) sp.set("min_price", params.minPrice);
  if (params.maxPrice != null) sp.set("max_price", params.maxPrice);
  if (params.skip != null) sp.set("skip", String(params.skip));
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.categoryId) sp.set("category_id", String(params.categoryId));
  if (params.includeInactive) sp.set("include_inactive", "true");
  const q = sp.toString();
  const path = q ? `/api/v1/products?${q}` : "/api/v1/products";
  const { data, headers } = await apiResponse<ProductListItem[]>(path, {
    auth: params.includeInactive === true,
  });
  const value = headers.get("X-Total-Count");
  const total = value !== null && /^\d+$/.test(value) ? Number(value) : null;
  return { items: data, total };
}

export async function fetchProducts(
  params: ListProductsParams = {},
): Promise<ProductListItem[]> {
  return (await fetchProductPage(params)).items;
}

export async function fetchAllProducts(
  params: Omit<ListProductsParams, "skip" | "limit"> = {},
): Promise<ProductListItem[]> {
  const pageSize = 100;
  const all: ProductListItem[] = [];
  let skip = 0;
  for (;;) {
    const batch = await fetchProducts({ ...params, skip, limit: pageSize });
    all.push(...batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }
  return all;
}

export async function fetchProduct(
  id: number,
  authenticated = false,
): Promise<ProductDetail> {
  if (USE_MOCK_API) return mockProduct(id);
  return apiFetch<ProductDetail>(`/api/v1/products/${id}`, {
    auth: authenticated,
  });
}

export async function createProduct(body: {
  name: string;
  slug: string;
  description?: string | null;
  price: string;
  stock_quantity: number;
  category_id: number;
  image_url?: string | null;
  is_active?: boolean;
}): Promise<ProductDetail> {
  return apiFetch<ProductDetail>("/api/v1/products", {
    method: "POST",
    body: {
      ...body,
      image_url: body.image_url || null,
    },
    auth: true,
  });
}

export async function updateProduct(
  id: number,
  body: Partial<{
    name: string;
    slug: string;
    description: string | null;
    price: string;
    stock_quantity: number;
    category_id: number;
    image_url: string | null;
    is_active: boolean;
  }>,
): Promise<ProductDetail> {
  return apiFetch<ProductDetail>(`/api/v1/products/${id}`, {
    method: "PATCH",
    body,
    auth: true,
  });
}

export async function deleteProduct(id: number): Promise<void> {
  await apiFetch<void>(`/api/v1/products/${id}`, {
    method: "DELETE",
    auth: true,
  });
}
