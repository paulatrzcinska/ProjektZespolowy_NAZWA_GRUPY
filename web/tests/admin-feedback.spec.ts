import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("invalid product fields do not send mutations", async ({ page }) => {
  await signIn(page, true);
  await page.goto("/admin");
  let writes = 0;
  page.on("request", request => {
    if (request.url().includes("/products") && ["POST", "PATCH"].includes(request.method())) writes++;
  });
  await page.getByRole("button", { name: "Nowy produkt" }).click();
  const save = page.getByRole("button", { name: "Zapisz", exact: true });
  await save.click();
  await expect(page.getByRole("alert")).toContainText("Nazwa musi");
  await page.getByLabel("Nazwa", { exact: true }).fill("Produkt testowy");
  await page.getByLabel("Slug", { exact: true }).fill("ZŁY SLUG");
  await save.click();
  await expect(page.getByRole("alert")).toContainText("Slug musi");
  await page.getByLabel("Slug", { exact: true }).fill("produkt-testowy");
  for (const price of ["0", "-1", "1.234", "10000000000", "abc"]) {
    await page.getByLabel("Cena (PLN)").fill(price);
    await save.click();
    await expect(page.getByRole("alert")).toContainText("Cena musi");
  }
  await page.getByLabel("Cena (PLN)").fill("19.99");
  for (const stock of ["", "-1", "1.5"]) {
    await page.getByLabel("Stan magazynowy").fill(stock);
    await save.click();
    await expect(page.getByRole("alert")).toContainText("Stan magazynowy musi");
  }
  await page.getByLabel("Stan magazynowy").fill("3");
  await page.getByLabel("URL zdjęcia (opcjonalnie)").fill("javascript:alert(1)");
  await save.click();
  await expect(page.getByRole("alert")).toContainText("adres zdjęcia");
  expect(writes).toBe(0);
});

test("pending save locks controls and reports success even if refresh fails", async ({ page }) => {
  await signIn(page, true);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Nowy produkt" }).click();
  await page.getByLabel("Nazwa", { exact: true }).fill("Test");
  await page.getByLabel("Slug", { exact: true }).fill("test");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/v1/products", async route => {
    if (route.request().method() !== "POST") return route.continue();
    await gate;
    await route.continue();
  });
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByRole("button", { name: "Zapisywanie…" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Nowy produkt" })).toBeDisabled();
  await expect(page.getByLabel("Nazwa", { exact: true })).toBeDisabled();
  await page.route("**/api/v1/categories", route => route.fulfill({ status: 503, json: { detail: "Offline" } }));
  release();
  await expect(page.getByText("Zapisano produkt.", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Zmiana została zapisana");
  await expect(page.getByRole("button", { name: "Nowy produkt" })).toBeEnabled();
});

test("category length is checked before a request", async ({ page }) => {
  await signIn(page, true);
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "Nowa kategoria" }).click();
  await page.getByLabel("Nazwa", { exact: true }).fill("x".repeat(201));
  await page.getByLabel("Slug", { exact: true }).fill("kategoria");
  let writes = 0;
  page.on("request", r => { if (r.method() === "POST") writes++; });
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("200 znaków");
  expect(writes).toBe(0);
});
