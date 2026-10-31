import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { headers, loginAdmin } from "./helpers";

test("real HTTP CRUD persists through reload; FK conflicts and soft delete", async ({ page }) => {
  await loginAdmin(page);
  const suffix = Date.now().toString();
  const categoryName = `Kategoria E2E ${suffix}`;
  const productName = `Legowisko E2E ${suffix}`;
  const categorySlug = `e2e-category-${suffix}`;
  const productSlug = `e2e-product-${suffix}`;
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "Nowa kategoria" }).click();
  await page.getByLabel("Nazwa", { exact: true }).fill(categoryName);
  await page.getByLabel("Slug", { exact: true }).fill(categorySlug);
  const createdCategory = page.waitForResponse(r => r.url().endsWith("/categories") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  const categoryResponse = await createdCategory;
  expect(categoryResponse.status()).toBe(201);
  const category = await categoryResponse.json();
  await expect(page.getByText("Zapisano kategorię.", { exact: true })).toBeVisible();
  await page.reload();
  const categoryRow = page.getByRole("row").filter({ has: page.getByText(categoryName, { exact: true }) });
  await categoryRow.getByRole("button", { name: "Edytuj" }).click();
  await page.getByLabel("Opis (opcjonalnie)").fill("Opis zapisany w PostgreSQL");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(categoryRow).toContainText("Opis zapisany w PostgreSQL");

  await page.goto("/admin");
  await page.getByRole("button", { name: "Nowy produkt" }).click();
  await page.getByLabel("Nazwa", { exact: true }).fill(productName);
  await page.getByLabel("Slug", { exact: true }).fill(productSlug);
  await page.getByLabel("Cena (PLN)").fill("19.99");
  await page.getByLabel("Stan magazynowy").fill("3");
  await page.getByRole("complementary").getByRole("combobox", { name: "Kategoria", exact: true }).selectOption(String(category.id));
  const createdProduct = page.waitForResponse(r => r.url().endsWith("/products") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  const productResponse = await createdProduct;
  expect(productResponse.status()).toBe(201);
  const product = await productResponse.json();
  expect(product.slug).toBe(productSlug);
  await expect(page.getByText("Zapisano produkt.", { exact: true })).toBeVisible();
  await page.reload();
  const productRow = page.getByRole("row").filter({ has: page.getByText(productName, { exact: true }) });
  await productRow.getByRole("button", { name: "Edytuj" }).click();
  await page.getByLabel("Cena (PLN)").fill("24.99");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisano produkt.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(productRow).toContainText("24,99");
  page.once("dialog", d => d.accept());
  await productRow.getByRole("button", { name: "Ukryj" }).click();
  await expect(productRow).toContainText("Ukryty");
  const hidden = await page.request.get(`/api/v1/products/${product.id}`);
  expect(hidden.status()).toBe(404);
  await page.reload();
  await expect(productRow).toContainText("Ukryty");
  await productRow.getByRole("button", { name: "Edytuj" }).click();
  await page.getByLabel("Aktywny w sklepie").check();
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(productRow).toContainText("Aktywny");
  await page.goto(`/products/${product.id}`);
  await expect(page.getByRole("heading", { name: productName, exact: true })).toBeVisible();
  await expect(page.getByText(/24,99/).first()).toBeVisible();

  await page.goto("/admin/categories");
  page.once("dialog", d => d.accept());
  const conflict = page.waitForResponse(r => r.url().endsWith(`/categories/${category.id}`) && r.request().method() === "DELETE");
  await categoryRow.getByRole("button", { name: "Usuń" }).click();
  expect((await conflict).status()).toBe(409);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(categoryRow).toBeVisible();

  // A separate empty category can actually be deleted through the UI.
  await page.getByRole("button", { name: "Nowa kategoria" }).click();
  await page.getByLabel("Nazwa", { exact: true }).fill(`Pusta ${suffix}`);
  await page.getByLabel("Slug", { exact: true }).fill(`empty-${suffix}`);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  const emptyRow = page.getByRole("row").filter({ has: page.getByText(`Pusta ${suffix}`, { exact: true }) });
  await expect(emptyRow).toBeVisible();
  page.once("dialog", d => d.accept());
  await emptyRow.getByRole("button", { name: "Usuń" }).click();
  await expect(page.getByText("Usunięto kategorię.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(emptyRow).toHaveCount(0);
  writeFileSync(".e2e-checkpoint.json", JSON.stringify({ productId: product.id, categoryId: category.id, productName, productSlug, price: "24.99", stock: 3 }));
});

test("client prevents invalid writes; real API independently returns 400", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Nowy produkt" }).click();
  let writes = 0;
  page.on("request", r => { if (r.url().includes("/products") && r.method() === "POST") writes++; });
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Nazwa musi");
  await page.getByLabel("Nazwa", { exact: true }).fill("Niepoprawny produkt");
  await page.getByLabel("Slug", { exact: true }).fill("niepoprawny-produkt");
  await page.getByLabel("Cena (PLN)").fill("1.234");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Cena musi");
  expect(writes).toBe(0);
  const response = await page.request.post("/api/v1/products", {
    headers: await headers(page), data: { name: "", slug: "bad slug", price: "0", stock_quantity: -1, category_id: 1 },
  });
  expect(response.status()).toBe(400);
  expect(Array.isArray((await response.json()).detail)).toBe(true);
});
