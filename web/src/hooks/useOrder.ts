import { useQuery } from "@tanstack/react-query";
import { fetchOrder } from "../api/orders";
import { useAuth } from "../auth/AuthContext";

export function useOrder(
  orderId: number | undefined,
  options?: { refetchIntervalMsWhenPending?: number },
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["order", user?.id, orderId],
    queryFn: () => fetchOrder(orderId!),
    enabled:
      Boolean(user) &&
      orderId != null &&
      Number.isSafeInteger(orderId) &&
      orderId >= 1,
    refetchInterval: (query) =>
      query.state.data?.status === "pending"
        ? (options?.refetchIntervalMsWhenPending ?? false)
        : false,
  });
}
