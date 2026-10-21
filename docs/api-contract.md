# Kontrakt REST API MVP — BE-2

Status: propozycja do review frontendu. Akceptacja frontendu nie została jeszcze
potwierdzona. Powiązane zadanie: [#13](https://github.com/paulatrzcinska/ProjektZespolowy_NAZWA_GRUPY/issues/13).

## Dokumentacja i dane przykładowe

- Bazowy adres lokalny: `http://localhost:8000/api/v1`.
- Swagger UI: `http://localhost:8000/docs`.
- OpenAPI: `http://localhost:8000/openapi.json`.
- `/health` pozostaje poza wersjonowanym API.

Modele Pydantic i deklaracje routerów są źródłem schematu OpenAPI. Swagger
pokazuje pola request/response, ograniczenia walidacji, kody odpowiedzi oraz
wymagane uprawnienia. JSON używa nazw pól w `snake_case`.

Domyślny tryb `API_MODE=live` wykonuje operacje na PostgreSQL. Zmiany katalogu,
koszyka, profilu i zamówień są trwałe. Szczegóły uruchomienia, transakcji,
JWT i lokalnej symulacji płatności: [backend-runtime.md](backend-runtime.md).

Jawny `API_MODE=contract` w środowisku lokalnym/testowym zachowuje przykładowe
odpowiedzi BE-2 dla testów interfejsu. W tym trybie zapisy nie są utrwalane,
a filtry i reguły biznesowe nie są wykonywane.

## Uwierzytelnianie i role

`POST /auth/login` przyjmuje JSON `LoginRequest`. W trybie live zwraca JWT access
i refresh oraz `expires_in`. Poniższy przykład dotyczy trybu kontraktowego:

```json
{
  "access_token": "example-user-token",
  "token_type": "bearer"
}
```

Chronione operacje wymagają `Authorization: Bearer <access_token>`. W Swagger UI
użyj przycisku **Authorize** i wpisz sam token:

| Token przykładowy | Rola |
| --- | --- |
| `example-user-token` | użytkownik |
| `example-admin-token` | administrator |

Tryb kontraktowy zwraca token użytkownika i nie sprawdza hasła. Token
administratora jest dostępny do testowania kontraktu przez Authorize. Są to
przykładowe dane dostępu, bez implementacji JWT ani przechowywania kont.
Brak lub niepoprawny token daje `401` z nagłówkiem `WWW-Authenticate: Bearer`;
użytkownik bez roli administratora otrzymuje `403` przy operacjach administracyjnych.

W tabelach ścieżki są względne wobec `/api/v1`. Administrator może również
wykonywać operacje dostępne dla użytkownika. `—` oznacza brak body.

## Auth

| Metoda | Ścieżka | Dostęp | Request | Sukces / response | Pozostałe kody |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/register` | publiczny | `UserCreate` | `201 UserRead` | 409, 422 |
| POST | `/auth/login` | publiczny | `LoginRequest` | `200 Token` | 401, 403, 422 |
| GET | `/auth/me` | użytkownik | — | `200 UserRead` | 401 |
| PATCH | `/auth/me` | użytkownik | `UserProfileUpdate` | `200 UserRead` | 401, 422 |
| POST | `/auth/change-password` | użytkownik | `PasswordChangeRequest` | `204`, bez body | 401, 422 |

`UserCreate` zawiera e-mail, hasło (8–128 znaków) i opcjonalną nazwę użytkownika.
`UserRead` zawiera identyfikator, e-mail, `full_name`, `is_admin` oraz opcjonalny
adres dostawy. Hasła nie są zwracane w odpowiedziach. `UserProfileUpdate`
nie pozwala zmienić roli; obejmuje nazwę użytkownika i adres dostawy.

## Kategorie

| Metoda | Ścieżka | Dostęp | Request | Sukces / response | Pozostałe kody |
| --- | --- | --- | --- | --- | --- |
| GET | `/categories` | publiczny | — | `200 CategoryRead[]` | — |
| GET | `/categories/{category_id}` | publiczny | — | `200 CategoryRead` | 404, 422 |
| POST | `/categories` | admin | `CategoryCreate` | `201 CategoryRead` | 401, 403, 409, 422 |
| PATCH | `/categories/{category_id}` | admin | `CategoryUpdate` | `200 CategoryRead` | 401, 403, 404, 409, 422 |
| DELETE | `/categories/{category_id}` | admin | — | `204`, bez body | 401, 403, 404, 409, 422 |

Kategoria zawiera `name`, unikalny `slug` i opcjonalny `description`.
Usunięcie kategorii z produktami docelowo daje `409`.

## Produkty

| Metoda | Ścieżka | Dostęp | Request | Sukces / response | Pozostałe kody |
| --- | --- | --- | --- | --- | --- |
| GET | `/products` | publiczny | query poniżej | `200 ProductListRead[]` | 401, 403, 422 |
| GET | `/products/{product_id}` | publiczny | — | `200 ProductRead` | 404, 422 |
| POST | `/products` | admin | `ProductCreate` | `201 ProductRead` | 401, 403, 409, 422 |
| PATCH | `/products/{product_id}` | admin | `ProductUpdate` | `200 ProductRead` | 401, 403, 404, 409, 422 |
| DELETE | `/products/{product_id}` | admin | opcjonalne `hard=false` w query | `204`, bez body | 401, 403, 404, 409, 422 |

| Parametr listy | Typ / domyślna wartość | Znaczenie docelowe |
| --- | --- | --- |
| `skip` | int ≥ 0, `0` | Liczba pomijanych rekordów |
| `limit` | int 1–100, `50` | Rozmiar strony |
| `category_id` | opcjonalny int ≥ 1 | Filtr kategorii |
| `q` | opcjonalny string, maks. 200 znaków | Wyszukiwanie po nazwie |
| `sort` | `newest` / `price_asc` / `price_desc` / `name`; domyślnie `newest` | Kolejność wyników |
| `min_price`, `max_price` | opcjonalne liczby dziesiętne ≥ 0 | Zakres ceny |
| `include_inactive` | bool, `false` | Uwzględnienie nieaktywnych produktów; wymaga admina |

Odpowiedź listy ma nagłówek `X-Total-Count` z liczbą dopasowanych produktów przed
paginacją. CORS udostępnia ten nagłówek przeglądarce. Body jest tablicą, bez
opakowania `items`/`total`. Lista zawiera podstawowe dane produktu, a szczegóły
dodatkowo `description`.

`ProductCreate` obejmuje `name`, `slug`, `description`, `price`, `stock_quantity`,
`category_id`, `image_url` i `is_active`. Cena musi być dodatnia, mieć maksymalnie
dwa miejsca po przecinku i 12 cyfr łącznie; stan magazynowy nie może być ujemny.
`image_url` jest opcjonalnym adresem HTTP/HTTPS.

DELETE domyślnie oznacza dezaktywację. `hard=true` docelowo żąda trwałego
usunięcia; powiązania z koszykami lub zamówieniami mogą spowodować `409`.

## Koszyk

| Metoda | Ścieżka | Dostęp | Request | Sukces / response | Pozostałe kody |
| --- | --- | --- | --- | --- | --- |
| GET | `/cart` | użytkownik | — | `200 CartResponse` | 401 |
| POST | `/cart/items` | użytkownik | `CartItemAdd` | `201 CartResponse` | 400, 401, 404, 422 |
| PATCH | `/cart/items/{item_id}` | użytkownik | `CartItemUpdate` | `200 CartResponse` | 400, 401, 404, 422 |
| DELETE | `/cart/items/{item_id}` | użytkownik | — | `200 CartResponse` | 401, 404, 422 |

`CartItemAdd` przyjmuje `product_id` i `quantity` (1–999); `CartItemUpdate` tylko
`quantity`. PATCH ustawia nową ilość, a nie przyrost. `item_id` oznacza pozycję
koszyka, nie identyfikator produktu. Każda operacja zwraca pełny koszyk:
`id`, `items`, `items_count`, `subtotal`. `items_count` to suma ilości, a nie liczba
wierszy. Pozycja zawiera `id`, `product_id`, `quantity`, `line_total` i zagnieżdżony
`ProductListRead`. `400` docelowo opisuje np. niewystarczający stan magazynowy.

## Zamówienia i administracja

| Metoda | Ścieżka | Dostęp | Request | Sukces / response | Pozostałe kody |
| --- | --- | --- | --- | --- | --- |
| POST | `/orders` | użytkownik | `OrderCreate` | `201 OrderRead` | 400, 401, 409, 422 |
| GET | `/orders` | użytkownik | — | `200 OrderRead[]` | 401 |
| GET | `/orders/{order_id}` | właściciel | — | `200 OrderRead` | 401, 404, 422 |
| GET | `/orders/admin/all` | admin | query poniżej | `200 OrderRead[]` | 401, 403, 422 |
| PATCH | `/orders/{order_id}/status` | admin | `OrderStatusUpdate` | `200 OrderRead` | 400, 401, 403, 404, 422 |

`OrderCreate` zawiera wyłącznie dane wysyłki: `shipping_full_name`,
`shipping_address_line1`, opcjonalne `shipping_address_line2`, `shipping_city`,
`shipping_postal_code`, `shipping_country`, opcjonalne `shipping_notes`.
Produkty i kwoty pochodzą z koszyka. Opcjonalny nagłówek `Idempotency-Key`
ma format UUID; tryb live zapisuje klucze i obsługuje ponowienia. Przykłady
trybu kontraktowego nie przechowują kluczy.

`OrderRead` zawiera dane wysyłki, `id`, `status`, `total_amount`, `created_at`
oraz `items`. Każda pozycja ma `id`, `product_id`, `quantity`, `unit_price`
i `product_name_snapshot`.

Lista administracyjna przyjmuje `skip` (domyślnie 0), `limit` (1–100, domyślnie
50), opcjonalny `status` oraz `user_id` ≥ 1. Dostępne statusy to `pending`,
`paid`, `shipped`, `cancelled`. Docelowe przejścia: `pending → paid/cancelled`
oraz `paid → shipped/cancelled`; niepoprawne przejście daje `400`.
Przykładowa odpowiedź PATCH prezentuje wybrany status bez sprawdzania przejść.

Operacje administracyjne zachowują ścieżki zasobów i są dodatkowo oznaczone
tagiem `admin` w Swaggerze. Nie wymagają osobnego prefiksu `/admin`.

## Typy i błędy

- Identyfikatory w ścieżkach i referencjach są dodatnimi liczbami całkowitymi.
- Kwoty w odpowiedziach są stringami dziesiętnymi, np. `"199.99"`, a nie floatami.
  W requestach zalecany jest ten sam format. Na etapie MVP kwoty są w PLN.
- Daty mają format ISO 8601 ze strefą czasową, np. `2026-10-19T12:00:00Z`.
- PATCH przyjmuje tylko pola do zmiany. `null` czyści wartości opcjonalne
  (`description`, `image_url`, dane profilu); dla pozostałych pól oznacza brak zmiany.
- Slugi składają się z małych liter ASCII, cyfr i segmentów oddzielonych `-`.
- Odpowiedzi `204` nie zawierają body.
- Błędy domenowe i dostępu używają `ErrorResponse`, np. `{"detail":"Admin only"}`.
- Walidacja zwraca `422` i standardowy `HTTPValidationError` FastAPI z listą
  `detail`, zawierającą m.in. lokalizację `loc`, opis `msg` i typ `type`.

## Review frontendu

- [ ] Ścieżki, metody i wymagane role odpowiadają ekranom MVP.
- [ ] Nazwy pól i struktury request/response są zaakceptowane.
- [ ] Stringi kwot, statusy zamówień i format dat są zaakceptowane.
- [ ] Paginacja listy produktów oraz odczyt `X-Total-Count` są zaakceptowane.
- [ ] Obsługa `401`, `403`, `404`, `409` i `422` jest uzgodniona.
- [ ] Frontend potwierdził akceptację kontraktu w review zadania #13.

## Dodatkowe operacje trybu live

- `POST /auth/refresh` — request `RefreshRequest`, response `SessionTokens`;
  błędy `401`, `422`, `429`. Logowanie live również zwraca `SessionTokens`.
- `POST /payments/mock/sessions` — `MockSessionRequest`, `201 PaymentRead`.
- `POST /payments/mock/{payment_id}/complete` — `MockCompletionRequest`, `200 PaymentRead`.
- `GET /payments/{payment_id}/status` — `200 PaymentRead`.

Symulacja wymaga `PAYMENTS_MOCK=true` i środowiska lokalnego/testowego.
Każda płatność jest dostępna wyłącznie właścicielowi zamówienia. Nie ma integracji
z zewnętrzną bramką ani webhooka. Pełne reguły są w dokumentacji runtime.
