import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("visited public catalogue and product remain available offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Krzesło dębowe" }),
  ).toBeVisible();
  await page.getByRole("heading", { name: "Krzesło dębowe" }).click();
  await expect(page.getByText("Krzesło z litego drewna")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await caches.keys()).includes("catalog-details-v1"),
      ),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Krzesło z litego drewna")).toBeVisible();
  await expect(page.getByText(/Brak połączenia/)).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Katalog", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Krzesło dębowe" }),
  ).toBeVisible();
  const cacheNames = await page.evaluate(async () => caches.keys());
  expect(cacheNames).toContain("catalog-products-v1");
});

test("service worker never stores account, cart, orders or admin catalogue", async ({
  page,
}) => {
  await signIn(page, true);
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Administrator", exact: true }),
  ).toBeVisible();
  await page.goto("/cart");
  await expect(
    page.getByRole("link", { name: "Przejdź do realizacji" }),
  ).toBeVisible();
  await page.goto("/profil/zamowienia");
  await expect(page.getByText("Zamówienie #1", { exact: true })).toBeVisible();
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys())
        urls.push(request.url);
    }
    return urls;
  });
  expect(
    cached.some(
      (url) =>
        /\/api\/v1\/(auth|cart|orders)/.test(url) ||
        url.includes("include_inactive"),
    ),
  ).toBe(false);
});
