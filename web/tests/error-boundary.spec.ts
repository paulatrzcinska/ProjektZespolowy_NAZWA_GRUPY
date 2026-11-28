import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("unexpected API data shows an error screen instead of a blank page", async ({ page }) => {
  await signIn(page);
  // Incomplete order without `items` used to crash rendering and blank the page (#74).
  await page.route(/\/api\/v1\/orders\/1$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: 1, status: "pending", total_amount: "1.00" }),
    }),
  );
  await page.goto("/orders/1/summary");

  await expect(page.getByRole("heading", { name: "Coś poszło nie tak" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Odśwież stronę" })).toBeVisible();
  // The shop header stays, so the customer can navigate away.
  await expect(page.getByRole("link", { name: /Koszyk/ }).first()).toBeVisible();

  await page.unrouteAll();
  await page.getByRole("link", { name: "Katalog", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Coś poszło nie tak" })).toBeHidden();
});
