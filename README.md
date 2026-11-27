# Z Dech Pies

Wieloplatformowa aplikacja e-commerce umożliwiająca przeglądanie produktów, zarządzanie koszykiem, składanie zamówień oraz zarządzanie kontem użytkownika.

System obejmuje aplikację webową PWA (React), backend oparty na FastAPI i PostgreSQL oraz panel administracyjny do zarządzania ofertą sklepu. W dalszych etapach planowany jest rozwój aplikacji mobilnej (React Native) i integracja z rzeczywistą bramką płatności.

## Live URL

**Aplikacja:** [https://d295uboxigcnkp.cloudfront.net](https://d295uboxigcnkp.cloudfront.net)

[Swagger UI](https://d295uboxigcnkp.cloudfront.net/docs) · [OpenAPI JSON](https://d295uboxigcnkp.cloudfront.net/openapi.json) · [Healthcheck](https://d295uboxigcnkp.cloudfront.net/health)

Frontend i API działają pod wspólną domeną CloudFront. `/health` i `/version.json`
zwracają identyfikator wdrożonego commita. Pusty katalog oznacza brak produktów
w bazie; przykładowe dane można przygotować lokalnie poleceniem seed z Quick Start.

## Zespół

| Rola | Osoba |
| --- | --- |
| DevOps / Project Manager | Paula Trzcińska |
| Frontend | Patryk Stulczewski |
| Backend | Dawid Makielak |
| Administrator bazy danych | Krzysztof Trzęsicki |

## Funkcjonalności

**Dla klienta**

- przeglądanie katalogu produktów i kategorii
- zarządzanie koszykiem
- składanie zamówień
- rejestracja, logowanie i zarządzanie kontem użytkownika
- opcjonalna lokalna symulacja płatności

**Dla administratora**

- zarządzanie produktami i kategoriami (CRUD)
- zarządzanie cenami i stanami magazynowymi
- ukrywanie i ponowna aktywacja produktów
- podgląd i obsługa zamówień

## Technologie

| Obszar | Technologie |
| --- | --- |
| Frontend (web) | React, TypeScript, PWA |
| Frontend (mobile) | React Native (planowany) |
| Backend | Python, FastAPI |
| Baza danych | PostgreSQL |
| Chmura | AWS: S3, CloudFront, ECS Fargate, RDS PostgreSQL |

## Architektura

System oparty jest na architekturze trójwarstwowej. Aplikacja działa lokalnie oraz w chmurze AWS. Zmiany w `main` są wdrażane automatycznie po pomyślnym zakończeniu CI (zob. [Wdrożenie](#wdrożenie)).

1. **Warstwa Web** – aplikacja PWA (React + TypeScript), obsługująca interfejs użytkownika, formularze i komunikację z REST API. Hostowana w Amazon S3 z dystrybucją przez CloudFront.
2. **Warstwa API** – backend w Pythonie (FastAPI), odpowiedzialny za logikę biznesową, walidację danych, uwierzytelnianie JWT oraz obsługę zapytań do bazy danych. W chmurze działa jako kontener ECS Fargate w podsieci prywatnej, dostępny przez CloudFront pod tym samym adresem co frontend (`/api`).
3. **Warstwa Database** – relacyjna baza PostgreSQL, przechowująca dane aplikacji. Migracje schematu realizowane są przez Alembic. W chmurze jest to Amazon RDS w prywatnej podsieci VPC.

Komunikacja pomiędzy frontendem i backendem odbywa się przez REST API. Dostęp do PostgreSQL jest realizowany wyłącznie przez backend z wykorzystaniem SQLAlchemy.

### Schemat komunikacji

```mermaid
flowchart LR
    A["Frontend (React)"] <-->|HTTP / JSON| B["Backend (FastAPI)"]
    B <-->|SQLAlchemy| C[("PostgreSQL")]
```

## Struktura repozytorium

```text
.
├── .github/workflows/        # CI, analiza kodu i wdrożenie
├── web/                     # React + TypeScript, komponenty i testy Playwright
│   └── .env.example         # publiczne ustawienia Vite i lokalnego proxy
├── mobile/                  # miejsce na planowaną aplikację mobilną
├── backend/                 # FastAPI: api, schemas, services, models, tests
│   ├── .env.example         # połączenie z bazą i konfiguracja aplikacji
│   └── .env.runtime.example # JWT, tryb API i lokalna symulacja płatności
├── db/                      # migracje Alembic, role i skrypty PostgreSQL
│   └── .env.example         # ustawienia lokalnego kontenera PostgreSQL
├── infra/terraform/         # infrastruktura AWS
└── docs/                    # dokumentacja i raporty
```

Szablony `.env.example` są wersjonowane. Własne `.env`, `.env.runtime`, hasła i JWT
pozostają lokalnie; reguły `.gitignore` wykluczają je z repozytorium.

## Quick Start

Wymagane: Python 3.12+, uv, Node.js 22.12+ (plik `web/.nvmrc` wybiera 24),
npm 10+ oraz Docker z Compose. Poniższe polecenia Bash/WSL zaczynają się
w katalogu głównym repozytorium i uruchamiają API live z PostgreSQL 16.

**Live URL:** [https://d295uboxigcnkp.cloudfront.net](https://d295uboxigcnkp.cloudfront.net).

### 1. Przygotuj konfigurację

```bash
cp db/.env.example db/.env
cp backend/.env.example backend/.env
cp backend/.env.runtime.example backend/.env.runtime
cp web/.env.example web/.env
uv sync --locked --directory backend
```

W `db/.env` wpisz własne, niepuste hasła `POSTGRES_PASSWORD`,
`MIGRATION_DATABASE_PASSWORD` i `APP_DATABASE_PASSWORD`. W `backend/.env`
ustaw te same wartości: `DB_PASSWORD` = `APP_DATABASE_PASSWORD`,
`MIGRATION_DB_PASSWORD` = `MIGRATION_DATABASE_PASSWORD`.
Domyślne nazwy bazy i ról to `shop`, `shop_app` i `shop_migrator`.

W `backend/.env.runtime` pozostaw `API_MODE=live`, `APP_ENV=local` i ustaw
`JWT_SECRET` na losową wartość co najmniej 32 bajtów. Generator:

```bash
uv run --directory backend python -c 'import secrets; print(secrets.token_urlsafe(48))'
```

W `web/.env` ustaw `VITE_USE_MOCK_API=false`, pozostaw `VITE_API_BASE_URL=`
puste oraz `API_PROXY_TARGET=http://127.0.0.1:8000`.

### 2. Uruchom bazę, migracje i katalog przykładowy

```bash
docker compose --env-file db/.env -f db/compose.yaml up -d --wait
uv run --directory backend alembic -c ../db/alembic.ini upgrade head
docker compose --env-file db/.env -f db/compose.yaml exec -T postgres \
  psql -U shop_migrator -d shop -v ON_ERROR_STOP=1 \
  -f /project-scripts/grant-app-permissions.sql
uv run --directory backend python -m app.scripts.seed
```

Powyższe polecenia zakładają domyślne `POSTGRES_DB=shop` i port 5432.
Zmiana bazy lub portu wymaga spójnych ustawień `DB_NAME` i `DB_PORT` backendu.
Seed dodaje katalog demonstracyjny; nie tworzy kont ani zamówień.
Opcjonalny administrator: `uv run --directory backend python -m app.scripts.create_admin admin.local@example.com`.
CLI poprosi o hasło bez wyświetlania go w konsoli.

### 3. Uruchom API i frontend

W pierwszym terminalu, z katalogu głównego:

```bash
uv run --directory backend uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

W drugim terminalu:

```bash
cd web
npm ci
npm run dev
```

| Adres lokalny | Przeznaczenie |
| --- | --- |
| [http://localhost:5173](http://localhost:5173) | Aplikacja webowa |
| [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | Swagger UI |
| [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) | Stan procesu API |

Publiczna aplikacja: [Live URL](https://d295uboxigcnkp.cloudfront.net).

Szczegóły ról i konfiguracji PostgreSQL: [db/README.md](db/README.md).
Instrukcja PowerShell, testy i integracja lokalna: [docs/blok06-local.md](docs/blok06-local.md).

## API Endpoints

API udostępnia katalog, konta i JWT, koszyk, zamówienia oraz lokalną symulację płatności.

Prefiks poniższych ścieżek: `/api/v1`. Chronione żądania wymagają
`Authorization: Bearer <access_token>`; dostęp administracyjny sprawdza backend.
Osobny `GET /health` zwraca `200` poza prefiksem API.

| Metoda | Endpoint | Dostęp | Sukces | Działanie |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | Publiczny | 201 | Rejestracja klienta |
| POST | `/auth/login` | Publiczny | 200 | JWT access i refresh |
| POST | `/auth/refresh` | Refresh token | 200 | Odświeżenie sesji |
| GET | `/auth/me` | Użytkownik | 200 | Odczyt profilu |
| PATCH | `/auth/me` | Użytkownik | 200 | Zmiana profilu i adresu |
| POST | `/auth/change-password` | Użytkownik | 204 | Zmiana hasła |
| GET | `/categories` | Publiczny | 200 | Lista kategorii |
| GET | `/categories/{category_id}` | Publiczny | 200 | Szczegóły kategorii |
| POST | `/categories` | Administrator | 201 | Dodanie kategorii |
| PATCH | `/categories/{category_id}` | Administrator | 200 | Edycja kategorii |
| DELETE | `/categories/{category_id}` | Administrator | 204 | Usunięcie pustej kategorii |
| GET | `/products` | Publiczny | 200 | Lista, filtry i paginacja |
| GET | `/products/{product_id}` | Publiczny | 200 | Szczegóły aktywnego produktu |
| POST | `/products` | Administrator | 201 | Dodanie produktu |
| PATCH | `/products/{product_id}` | Administrator | 200 | Edycja produktu |
| DELETE | `/products/{product_id}` | Administrator | 204 | Dezaktywacja; opcjonalnie `hard=true` |
| GET | `/cart` | Użytkownik | 200 | Odczyt koszyka |
| POST | `/cart/items` | Użytkownik | 201 | Dodanie pozycji |
| PATCH | `/cart/items/{item_id}` | Użytkownik | 200 | Ustawienie ilości |
| DELETE | `/cart/items/{item_id}` | Użytkownik | 200 | Usunięcie pozycji |
| POST | `/orders` | Użytkownik | 201 | Zamówienie z koszyka |
| GET | `/orders` | Właściciel | 200 | Historia zamówień |
| GET | `/orders/{order_id}` | Właściciel | 200 | Szczegóły zamówienia |
| GET | `/orders/admin/all` | Administrator | 200 | Wszystkie zamówienia |
| PATCH | `/orders/{order_id}/status` | Administrator | 200 | Zmiana statusu |
| POST | `/payments/mock/sessions` | Właściciel, local/test | 201 | Symulowana sesja płatności |
| POST | `/payments/mock/{payment_id}/complete` | Właściciel, local/test | 200 | Symulacja wyniku płatności |
| GET | `/payments/{payment_id}/status` | Właściciel | 200 | Status płatności |

Operacje `/payments/mock/*` wymagają `PAYMENTS_MOCK=true` i są wyłączone
w środowisku produkcyjnym. Wgląd w nieaktywne produkty wymaga administratora.
Lista produktów zwraca `X-Total-Count`; złożenie zamówienia obsługuje UUID
w nagłówku `Idempotency-Key`.

Przykładowe żądanie `POST /api/v1/products`:

```json
{
  "name": "Legowisko testowe",
  "slug": "legowisko-testowe",
  "price": "199.99",
  "stock_quantity": 3,
  "category_id": 1,
  "is_active": true
}
```

API zwraca odpowiednie kody HTTP, m.in. `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `429` i `500`.

Pełny opis endpointów, przykłady odpowiedzi JSON oraz kodów HTTP znajduje się w [docs/api-contract.md](docs/api-contract.md).

## Testowanie

Projekt wykorzystuje pytest oraz Playwright (Chromium, domyślnie headless).
Wymagane są Python 3.12+, uv oraz Node.js zgodny z `web/.nvmrc` i npm 10+.

| Zestaw | Zakres |
| --- | --- |
| API — pytest | Endpointy REST, kody HTTP, JSON, walidacja, role, CORS i nagłówki: `Content-Type`, `WWW-Authenticate`, `Cache-Control`, `X-Total-Count` oraz nagłówki bezpieczeństwa |
| UI — Playwright contract | Katalog desktop/mobile, logowanie, koszyk, checkout, panel administratora, błędy i PWA offline; przykładowe odpowiedzi API bez trwałych zapisów |
| E2E — Playwright live, faza `purchase` | Pełna ścieżka klienta przez React → FastAPI → PostgreSQL, bez mockowania żądań; zapis koszyka i zamówienia sprawdzany po odświeżeniu |

### API i UI bez bazy danych

Z katalogu głównego repozytorium:

```bash
cd backend
uv sync --locked
uv run pytest -q --junitxml=test-results/pytest.xml
cd ../web
npm ci
npx playwright install --with-deps chromium
npm run typecheck
npm run test:e2e
```

Bez `TEST_DATABASE_URL` testy wymagające PostgreSQL mają status `skipped`.
Playwright sam buduje frontend i uruchamia kontraktowe API na porcie 18000
oraz podgląd na 4175. Nie trzeba wcześniej uruchamiać serwerów.

### Pełna ścieżka zakupu na PostgreSQL

Poniższe polecenia Bash/WSL uruchamiają osobną lokalną bazę testową (Docker),
migracje i katalog demonstracyjny. Nie wymagają konta administratora.
Test tworzy klienta z unikalnym e-mailem, kupuje dwie sztuki `Pufa welurowa DOT`,
sprawdza kwotę 898,00 zł, adres dostawy, historię i status zamówienia oraz pusty koszyk.

```bash
# Z katalogu głównego; baza wyłącznie do testów, bez trwałego wolumenu.
docker run --rm -d --name zdechpies-e2e-db \
  -p 127.0.0.1:55432:5432 \
  -e POSTGRES_DB=shop_e2e_test -e POSTGRES_PASSWORD=local-test-only \
  postgres:16-alpine
# Poczekaj na wynik "accepting connections"; w razie potrzeby ponów.
docker exec zdechpies-e2e-db pg_isready -U postgres -d shop_e2e_test

export DB_HOST=127.0.0.1 DB_PORT=55432 DB_NAME=shop_e2e_test
export DB_USER=postgres DB_PASSWORD=local-test-only
export MIGRATION_DB_USER=postgres MIGRATION_DB_PASSWORD=local-test-only
export API_MODE=live APP_ENV=test CREATE_DEFAULT_ADMIN=false PAYMENTS_MOCK=false
export AUTH_RATE_LIMIT=1000
cd backend
uv sync --locked
export JWT_SECRET=$(uv run python -c 'import secrets; print(secrets.token_urlsafe(48))')
uv run alembic -c ../db/alembic.ini upgrade head
uv run python -m app.scripts.seed

# Wszystkie testy backendu, łącznie z integracyjnymi na izolowanych schematach.
export TEST_DATABASE_URL=postgresql+asyncpg://postgres:local-test-only@127.0.0.1:55432/shop_e2e_test
uv run pytest -q --junitxml=test-results/pytest.xml

cd ../web
npm ci
npx playwright install --with-deps chromium
export E2E_ALLOW_WRITES=local-test-database E2E_PHASE=purchase
npm run test:e2e:live

# Po testach: zatrzymanie kontenera usuwa tę tymczasową bazę.
docker stop zdechpies-e2e-db
```

Playwright uruchamia API live na porcie 18001 i frontend na 4176.
Scenariusz pozostawia klienta i zamówienie w bazie testowej; kolejne uruchomienia
tworzą nowe konto i zużywają stan produktu. Na świeżej bazie seed zapewnia 20 sztuk.
Przy własnej bazie wskaż ją w zmiennych `DB_*` lub `backend/.env` i wykonaj migracje
oraz seed. Hasła powyżej służą wyłącznie tymczasowemu lokalnemu kontenerowi.
Instrukcja PowerShell i pozostałe fazy live (`crud`, `restart`, `offline`):
[docs/blok06-local.md](docs/blok06-local.md#e5-testy).

### Raporty, błędy i wyniki CI

| Pliki | Zawartość |
| --- | --- |
| `backend/test-results/pytest.xml` | Raport JUnit API i bazy: wyniki, błędy, pominięcia |
| `web/playwright-report/contract/`, `web/playwright-report/live/` | Raporty HTML z krokami i załącznikami |
| `web/test-results/contract-junit.xml`, `web/test-results/live-junit.xml` | Raporty JUnit Playwright |
| `web/test-results/contract/`, `web/test-results/live/` | Screenshot `.png` i nagranie `.webm` przy błędzie; dodatkowo `trace.zip` dla testów kontraktowych |

Otwieranie raportów i trace z katalogu `web/`:

```bash
npx playwright show-report playwright-report/contract
npx playwright show-report playwright-report/live
npx playwright show-trace test-results/contract/<katalog-testu>/trace.zip
```

Trace live jest wyłączony, ponieważ zawierałby treść żądań logowania.
Screenshoty i wideo live pokazują interfejs z zamaskowanym hasłem.

W GitHub otwórz **Actions → CI → wybrane uruchomienie**. Joby `Frontend build
and tests (web)`, `Backend build and tests (backend)` i `Customer purchase E2E
(headless, live API)` zawierają logi. W sekcji **Artifacts** pobierz odpowiednio
`playwright-contract-results`, `pytest-results` lub `playwright-live-results`.
Raporty są wysyłane również po błędzie i przechowywane przez 14 dni; załączniki
diagnostyczne powstają tylko dla nieudanych testów (w tym nieudanej pierwszej próby).
Po rozpakowaniu artefaktu Playwright otwórz jego katalog raportu przez
`npx playwright show-report <katalog-z-index.html>`.

`passed` oznacza sukces, `failed` błąd testu, `skipped` pominięcie (lokalnie
najczęściej brak bazy), a `flaky` sukces po ponowieniu. Testy kontraktowe w CI
mają jedno ponowienie; test zakupu live nie jest ponawiany. Nieudany test daje
niezerowy kod wyjścia i blokuje `CI status`, a przez to automatyczne wdrożenie.

## Integracja ciągła (CI)

Workflow GitHub Actions [`.github/workflows/ci.yml`](.github/workflows/ci.yml) uruchamia się przy każdym pushu i pull requeście do `main`:

1. **Secret scan** – Gitleaks przeszukuje historię commitów pod kątem kluczy, haseł i tokenów; wyciek zatrzymuje pipeline przed budowaniem.
2. **Vulnerability scan** – Trivy sprawdza zależności `web/` i `backend/` (CVE), sekrety w drzewie oraz konfigurację Dockerfile i Terraform; wyniki trafiają do zakładki Security.
3. **Build & test** – równolegle: frontend (`typecheck`, `build`, testy Playwright headless, obraz Nginx), backend (`uv sync --locked`, kompilacja, `pytest` na PostgreSQL 16), osobny E2E zakupu na rzeczywistym API i PostgreSQL oraz infrastruktura (`terraform fmt`, `validate`). Raporty i materiały z błędów są zapisywane jako artefakty.
4. **CI status** – zbiorczy status wymagany przez ochronę gałęzi `main`; scalenie jest możliwe tylko po sukcesie wszystkich jobów.

Uzupełnieniem są CodeQL (analiza statyczna TypeScript i Python) oraz Dependabot (cotygodniowe aktualizacje zależności i alerty bezpieczeństwa). Opis jobów, zasady ochrony gałęzi i lokalne uruchomienie skanerów: [docs/ci.md](docs/ci.md).

## Wdrożenie

Wdrożenie do AWS jest w pełni automatyczne (Continuous Deployment). Po scaleniu
zmiany do `main` i zielonym workflow CI uruchamia się workflow
[`deploy.yml`](.github/workflows/deploy.yml):

1. logowanie do AWS kluczem technicznego użytkownika IAM `pz-github-deploy`
   (sekrety środowiska GitHub `production`, dostępne tylko dla `main`; OIDC
   blokuje na tym koncie polityka SCP planu Free),
2. równolegle: publikacja buildu frontendu do S3 i unieważnienie cache CloudFront
   oraz budowa obrazu backendu, push do ECR, migracje bazy i aktualizacja usługi
   ECS Fargate,
3. healthcheck publicznego adresu: `/health` i `/version.json` muszą zwrócić
   wdrożony commit.

Infrastruktura (S3, CloudFront, ECR, ECS, NLB, użytkownik IAM wdrożenia, punkty końcowe VPC) jest
opisana w Terraform w [`infra/terraform`](infra/terraform). Szczegóły:
[docs/deployment.md](docs/deployment.md).

## Reguły bezpieczeństwa sieci (Blok 9, E5)

Poniższa tabela opisuje reguły inbound i outbound zapisane w Terraform dla
trzech warstw aplikacji. Porty odpowiadają domyślnym wartościom
`app_port=8000` i `db_port=5432`.

| Warstwa / grupa | Inbound: protokół, port, źródło | Outbound: protokół, port, cel |
| --- | --- | --- |
| Publiczny Web: CloudFront (poza VPC, bez SG) | HTTP 80 z przekierowaniem na HTTPS; HTTPS 443 z Internetu | HTTPS do prywatnego S3 przez OAC; HTTP 80 do wewnętrznego NLB przez origin VPC |
| Web w VPC: NLB, `web-sg` | TCP 80 i 443 z `0.0.0.0/0`; NLB jest **internal**, listener działa na 80 | Wszystkie protokoły i porty do `0.0.0.0/0`; komunikacja z API i healthcheck używają TCP 8000 do `app-sg` |
| App: ECS Fargate, `app-sg` | TCP 8000 **tylko z `web-sg`** | Wszystkie protokoły i porty do `0.0.0.0/0`; wymagane połączenia: TCP 5432 do `db-sg` oraz TCP 443 do endpointów AWS i S3 |
| DB: RDS PostgreSQL, `db-sg` | TCP 5432 **tylko z `app-sg`** | TCP 5432 do `app-sg`; ta reguła nie jest potrzebna do odpowiedzi na połączenia inicjowane przez aplikację |
| Usługi pomocnicze: endpointy VPC, `vpce-sg` | TCP 443 tylko z `app-sg` | Brak jawnych reguł w Terraform; odpowiedzi na dozwolone połączenia są dopuszczane stanowo |

Security Groups są stanowe: odpowiedzi na dozwolone połączenia nie wymagają
osobnego otwierania portów. W konfiguracji grup projektu nie ma reguł wejściowych
SSH 22 ani RDP 3389, ani publicznego dostępu do portów 8000 i 5432 przez IPv4
lub IPv6. Backend i RDS nie mają publicznych adresów IP. Podsieci prywatne
nie mają trasy domyślnej do Internetu; backend korzysta z endpointów VPC.

Szerokie reguły outbound `web-sg` i `app-sg` pozostają ograniczeniem obecnej
konfiguracji. Tabela przedstawia stan opisany w kodzie, a nie deklarację
minimalnych uprawnień dla całego ruchu wychodzącego.

Źródła reguł i przypisań: [main.tf](infra/terraform/main.tf),
[app.tf](infra/terraform/app.tf), [web.tf](infra/terraform/web.tf)
i [endpoints.tf](infra/terraform/endpoints.tf).

## Organizacja pracy

- zadania prowadzimy w GitHub Projects (tablica Kanban),
- każda zmiana trafia do gałęzi `main` przez Pull Request z przeglądem kodu,
- scalenie wymaga zielonego statusu CI (testy, skan sekretów i podatności).

## Architektura wdrożenia AWS

Poniższy diagram Mermaid odpowiada wdrożeniu opisanemu w Terraform.
S3 i CloudFront udostępniają frontend, a API i baza pozostają w sieci prywatnej.

```mermaid
flowchart TB
    U["Przeglądarka / React PWA"] -->|HTTPS| CF["Amazon CloudFront"]
    CF -->|"Pliki statyczne / OAC"| S3[("Prywatny bucket S3")]
    subgraph VPC["AWS VPC"]
        NLB["Wewnętrzny NLB"] -->|"HTTP 8000"| API["FastAPI / ECS Fargate"]
        API -->|"PostgreSQL 5432 / TLS"| DB[("RDS PostgreSQL 16")]
    end
    CF -->|"/api/* i dokumentacja / VPC origin"| NLB
```

CloudFront przekazuje również `/health`, `/docs` i `/openapi.json` do API.
Szczegóły sieci, sekretów i pipeline'u: [docs/deployment.md](docs/deployment.md).
