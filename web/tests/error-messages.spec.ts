import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// API errors used to reach customers as raw English `detail` texts (#75).

test("login errors are shown in Polish", async ({ page }) => {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: '{"detail":"Invalid credentials"}' }),
  );
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("user@example.com");
  await page.getByLabel("Hasło", { exact: true }).fill("wrongpass1");
  await page.getByRole("button", { name: "Zaloguj", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Nieprawidłowy e-mail lub hasło.");
});

test("validation errors name the form field in Polish", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/v1/orders", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            detail: [
              {
                type: "string_too_long",
                loc: ["body", "shipping_city"],
                msg: "String should have at most 120 characters",
                ctx: { max_length: 120 },
              },
            ],
          }),
        })
      : route.fallback(),
  );
  await page.goto("/checkout");
  await page.getByLabel("Imię i nazwisko na przesyłce").fill("Jan Testowy");
  await page.getByLabel("Ulica i numer", { exact: true }).fill("Testowa 1");
  await page.getByLabel("Kod pocztowy", { exact: true }).fill("00-001");
  await page.getByLabel("Miasto", { exact: true }).fill("Warszawa");
  await page.getByLabel("Kraj", { exact: true }).fill("Polska");
  await page.getByRole("button", { name: "Złóż zamówienie", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Miasto: maksymalnie 120 znaków.");
});

test("server and network failures show a friendly message", async ({ page }) => {
  await signIn(page);
  await page.goto("/products/1");
  const add = page.getByRole("button", { name: "Dodaj do koszyka", exact: true });

  await page.route("**/api/v1/cart/items", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"detail":"Internal server error"}' }),
  );
  await add.click();
  await expect(page.getByRole("alert")).toHaveText(
    "Serwer jest chwilowo niedostępny. Spróbuj ponownie za chwilę.",
  );

  await page.unroute("**/api/v1/cart/items");
  await page.route("**/api/v1/cart/items", (route) => route.abort("internetdisconnected"));
  await add.click();
  await expect(page.getByRole("alert")).toHaveText(
    "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
  );
});
