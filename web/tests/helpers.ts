import { expect, type Page } from "@playwright/test";

export async function signIn(page: Page, admin = false) {
  await page.addInitScript(
    (token) => localStorage.setItem("furniture_access_token", token),
    admin ? "example-admin-token" : "example-user-token",
  );
}

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("user@example.com");
  await page.getByLabel("Hasło", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Zaloguj", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Profil", exact: true }),
  ).toBeVisible();
}
