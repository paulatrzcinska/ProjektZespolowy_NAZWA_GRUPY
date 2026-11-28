import { apiUrl } from "./config";
import { errorMessage, NETWORK_ERROR } from "./errorMessages";
import { getStoredToken } from "./token";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

export async function apiResponse<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; headers: Headers }> {
  const { body, auth = false, headers: suppliedHeaders, ...rest } = options;
  const headers = new Headers(suppliedHeaders);
  const token = auth ? getStoredToken() : null;
  if (body !== undefined && !(body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...rest,
      headers,
      cache: auth ? "no-store" : "default",
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    // fetch rejects without a response when the network or the server is unreachable.
    throw new ApiError(NETWORK_ERROR, 0, null);
  }
  const text = response.status === 204 ? "" : await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    if (auth && response.status === 401 && token === getStoredToken())
      onUnauthorized?.();
    throw new ApiError(errorMessage(response.status, data), response.status, data);
  }
  return {
    data: (response.status === 204 ? undefined : data) as T,
    headers: response.headers,
  };
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return (await apiResponse<T>(path, options)).data;
}
