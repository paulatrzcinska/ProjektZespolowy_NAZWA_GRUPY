import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { fetchCart } from "../api/cart";
import type { Cart } from "../api/types";
import { useAuth } from "../auth/AuthContext";

export function useCart() {
  const { user } = useAuth();
  const client = useQueryClient();
  const key = ["cart", user?.id];
  const query = useQuery({
    queryKey: key,
    queryFn: fetchCart,
    enabled: Boolean(user),
  });
  return {
    cart: user ? (query.data ?? null) : null,
    loading: Boolean(user) && query.isPending,
    error: query.error
      ? query.error instanceof ApiError
        ? query.error.message
        : "Nie udało się pobrać koszyka."
      : null,
    refresh: () => query.refetch(),
    updateCart: (cart: Cart) => client.setQueryData(key, cart),
  };
}
