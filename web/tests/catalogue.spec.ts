import { expect, test } from "@playwright/test";

test("public catalogue, prices and product detail", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Krzesło dębowe" }),
  ).toBeVisible();
  await expect(page.getByText("Strona 1 z 1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Następna" })).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath("catalogue.png"),
    fullPage: true,
  });
  await page.getByRole("heading", { name: "Krzesło dębowe" }).click();
  await expect(page).toHaveURL(/\/products\/1$/);
  await expect(page.getByText("Krzesło z litego drewna")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zaloguj się, by kupić" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("search, category and sort use the contract query parameters", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Krzesło dębowe" }),
  ).toBeVisible();
  await page.getByLabel("Szukaj produktów").fill("dąb");
  const searching = page.waitForRequest(
    (request) => new URL(request.url()).searchParams.get("q") === "dąb",
  );
  await page.getByRole("button", { name: "Szukaj", exact: true }).click();
  expect(new URL((await searching).url()).searchParams.get("limit")).toBe("12");
  const filtering = page.waitForRequest(
    (request) => new URL(request.url()).searchParams.get("category_id") === "1",
  );
  await page
    .getByRole("combobox", { name: "Kategoria", exact: true })
    .selectOption("1");
  await filtering;
  const sorting = page.waitForRequest(
    (request) =>
      new URL(request.url()).searchParams.get("sort") === "price_asc",
  );
  await page
    .getByRole("combobox", { name: "Sortowanie", exact: true })
    .selectOption("price_asc");
  await sorting;
});

test("responsive navigation and protected checkout", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Krzesło dębowe" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Witaj z powrotem" }),
  ).toBeVisible();
});
