import { expect, type Page } from "@playwright/test";

export async function loginAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Hasło", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Zaloguj", exact: true }).click();
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
}

export async function headers(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem("furniture_access_token"));
  if (!token) throw new Error("Real login did not return a token");
  return { Authorization: `Bearer ${token}` };
}
