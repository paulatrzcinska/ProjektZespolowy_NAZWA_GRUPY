import { expect, test } from "@playwright/test";

test("catalogue shows an error when the real backend is stopped", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /Legowisko E2E/ })).toHaveCount(0);
});
