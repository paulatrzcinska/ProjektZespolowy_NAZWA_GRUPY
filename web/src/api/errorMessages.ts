/**
 * Tłumaczenie odpowiedzi błędów API na komunikaty dla klienta sklepu.
 * API zwraca `detail` po angielsku (tekst albo lista błędów walidacji);
 * użytkownik widzi wyłącznie polskie, zrozumiałe komunikaty.
 */

export const NETWORK_ERROR =
  "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.";
export const SERVER_ERROR =
  "Serwer jest chwilowo niedostępny. Spróbuj ponownie za chwilę.";
const GENERIC_ERROR = "Nie udało się wykonać operacji. Spróbuj ponownie.";

const MESSAGES: Record<string, string> = {
  "A cart product is unavailable":
    "Jeden z produktów w koszyku jest już niedostępny.",
  "Admin only": "Ta operacja wymaga uprawnień administratora.",
  "An account with this email already exists":
    "Konto z tym adresem e-mail już istnieje.",
  "Cart is empty": "Koszyk jest pusty.",
  "Cart item not found": "Nie znaleziono pozycji w koszyku.",
  "Category contains products":
    "Nie można usunąć kategorii, która zawiera produkty.",
  "Category not found": "Nie znaleziono kategorii.",
  "Category slug already exists": "Kategoria o takim slugu już istnieje.",
  "Concurrent idempotency key conflict":
    "To zamówienie jest właśnie przetwarzane. Odczekaj chwilę.",
  "Email already registered": "Konto z tym adresem e-mail już istnieje.",
  "Idempotency key conflict":
    "To zamówienie zostało już złożone z innymi danymi. Odśwież stronę.",
  "Image URL must not exceed 2048 characters":
    "Adres zdjęcia może mieć maksymalnie 2048 znaków.",
  "Inactive user": "To konto jest nieaktywne.",
  "Insufficient stock": "Brak wystarczającej liczby sztuk w magazynie.",
  "Insufficient stock or cart quantity exceeds 999":
    "Brak wystarczającej liczby sztuk w magazynie (maksymalnie 999 w koszyku).",
  "Internal server error": SERVER_ERROR,
  "Invalid credentials": "Nieprawidłowy e-mail lub hasło.",
  "Invalid current password": "Aktualne hasło jest nieprawidłowe.",
  "Invalid order status transition":
    "Nie można zmienić zamówienia na wybrany status.",
  "Invalid token": "Sesja wygasła. Zaloguj się ponownie.",
  "min_price must not exceed max_price":
    "Cena minimalna nie może być większa niż maksymalna.",
  "Not authenticated": "Zaloguj się, aby kontynuować.",
  "Order cannot be paid": "Tego zamówienia nie można opłacić.",
  "Order is already paid": "To zamówienie jest już opłacone.",
  "Order not found": "Nie znaleziono zamówienia.",
  "Order total exceeds the supported amount":
    "Wartość zamówienia przekracza dopuszczalną kwotę.",
  "Payment not found": "Nie znaleziono płatności.",
  "Payment or order is already finalized":
    "Płatność lub zamówienie zostało już zakończone.",
  "Product is referenced by carts or orders":
    "Produkt jest w koszykach lub zamówieniach klientów.",
  "Product not found": "Nie znaleziono produktu.",
  "Product slug already exists or category changed":
    "Produkt o takim slugu już istnieje albo wybrana kategoria została zmieniona.",
  "Product unavailable or insufficient stock":
    "Produkt jest niedostępny lub brak wystarczającej liczby sztuk.",
  "Stock quantity must not exceed 2147483647":
    "Stan magazynowy jest zbyt duży.",
  "The operation conflicts with existing data":
    "Operacja koliduje z istniejącymi danymi. Odśwież stronę i spróbuj ponownie.",
  "Too many authentication attempts":
    "Zbyt wiele prób logowania. Odczekaj minutę i spróbuj ponownie.",
};

const STATUS_MESSAGES: Record<number, string> = {
  401: "Zaloguj się, aby kontynuować.",
  403: "Nie masz uprawnień do tej operacji.",
  404: "Nie znaleziono zasobu.",
  409: "Operacja koliduje z istniejącymi danymi. Odśwież stronę i spróbuj ponownie.",
  413: "Przesłane dane są zbyt duże.",
  429: "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.",
};

const FIELDS: Record<string, string> = {
  category_id: "Kategoria",
  current_password: "Aktualne hasło",
  description: "Opis",
  email: "E-mail",
  full_name: "Imię i nazwisko",
  image_url: "Adres zdjęcia",
  name: "Nazwa",
  new_password: "Nowe hasło",
  password: "Hasło",
  price: "Cena",
  product_id: "Produkt",
  quantity: "Ilość",
  shipping_address_line1: "Ulica i numer",
  shipping_address_line2: "Dopisek",
  shipping_city: "Miasto",
  shipping_country: "Kraj",
  shipping_full_name: "Imię i nazwisko na przesyłce",
  shipping_notes: "Uwagi do zamówienia",
  shipping_postal_code: "Kod pocztowy",
  slug: "Slug",
  status: "Status",
  stock_quantity: "Stan magazynowy",
};

type ValidationItem = {
  type?: unknown;
  loc?: unknown;
  ctx?: Record<string, unknown>;
};

function chars(n: unknown): string {
  const value = Number(n);
  if (value === 1) return "1 znak";
  const last = value % 10;
  const lastTwo = value % 100;
  const few = last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14);
  return `${value} ${few ? "znaki" : "znaków"}`;
}

function validationMessage(item: ValidationItem): string {
  const ctx = item.ctx ?? {};
  switch (item.type) {
    case "missing":
      return "pole jest wymagane";
    case "string_too_short":
      return Number(ctx.min_length) <= 1
        ? "pole jest wymagane"
        : `minimum ${chars(ctx.min_length)}`;
    case "string_too_long":
      return `maksymalnie ${chars(ctx.max_length)}`;
    case "greater_than":
      return `wartość musi być większa niż ${String(ctx.gt)}`;
    case "greater_than_equal":
      return `wartość musi wynosić co najmniej ${String(ctx.ge)}`;
    case "less_than":
      return `wartość musi być mniejsza niż ${String(ctx.lt)}`;
    case "less_than_equal":
      return `wartość może wynosić maksymalnie ${String(ctx.le)}`;
    case "decimal_max_places":
      return `maksymalnie ${String(ctx.decimal_places)} miejsca po przecinku`;
    case "decimal_max_digits":
    case "decimal_whole_digits":
      return "liczba jest zbyt duża";
    case "int_parsing":
    case "int_from_float":
    case "decimal_parsing":
    case "float_parsing":
      return "podaj poprawną liczbę";
    case "url_parsing":
    case "url_scheme":
    case "url_type":
    case "url_too_long":
      return "podaj poprawny adres http(s)";
    case "uuid_parsing":
    case "uuid_type":
      return "nieprawidłowy identyfikator";
    case "string_pattern_mismatch":
      return "nieprawidłowy format";
    default:
      return "nieprawidłowa wartość";
  }
}

function fieldName(loc: unknown): string {
  if (!Array.isArray(loc) || loc.length === 0) return "";
  const field = String(loc[loc.length - 1]);
  return FIELDS[field] ?? (field === "body" ? "" : field);
}

function translateValidation(items: unknown[]): string {
  const lines = items.map((raw) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as ValidationItem;
    const field = fieldName(item.loc);
    const message =
      field === "E-mail" && item.type === "value_error"
        ? "podaj poprawny adres e-mail"
        : validationMessage(item);
    return field ? `${field}: ${message}.` : `${message}.`;
  });
  return [...new Set(lines)].join(" ");
}

/** Komunikat dla użytkownika na podstawie statusu HTTP i treści odpowiedzi API. */
export function errorMessage(status: number, body: unknown): string {
  if (status >= 500) return SERVER_ERROR;
  const detail =
    body && typeof body === "object" && "detail" in body
      ? (body as { detail: unknown }).detail
      : undefined;
  if (Array.isArray(detail) && detail.length > 0)
    return translateValidation(detail);
  if (typeof detail === "string" && MESSAGES[detail]) return MESSAGES[detail];
  return STATUS_MESSAGES[status] ?? GENERIC_ERROR;
}
