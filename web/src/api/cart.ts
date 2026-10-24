import { apiFetch } from "./client";
import type { Cart } from "./types";

export async function fetchCart(): Promise<Cart> {
  return apiFetch<Cart>("/api/v1/cart", { auth: true });
}

export async function addCartItem(
  productId: number,
  quantity: number,
): Promise<Cart> {
  return apiFetch<Cart>("/api/v1/cart/items", {
    method: "POST",
    body: { product_id: productId, quantity },
    auth: true,
  });
}

export async function updateCartItem(
  itemId: number,
  quantity: number,
): Promise<Cart> {
  return apiFetch<Cart>(`/api/v1/cart/items/${itemId}`, {
    method: "PATCH",
    body: { quantity },
    auth: true,
  });
}

export async function removeCartItem(itemId: number): Promise<Cart> {
  return apiFetch<Cart>(`/api/v1/cart/items/${itemId}`, {
    method: "DELETE",
    auth: true,
  });
}
