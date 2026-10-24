import { apiFetch } from "./client";
import type { OrderDetail, OrderStatus } from "./types";

export async function fetchOrder(orderId: number): Promise<OrderDetail> {
  return apiFetch<OrderDetail>(`/api/v1/orders/${orderId}`, { auth: true });
}

export async function fetchMyOrders(): Promise<OrderDetail[]> {
  return apiFetch<OrderDetail[]>("/api/v1/orders", { auth: true });
}

export type CreateOrderPayload = {
  shipping_full_name: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  shipping_notes: string | null;
};

export async function createOrder(
  payload: CreateOrderPayload,
  idempotencyKey: string,
): Promise<OrderDetail> {
  return apiFetch<OrderDetail>("/api/v1/orders", {
    method: "POST",
    body: payload,
    auth: true,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export async function adminListOrders(
  params: {
    status?: OrderStatus;
    userId?: number;
    skip?: number;
    limit?: number;
  } = {},
): Promise<OrderDetail[]> {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.userId != null) sp.set("user_id", String(params.userId));
  if (params.skip != null) sp.set("skip", String(params.skip));
  if (params.limit != null) sp.set("limit", String(params.limit));
  const q = sp.toString();
  return apiFetch<OrderDetail[]>(
    `/api/v1/orders/admin/all${q ? `?${q}` : ""}`,
    { auth: true },
  );
}

export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
): Promise<OrderDetail> {
  return apiFetch<OrderDetail>(`/api/v1/orders/${orderId}/status`, {
    method: "PATCH",
    body: { status },
    auth: true,
  });
}
