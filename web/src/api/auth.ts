import { apiFetch } from "./client";
import type { TokenResponse, User } from "./types";

export async function login(
  email: string,
  password: string,
): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function register(
  email: string,
  password: string,
  full_name?: string | null,
): Promise<User> {
  return apiFetch<User>("/api/v1/auth/register", {
    method: "POST",
    body: { email, password, full_name: full_name ?? null },
  });
}

export async function fetchMe(): Promise<User> {
  return apiFetch<User>("/api/v1/auth/me", { auth: true });
}

export type ProfileUpdatePayload = {
  full_name: string | null;
  shipping_full_name: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
};

export async function patchProfile(body: ProfileUpdatePayload): Promise<User> {
  return apiFetch<User>("/api/v1/auth/me", {
    method: "PATCH",
    auth: true,
    body,
  });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiFetch<void>("/api/v1/auth/change-password", {
    method: "POST",
    auth: true,
    body: { current_password: currentPassword, new_password: newPassword },
  });
}
