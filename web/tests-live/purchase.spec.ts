import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { OrderDetail } from "../src/api/types";

test("customer purchases a product and finds the persisted order", async ({ page }) => {
  const productName = "Smycz taśmowa 2 m";
  let order: OrderDetail;

  await test.step("Choose a product from the real catalogue", async () => {
    await page.goto("/");
    await page.getByRole("heading", { name: productName, exact: true }).click();
    await expect(page).toHaveURL(/\/products\/\d+$/);
    await page.getByRole("button", { name: "Zaloguj się, by kupić" }).click();
  });

  await test.step("Register a new customer and return to the product", async () => {
    await page.getByRole("button", { name: "Rejestracja", exact: true }).click();
    await page.getByLabel("E-mail", { exact: true }).fill(`e2e-${randomUUID()}@example.com`);
    await page.getByLabel("Imię i nazwisko (opcjonalnie)").fill("Jan Testowy");
    await page.getByLabel("Hasło", { exact: true }).fill(`E2e-${randomUUID()}!`);
    await page.getByRole("button", { name: "Utwórz konto", exact: true }).click();
    await expect(page.getByRole("heading", { name: productName, exact: true })).toBeVisible();
  });

  await test.step("Add two items and verify the saved cart", async () => {
    await page.getByRole("button", { name: "Zwiększ ilość" }).click();
    await page.getByRole("button", { name: "Dodaj do koszyka", exact: true }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await page.reload();
    await expect(page.getByRole("main").getByRole("link", { name: productName })).toBeVisible();
    await expect(page.locator("aside")).toContainText(/78,00\s*zł/);
    await page.getByRole("link", { name: "Przejdź do realizacji" }).click();
  });

  await test.step("Submit shipping details and verify the order response", async () => {
    await page.getByLabel("Imię i nazwisko na przesyłce").fill("Jan Testowy");
    await page.getByLabel("Ulica i numer", { exact: true }).fill("Testowa 1");
    await page.getByLabel("Kod pocztowy", { exact: true }).fill("00-001");
    await page.getByLabel("Miasto", { exact: true }).fill("Warszawa");
    await page.getByLabel("Kraj", { exact: true }).fill("Polska");
    const created = page.waitForResponse((response) =>
      response.url().endsWith("/api/v1/orders") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Złóż zamówienie", exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.request().headers()["idempotency-key"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    order = await response.json();
    expect(order.total_amount).toBe("78.00");
    expect(order.status).toBe("pending");
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ product_name_snapshot: productName, quantity: 2 });
    await expect(page.getByRole("heading", { name: `Podsumowanie #${order.id}` })).toBeVisible();
  });

  await test.step("Reload the order, check history and the emptied cart", async () => {
    await page.reload();
    await expect(page.getByRole("main")).toContainText("Jan Testowy");
    await expect(page.getByRole("main")).toContainText("Testowa 1");
    await expect(page.getByRole("main")).toContainText(productName);
    await expect(page.getByRole("main")).toContainText(/78,00\s*zł/);
    await page.getByRole("link", { name: "Historia zamówień", exact: true }).click();
    await expect(page.getByText(`Zamówienie #${order.id}`, { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Status", exact: true }).click();
    await expect(page.getByText(/Zamówienie oczekuje na realizację/)).toBeVisible();
    await page.getByRole("navigation", { name: "Główne" }).getByRole("link", { name: /Koszyk/ }).click();
    await expect(page.getByRole("heading", { name: "Koszyk jest pusty" })).toBeVisible();
  });
});
