# Backend — działające API MVP

Domyślny `API_MODE=live` korzysta z PostgreSQL. Rejestracja, katalog, koszyk,
zamówienia, profil i operacje administratora zapisują dane przez SQLAlchemy.
Publiczne modele i ścieżki BE-2 pozostają zgodne z frontendem.

## Oddzielne zakresy zmian

Commit logiki backendu wymaga zastosowania osobnego patcha bazy danych.
Modele ORM, połączenia, migracje, PostgreSQL Compose i testy warstwy danych
nie są powtórnie dołączane do commita logiki. Frontend jest osobnym patchem.

## Uruchomienie lokalne

Przygotuj PostgreSQL, migracje i uprawnienia według
[`db/README.md`](../db/README.md). Z katalogu `backend`:

```bash
uv sync --locked
cp .env.runtime.example .env.runtime
uv run python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Wpisz wygenerowaną wartość do `JWT_SECRET` w `.env.runtime`. Pozostaw
`APP_ENV=local` i `API_MODE=live`. Pliki `.env` i `.env.runtime` są ignorowane
przez Git. Następnie:

```bash
uv run python -m app.scripts.seed
uv run python -m app.scripts.create_admin admin@example.com
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Seed jest opcjonalny. CLI administratora pyta o hasło i jego potwierdzenie,
nie przechowuje domyślnych danych dostępu ani nie resetuje istniejącego konta.
Istniejący klient nie może zostać automatycznie awansowany na administratora.

API: http://127.0.0.1:8000/api/v1; Swagger: http://127.0.0.1:8000/docs;
health: http://127.0.0.1:8000/health. Migracje nie wykonują się przy starcie API.

## Uwierzytelnianie

- Rejestracja tworzy klienta, normalizuje e-mail bez rozróżniania wielkości
  liter i hashuje hasło Argon2. Zduplikowany e-mail daje `409`.
- Logowanie sprawdza hasło i aktywność konta. Odpowiedź zawiera `access_token`,
  `refresh_token`, `token_type=bearer` i `expires_in` w sekundach.
- `POST /auth/refresh` przyjmuje `{"refresh_token":"..."}` i zwraca nową parę
  tokenów. Access i refresh mają odrębne typy i zastosowania.
- JWT HS256 sprawdza podpis, wymagane daty, typ, odbiorcę i wystawcę.
  Użytkownik i aktualna rola są odczytywani z bazy przy każdym żądaniu.
- Zmiana hasła unieważnia poprzednie tokeny; dezaktywacja konta blokuje dostęp.
  Domyślne okresy ważności to 30 minut dla access i 7 dni dla refresh.
- Tokeny refresh są stateless. Nie mają listy pojedynczego użycia ani osobnej
  sesji serwerowej dla każdego urządzenia. Wylogowanie usuwa token lokalnie;
  pozostałe tokeny wygasają lub są unieważniane zmianą hasła/dezaktywacją.
- Aktualizacja profilu zapisuje wyłącznie dozwolone pola. Zmiana hasła wymaga
  aktualnego hasła i zwraca pusty `204`. Klient nie może zmienić swojej roli.
- Operacje rejestracji, logowania, refresh i zmiany hasła współdzielą limit
  10 prób/minutę na IP, konfigurowany przez `AUTH_RATE_LIMIT`. Błąd `429`
  zawiera `Retry-After`. Limit działa w pamięci procesu; wiele instancji wymaga
  również wspólnego limitu na wejściu do API.

Opcjonalny bootstrap przy starcie wymaga `CREATE_DEFAULT_ADMIN=true` oraz
`DEFAULT_ADMIN_EMAIL` i `DEFAULT_ADMIN_PASSWORD`. Domyślnie jest wyłączony.
Błąd wymaganej konfiguracji lub bootstrapu zatrzymuje start aplikacji.

## Katalog i koszyk

Produkty obsługują filtrowanie kategorii i ceny, wyszukiwanie nazwy, sortowanie
oraz paginację. `X-Total-Count` zawiera liczbę wyników przed paginacją.
Wyszukiwanie traktuje `%` i `_` jako zwykłe znaki, a ID stabilizuje sortowanie.
Nieaktywne produkty są dostępne wyłącznie administratorowi.

Administrator zarządza produktami i kategoriami. Slugi są unikalne; konflikty
dają `409`. DELETE produktu domyślnie go ukrywa; `hard=true` usuwa tylko rekordy
bez powiązań. Kategorie z produktami i produkty w koszyku lub historii zamówień
są chronione kluczami obcymi. PATCH zachowuje pola z `null`, poza `description`
i `image_url`, dla których `null` czyści wartość.

Koszyk należy do zalogowanego użytkownika. POST sumuje ilość produktu, PATCH
ustawia nową ilość, DELETE usuwa pozycję. Każda operacja zwraca cały koszyk.
Ilość ma zakres 1–999 i nie może przekroczyć dostępnego stanu. Kwoty pochodzą
z cen w bazie; wartości przesłane przez klienta nie wyznaczają ceny.

## Zamówienia i transakcje

Checkout przyjmuje wyłącznie dane wysyłki. Jedna transakcja blokuje operacje
na koszyku użytkownika, blokuje produkty w stałej kolejności, ponownie sprawdza
dostępność, oblicza kwotę w `Decimal`, zapisuje snapshoty cen/nazw i adres,
zmniejsza stan magazynowy, opróżnia koszyk oraz zapisuje klucz idempotencji.
Błąd cofa całość. Równoległe zamówienia nie sprzedają ostatniej sztuki dwa razy.

`Idempotency-Key` jest opcjonalnym UUID. Ponowienie przez tego samego klienta
z tym samym adresem zwraca poprzednie zamówienie także po opróżnieniu koszyka.
Inny użytkownik lub inne dane wysyłki dają `409`.

Klient widzi własną historię i szczegóły; obcy identyfikator daje `404`.
Administrator ma listę wszystkich zamówień z filtrami. Dostępne przejścia:
`pending → paid/cancelled`, `paid → shipped/cancelled`. Ponowienie bieżącego
statusu jest bezpieczne. Anulowanie przywraca stan dokładnie raz i zamyka
oczekujące sesje płatności. Historia płatności pozostaje zachowana; anulowanie
nie realizuje zewnętrznego zwrotu pieniędzy.

## Lokalna symulacja płatności

Ustaw `PAYMENTS_MOCK=true` w `.env.runtime` i skorzystaj ze Swagger UI.

| Metoda | Ścieżka względem `/api/v1` | Request / działanie |
| --- | --- | --- |
| POST | `/payments/mock/sessions` | `{"order_id":1}` — tworzy lub zwraca sesję |
| POST | `/payments/mock/{payment_id}/complete` | `{"outcome":"paid"}` albo `{"outcome":"failed"}` |
| GET | `/payments/{payment_id}/status` | Status płatności właściciela zamówienia |

Kwotę i walutę ustala serwer. Sukces zmienia status płatności i zamówienia
atomowo. Niepowodzenie pozwala utworzyć kolejną sesję. Ponowienia i równoległe
wywołania nie dublują skutków. Zmiana wyniku zakończonej sesji lub zapłata za
anulowane zamówienie daje `409`. Obcy użytkownik otrzymuje `404`.

Symulacja nie kontaktuje się z bramką i nie udaje rzeczywistego webhooka.
`APP_ENV=production` zabrania symulacji i trybu kontraktowego. Wyłączona
symulacja zwraca `404`. Frontend nie zawiera jeszcze widoku płatności.

## Tryb kontraktowy i odpowiedzi

Jawny `API_MODE=contract` jest dostępny tylko lokalnie i w testach. Zachowuje
przykłady BE-2 dla testów interfejsu. Domyślnie działa `live`; awaria bazy nigdy
nie przełącza API na przykładowe dane.

Odpowiedzi mają `nosniff`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy` oraz HSTS przy HTTPS. Uwierzytelnianie i żądania z tokenem
mają `Cache-Control: no-store`. CORS nadal korzysta z ustawień backendu.
`/health` sprawdza działanie procesu, nie gotowość bazy.

Na AWS ustaw `APP_ENV=production`, dostarcz JWT i hasła bazy z zarządzanych
sekretów, użyj TLS do RDS i zaufaj wyłącznie faktycznemu proxy. Migracje są
osobnym zadaniem. Zmiany backendu nie tworzą zasobów AWS.

## Testy

Z `backend/`, na osobnej bazie o nazwie zakończonej `_test`:

```bash
export TEST_DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/shop_test
uv run pytest
```

Testy stosują migracje w osobnych schematach i sprzątają wyłącznie swoje dane.
Sprawdzają kontrakt, modele, trwałość CRUD, autoryzację, własność, bootstrap,
checkout, anulowanie, idempotencję i symulację płatności. Przypadki współbieżne
działają na prawdziwym PostgreSQL.

JWT i hashowanie wykorzystują biblioteki opisane w
[dokumentacji FastAPI](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/).
