import { expect, test } from "@playwright/test";
import { login, signIn } from "./helpers";

test("login restores a protected destination and survives reload", async ({
  page,
}) => {
  await page.goto("/orders/1/summary");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("E-mail", { exact: true }).fill("user@example.com");
  await page.getByLabel("Hasło", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Zaloguj", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Podsumowanie #1" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Podsumowanie #1" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/orders\/1\/summary$/);
});

test("registration, profile update and password change respect the contract", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Rejestracja", exact: true }).click();
  await page.getByLabel("E-mail", { exact: true }).fill("new@example.com");
  await page.getByLabel("Imię i nazwisko (opcjonalnie)").fill("Anna Testowa");
  await page.getByLabel("Hasło", { exact: true }).fill("password123");
  const registration = page.waitForResponse((response) =>
    response.url().endsWith("/auth/register"),
  );
  await page.getByRole("button", { name: "Utwórz konto", exact: true }).click();
  expect((await registration).status()).toBe(201);
  await page.getByRole("link", { name: "Profil", exact: true }).click();
  await page
    .getByLabel("Imię i nazwisko", { exact: true })
    .fill("Anna Testowa");
  const profile = page.waitForResponse(
    (response) =>
      response.url().endsWith("/auth/me") &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Zapisz dane" }).click();
  expect((await profile).request().postDataJSON().full_name).toBe(
    "Anna Testowa",
  );
  await expect(page.getByText("Zapisano dane profilu.")).toBeVisible();
  await page.getByLabel("Aktualne hasło", { exact: true }).fill("password123");
  await page.getByLabel("Nowe hasło", { exact: true }).fill("newpassword123");
  await page
    .getByLabel("Powtórz nowe hasło", { exact: true })
    .fill("newpassword123");
  const password = page.waitForResponse((response) =>
    response.url().endsWith("/auth/change-password"),
  );
  await page.getByRole("button", { name: "Zmień hasło", exact: true }).click();
  expect((await password).status()).toBe(204);
  await expect(page.getByText("Hasło zostało zmienione.")).toBeVisible();
});

test("cart mutation updates shared state and uses cart item IDs", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/products/1");
  const added = page.waitForResponse(
    (response) =>
      response.url().endsWith("/cart/items") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Dodaj do koszyka", exact: true })
    .click();
  expect((await added).request().postDataJSON()).toEqual({
    product_id: 1,
    quantity: 1,
  });
  await expect(page).toHaveURL(/\/cart$/);
  // The API preview is stateless; model a future persisted mutation response.
  await page.route("**/api/v1/cart/items/1", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const response = await route.fetch();
    const cart = await response.json();
    cart.items[0].quantity = 3;
    cart.items[0].line_total = "599.97";
    cart.items_count = 3;
    cart.subtotal = "599.97";
    await route.fulfill({ response, json: cart });
  });
  const update = page.waitForResponse(
    (response) =>
      response.url().endsWith("/cart/items/1") &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Zwiększ ilość" }).click();
  expect((await update).request().postDataJSON()).toEqual({ quantity: 3 });
  await expect(
    page
      .getByRole("navigation", { name: "Główne" })
      .getByRole("link", { name: /Koszyk/ }),
  ).toContainText("3");
  const removed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/cart/items/1") &&
      response.request().method() === "DELETE",
  );
  await page.getByRole("button", { name: "Usuń", exact: true }).click();
  expect((await removed).status()).toBe(200);
});

async function fillShipping(page: import("@playwright/test").Page) {
  await page.getByLabel("Imię i nazwisko na przesyłce").fill("Jan Kowalski");
  await page.getByLabel("Ulica i numer").fill("Długa 1");
  await page.getByLabel("Kod pocztowy").fill("00-001");
  await page.getByLabel("Miasto").fill("Warszawa");
  await page.getByLabel("Kraj", { exact: true }).fill("Polska");
}

test("checkout submits shipping and a stable retry UUID without client prices", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/checkout");
  await fillShipping(page);
  const keys: string[] = [];
  await page.route("**/api/v1/orders", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1)
      return route.fulfill({
        status: 503,
        json: { detail: "Spróbuj ponownie" },
      });
    return route.continue();
  });
  await page.getByRole("button", { name: "Złóż zamówienie" }).click();
  await expect(
    page.getByText("Spróbuj ponownie", { exact: true }),
  ).toBeVisible();
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/orders") && response.status() === 201,
  );
  await page.getByRole("button", { name: "Złóż zamówienie" }).click();
  const response = await created;
  expect(keys).toHaveLength(2);
  expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/);
  expect(keys[1]).toBe(keys[0]);
  expect(
    Object.keys(response.request().postDataJSON()).every((key) =>
      key.startsWith("shipping_"),
    ),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Podsumowanie #1" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Status zamówienia", exact: true })
    .click();
  await expect(
    page.getByText(/Zamówienie oczekuje na realizację/),
  ).toBeVisible();
});

test("customer cannot enter admin; expired token returns to login", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: /sklep dla Twojego psa/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Admin", exact: true }),
  ).toHaveCount(0);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Token expired" } }),
  );
  await page.goto("/profil/dane");
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => localStorage.getItem("furniture_access_token")),
  ).toBeNull();
});

test("admin product create, edit and soft delete call protected endpoints", async ({
  page,
}) => {
  await signIn(page, true);
  await page.goto("/admin");
  await page.getByRole("button", { name: /Nowy produkt/ }).click();
  await page.getByLabel("Nazwa", { exact: true }).fill("Stół testowy");
  await page.getByLabel("Slug", { exact: true }).fill("stol-testowy");
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/products") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  expect((await created).status()).toBe(201);
  await page.getByRole("button", { name: "Edytuj", exact: true }).click();
  await page.getByLabel("Cena (PLN)").fill("249.99");
  const edited = page.waitForResponse(
    (response) =>
      response.url().endsWith("/products/1") &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  expect((await edited).request().postDataJSON().price).toBe("249.99");
  page.once("dialog", (dialog) => dialog.accept());
  const removed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/products/1") &&
      response.request().method() === "DELETE",
  );
  await page.getByRole("button", { name: /Ukryj/ }).click();
  expect((await removed).status()).toBe(204);
});

test("admin category CRUD and conflict handling", async ({ page }) => {
  await signIn(page, true);
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: /Nowa kategoria/ }).click();
  await page.getByLabel("Nazwa", { exact: true }).fill("Stoły");
  await page.getByLabel("Slug", { exact: true }).fill("stoly");
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/categories") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  expect((await created).status()).toBe(201);
  await page.getByRole("button", { name: "Edytuj", exact: true }).click();
  await page.getByLabel("Opis (opcjonalnie)").fill("Opis kategorii");
  const edited = page.waitForResponse(
    (response) =>
      response.url().endsWith("/categories/1") &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  expect((await edited).status()).toBe(200);
  await page.route("**/api/v1/categories/1", (route) =>
    route.fulfill({
      status: 409,
      json: { detail: "Kategoria zawiera produkty" },
    }),
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Usuń/ }).click();
  await expect(page.getByText("Kategoria zawiera produkty")).toBeVisible();
});

test("admin lists orders and applies a supported status transition", async ({
  page,
}) => {
  await signIn(page, true);
  await page.goto("/admin/orders");
  const changed = page.waitForResponse((response) =>
    response.url().endsWith("/orders/1/status"),
  );
  await page.getByLabel("Nowy status zamówienia #1").selectOption("paid");
  expect((await changed).request().postDataJSON()).toEqual({ status: "paid" });
  await expect(
    page
      .getByLabel("Nowy status zamówienia #1")
      .getByRole("option", { name: "Wysłane" }),
  ).toHaveCount(1);
});

test("validation errors are readable and logout removes private query data", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 422,
      json: {
        detail: [
          {
            loc: ["body", "email"],
            msg: "Nieprawidłowy e-mail",
            type: "value_error",
          },
        ],
      },
    }),
  );
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("user@example.com");
  await page.getByLabel("Hasło", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Zaloguj", exact: true }).click();
  await expect(page.getByText("email: Nieprawidłowy e-mail")).toBeVisible();
  await page.unroute("**/api/v1/auth/login");
  await login(page);
  await page.getByRole("link", { name: "Profil", exact: true }).click();
  await page
    .getByRole("link", { name: "Historia zamówień", exact: true })
    .click();
  await expect(page.getByText("Zamówienie #1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Wyloguj", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Konto", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("furniture_access_token")),
  ).toBeNull();
  await page.goto("/orders/1/summary");
  await expect(page).toHaveURL(/\/login$/);
});
