import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { loginAdmin } from "./helpers";

test("saved product remains after a separately performed server restart", async ({ page }) => {
  // Run phase crud, stop/restart API and PostgreSQL, then explicitly run phase restart.
  const saved = JSON.parse(readFileSync(".e2e-checkpoint.json", "utf8"));
  await loginAdmin(page);
  const response = await page.request.get(`/api/v1/products/${saved.productId}`);
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ slug: saved.productSlug, price: saved.price, stock_quantity: saved.stock, is_active: true });
  await page.goto(`/products/${saved.productId}`);
  await expect(page.getByRole("heading", { name: saved.productName, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: saved.productName, exact: true })).toBeVisible();
});
