import { apiFetch } from "./client";
import type { Category } from "./types";

export async function fetchCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/api/v1/categories");
}

export type CategoryCreatePayload = {
  name: string;
  slug: string;
  description?: string | null;
};

export type CategoryUpdatePayload = {
  name?: string;
  slug?: string;
  description?: string | null;
};

export async function createCategory(
  payload: CategoryCreatePayload,
): Promise<Category> {
  return apiFetch<Category>("/api/v1/categories", {
    method: "POST",
    body: payload,
    auth: true,
  });
}

export async function updateCategory(
  id: number,
  payload: CategoryUpdatePayload,
): Promise<Category> {
  return apiFetch<Category>(`/api/v1/categories/${id}`, {
    method: "PATCH",
    body: payload,
    auth: true,
  });
}

export async function deleteCategory(id: number): Promise<void> {
  return apiFetch<void>(`/api/v1/categories/${id}`, {
    method: "DELETE",
    auth: true,
  });
}
