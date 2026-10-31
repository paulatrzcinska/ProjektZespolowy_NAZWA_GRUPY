# Blok 6: lokalna integracja React → FastAPI → PostgreSQL

AWS i deployment CD pozostają na później. Wszystkie poniższe testy wykonuje się lokalnie.

## Przygotowanie

Wymagania: PostgreSQL 16 (Docker Compose lub natywny), Python 3.12+, uv,
Node.js 22.12+ i npm 10+. Dla Compose wykonaj [instrukcję bazy](../db/README.md):
własne hasła w `db/.env` i `backend/.env`, start bazy, migracje i nadanie uprawnień.
Frontend nigdy nie łączy się bezpośrednio z bazą.

W `backend` wykonaj `uv sync --locked`. Skopiuj `.env.example` do `.env`,
a `.env.runtime.example` do `.env.runtime`. Ustaw `API_MODE=live`, `APP_ENV=local`
i losowy JWT_SECRET (co najmniej 32 bajty). Generator:
`uv run python -c "import secrets; print(secrets.token_urlsafe(48))"`.
Sekretów nie zapisuj w repozytorium ani na zrzutach.

```bash
uv run alembic -c ../db/alembic.ini upgrade head
```

Po migracji uruchom `db/scripts/grant-app-permissions.sql` jako `shop_migrator`.
Następnie w `backend`:

```bash
uv run python -m app.scripts.seed
uv run python -m app.scripts.create_admin admin.local@example.com
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

CLI administratora pyta o hasło w ukrytym monicie. Seed jest opcjonalny.
Frontend w drugim terminalu, w `web`: `npm ci`; skopiuj `.env.example` do `.env`.
Ustaw `VITE_USE_MOCK_API=false`, `VITE_API_BASE_URL=` (puste),
`API_PROXY_TARGET=http://127.0.0.1:8000`. Uruchom `npm run dev -- --host 127.0.0.1`.
Otwórz `http://127.0.0.1:5173`. Po zmianie zmiennych Vite zrestartuj serwer;
dla preview wykonaj również ponowny build.

## PostgreSQL natywny, bez Dockera

Użyj PostgreSQL 16, również w wersji przenośnej wskazanej na oficjalnej stronie
PostgreSQL. Zainicjalizuj własny katalog danych przez `initdb` z SCRAM i hasłem
administratora; nie używaj `trust`. Uruchom serwer wyłącznie na `127.0.0.1`, np. porcie 55432.
Nie trzeba rejestrować usługi Windows.

Na świeżym klastrze otwórz `psql -h 127.0.0.1 -p 55432 -U postgres -d postgres -W`.
W interaktywnej sesji wykonaj (to bootstrap, nie skrypt do wielokrotnego uruchamiania):

```sql
CREATE ROLE shop_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
\password shop_migrator
CREATE ROLE shop_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
\password shop_app
CREATE DATABASE shop_e2e_test OWNER shop_migrator;
CREATE DATABASE shop_test;
REVOKE ALL ON DATABASE shop_e2e_test FROM PUBLIC;
GRANT CONNECT ON DATABASE shop_e2e_test TO shop_migrator, shop_app;
\connect shop_e2e_test
ALTER SCHEMA public OWNER TO shop_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO shop_app;
```

`\password` pyta o własne hasła. Ustaw w `backend/.env`:

| Zmienna | Wartość |
| --- | --- |
| DB_HOST | 127.0.0.1 |
| DB_PORT | 55432 (lub własny port) |
| DB_NAME | shop_e2e_test |
| DB_USER | shop_app |
| DB_PASSWORD | własne hasło aplikacji |
| MIGRATION_DB_USER | shop_migrator |
| MIGRATION_DB_PASSWORD | własne hasło migratora |

Po migracji, z katalogu głównego repo:

```bash
psql -h 127.0.0.1 -p 55432 -U shop_migrator -d shop_e2e_test -W -v ON_ERROR_STOP=1 -f db/scripts/grant-app-permissions.sql
```

## E1: ręczny CRUD i trwałość

1. Zaloguj administratora. W `/admin/categories` dodaj kategorię z unikalnym slugiem.
2. Odśwież stronę, zmień opis kategorii, zapisz i ponownie odśwież.
3. W `/admin` dodaj produkt w tej kategorii: cena 19.99, stan 3.
4. Odśwież stronę; sprawdź produkt również w publicznym katalogu.
5. Zmień cenę na 24.99; sprawdź ją po odświeżeniu i w szczegółach produktu.
6. Ukryj produkt. Panel pokazuje Ukryty, publiczne szczegóły zwracają 404.
7. Zaznacz ponownie Aktywny w sklepie i zapisz; produkt wraca do katalogu.
8. Usuń kategorię z produktem: oczekuj 409 i komunikatu, rekord pozostaje.
9. Dodaj pustą kategorię i usuń ją: oczekuj 204 oraz braku po odświeżeniu.

DELETE produktu jest miękkim usunięciem, zachowującym historię. Odczyt DBA:

```sql
SELECT id, slug, price, stock_quantity, is_active
FROM products WHERE slug = 'slug-utworzonego-produktu';
```

Zatrzymaj i uruchom ponownie API, frontend oraz PostgreSQL, zachowując katalog
danych/wolumen. Nie wykonuj ponownie initdb. Sprawdź to samo ID i cenę produktu.

## E2: stany interfejsu

W DevTools ustaw wolną sieć. Sprawdź loading, blokady formularzy podczas zapisu
i usuwania, potwierdzenia sukcesu oraz ponowne pobranie listy. Błąd odświeżenia
po udanym zapisie jest odróżniony od błędu zapisu. Zatrzymaj API przy działającym
froncie: katalog pokazuje błąd i Spróbuj ponownie. Przywróć API i ponów.
Odczyty kategorii administratora omijają cache publicznego katalogu PWA.

## E3: walidacja

Sprawdź pustą nazwę, zły slug, cenę 0/1.234, ujemny/ułamkowy/pusty stan,
URL zdjęcia inny niż HTTP(S) i ponad 2048 znaków. POST/PATCH nie powinien być
wysłany. Nazwa/slug: limit 300 znaków dla produktu, 200 dla kategorii.
Sprawdź też błędny e-mail i brak danych checkout. API niezależnie waliduje
żądania; aktualny PR #31 zwraca 400 z listą detail zamiast domyślnego 422.

## E4: dokumentacja

README zawiera lokalny diagram, endpointy i JSON. Pełny kontrakt:
[api-contract.md](api-contract.md). Swagger backendu: `/docs`, OpenAPI:
`/openapi.json`. `/health` sprawdza proces, nie gotowość PostgreSQL.

## E5: testy

Backend: ustaw `TEST_DATABASE_URL` na osobną bazę `shop_test`, z kontem mogącym
tworzyć schematy, i wykonaj `uv run pytest` w `backend`. URL ma postać
`postgresql+asyncpg://postgres:<hasło>@127.0.0.1:55432/shop_test`.
Znaki specjalne w haśle URL wymagają kodowania. Testy tworzą i sprzątają własne
losowe schematy. Bez zmiennej testy bazowe są pomijane.

Frontend, z `web`:

```bash
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

To zestaw kontraktowy, nie dowód trwałości. Osobne `tests-live` używa rzeczywistych
żądań HTTP bez mockowania. Przygotuj `shop_e2e_test`, migracje, role, seed
i administratora. W `backend/.env` wskaż tę bazę. W PowerShell, z `web`:

```powershell
$env:E2E_ADMIN_EMAIL = 'admin.local@example.com'
$secret = Read-Host 'Hasło lokalnego administratora testowego' -AsSecureString
$env:E2E_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
$env:E2E_ALLOW_WRITES = 'local-test-database'
npm run test:e2e:live
```

Konfiguracja uruchamia API live na 18001 i preview na 4176, bez mocków.
Zostawia kategorię i aktywny produkt o unikalnym slugu do testu trwałości.
Ignorowany `.e2e-checkpoint.json` zawiera ID, nie sekrety.
Po zatrzymaniu i ponownym uruchomieniu PostgreSQL:

```powershell
$env:E2E_PHASE = 'restart'
npm run test:e2e:live
```

Test restart nie restartuje bazy sam; sprawdza zachowanie zapisanych danych.
Jeśli sam uruchamiasz serwery, ustaw `$env:E2E_EXTERNAL_SERVERS = '1'`:
API live na 18001, frontend po buildzie bez mocków na 4176, proxy do 18001.
Przy działającym preview i rzeczywiście zatrzymanym API:

```powershell
$env:E2E_EXTERNAL_SERVERS = '1'
$env:E2E_PHASE = 'offline'
npm run test:e2e:live
```

Po testach usuń zmienną z hasłem i ustawienia fazy z sesji PowerShell.
Live nie zapisuje trace/video z żądaniami logowania. Nie wskazuj produkcyjnej bazy.
W ograniczonym Windows można użyć Vite `--configLoader runner` dla build/preview;
nie zastępuje to typecheck. Dla przyszłego CI są lockfile npm/uv, migracje
i osobne komendy testów. Runner musi dostarczyć bazę i sekrety testowe.
Nie dodajemy deploymentu ani nie wykonujemy commit/push/PR/merge.

## Zrzuty i materiał do indywidualnego sprawozdania

| Punkt | Zrzuty do samodzielnego wykonania | Zakres opisu własnego wkładu |
| --- | --- | --- |
| E1 | Produkt po dodaniu/edycji/ukryciu; Network; SELECT; ten sam rekord po restarcie | Przygotowanie ról, migracji i weryfikacja trwałości |
| E2 | Loading/blokada na wolnej sieci, sukces, błąd po zatrzymaniu API | Sprawdzone stany i obsługa operacji |
| E3 | Niepoprawne pola i brak POST/PATCH; 400 ze Swaggera | Porównanie walidacji UI, API i ograniczeń bazy |
| E4 | README z diagramem, endpointy, Swagger | Instrukcje zgodne z faktycznym lokalnym środowiskiem |
| E5 | pytest, Playwright contract/live/restart; gałąź robocza; później PR | Wykonane testy; scalenie pozostaje otwarte |

Opisz tylko faktycznie wykonane i zrozumiane własne czynności. Nie przypisuj
sobie wcześniejszego kodu zespołu ani automatycznej pracy narzędzia. Nie pokazuj
haseł ani JWT. Lokalnych testów nie przedstawiaj jako wdrożenia AWS.
