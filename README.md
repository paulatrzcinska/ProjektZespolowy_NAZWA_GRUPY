# Z Dech Pies

Wieloplatformowa aplikacja e-commerce umożliwiająca przeglądanie produktów, zarządzanie koszykiem, składanie zamówień oraz obsługę płatności internetowych.

System obejmuje aplikację webową PWA (React), backend oparty na FastAPI i PostgreSQL oraz panel administracyjny do zarządzania ofertą sklepu. W dalszych etapach planowany jest rozwój aplikacji mobilnej (React Native) i integracja z rzeczywistą bramką płatności.

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
| Chmura | AWS (docelowo) |

## Architektura

System oparty jest na architekturze trójwarstwowej. Aplikacja działa lokalnie oraz w chmurze AWS, do której jest wdrażana automatycznie po każdej zmianie w `main` (zob. [Wdrożenie](#wdrożenie)).

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
├── web/        # aplikacja PWA (React + TypeScript)
├── mobile/     # aplikacja mobilna (React Native)
├── backend/    # API (FastAPI)
├── db/         # migracje, skrypty i dane testowe bazy
├── infra/      # konfiguracja infrastruktury AWS
└── docs/       # dokumentacja projektu
```

## Uruchomienie lokalne

Do uruchomienia aplikacji wymagane są Python 3.12+, uv, Node.js, npm oraz PostgreSQL 16.

1. Przygotuj bazę PostgreSQL, role i migracje zgodnie z instrukcją [db/README.md](db/README.md).
2. W katalogu `backend/` zainstaluj zależności poleceniem `uv sync --locked`.
3. Przygotuj pliki `.env` oraz `.env.runtime` na podstawie dostępnych szablonów i ustaw `API_MODE=live`.
4. Uruchom backend:

   ```bash
   uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

5. W katalogu `web/` zainstaluj zależności za pomocą `npm ci`, przygotuj plik `.env` i ustaw `VITE_USE_MOCK_API=false` oraz `API_PROXY_TARGET=http://127.0.0.1:8000`.
6. Uruchom frontend:

   ```bash
   npm run dev
   ```

Frontend będzie dostępny pod adresem wskazanym przez Vite, a dokumentacja Swagger API pod `http://127.0.0.1:8000/docs`.

Szczegółowa instrukcja konfiguracji bazy, środowiska lokalnego i testów integracyjnych znajduje się w [docs/blok06-local.md](docs/blok06-local.md).

## API Endpoints

API udostępnia operacje CRUD dla produktów i kategorii oraz obsługę użytkowników, koszyka i zamówień.

Prefiks API: `/api/v1`.

| Metoda | Endpoint | Działanie |
| --- | --- | --- |
| GET | `/products` | Lista produktów |
| POST | `/products` | Dodanie produktu |
| PATCH | `/products/{id}` | Edycja produktu |
| DELETE | `/products/{id}` | Ukrycie lub usunięcie produktu |
| GET | `/categories` | Lista kategorii |
| POST | `/categories` | Dodanie kategorii |
| PATCH | `/categories/{id}` | Edycja kategorii |
| DELETE | `/categories/{id}` | Usunięcie pustej kategorii |
| POST | `/auth/login` | Logowanie użytkownika |
| GET | `/cart` | Odczyt koszyka |
| GET, POST | `/orders` | Pobieranie i tworzenie zamówień |

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

API zwraca odpowiednie kody HTTP, m.in. `200`, `201`, `204`, `400`, `401`, `403`, `404` i `409`.

Pełny opis endpointów, przykłady odpowiedzi JSON oraz kodów HTTP znajduje się w [docs/api-contract.md](docs/api-contract.md).

## Testowanie

Projekt wykorzystuje pytest do testowania backendu oraz Playwright do weryfikacji interfejsu użytkownika i integracji E2E.

Podstawowe polecenia:

```bash
# backend/
uv run pytest

# web/
npm run typecheck
npm run build
npm run test:e2e
```

Dodatkowo dostępne są testy pełnej integracji z rzeczywistą bazą PostgreSQL:

```bash
npm run test:e2e:live
```

Testy kontraktowe weryfikują interfejs i zgodność z API, natomiast testy live sprawdzają rzeczywisty przepływ danych pomiędzy React, FastAPI i PostgreSQL.

Szczegóły przygotowania środowiska testowego i scenariuszy znajdują się w [docs/blok06-local.md](docs/blok06-local.md).

## Integracja ciągła (CI)

Workflow GitHub Actions [`.github/workflows/ci.yml`](.github/workflows/ci.yml) uruchamia się przy każdym pushu i pull requeście do `main`:

1. **Secret scan** – Gitleaks przeszukuje historię commitów pod kątem kluczy, haseł i tokenów; wyciek zatrzymuje pipeline przed budowaniem.
2. **Vulnerability scan** – Trivy sprawdza zależności `web/` i `backend/` (CVE), sekrety w drzewie oraz konfigurację Dockerfile i Terraform; wyniki trafiają do zakładki Security.
3. **Build & test** – równolegle: frontend (`typecheck`, `build`, testy Playwright, obraz Nginx), backend (`uv sync --locked`, kompilacja, `pytest` na PostgreSQL 16) i infrastruktura (`terraform fmt`, `validate`).
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

## Zespół

| Rola | Osoba |
| --- | --- |
| DevOps / Project Manager | Paula Trzcińska |
| Frontend | Patryk Stulczewski |
| Backend | Dawid Makielak |
| Administrator bazy danych | Krzysztof Trzęsicki |

## Organizacja pracy

- zadania prowadzimy w GitHub Projects (tablica Kanban),
- każda zmiana trafia do gałęzi `main` przez Pull Request z przeglądem kodu,
- scalenie wymaga zielonego statusu CI (testy, skan sekretów i podatności).

## Architektura 3-tier

Poniższy diagram przedstawia docelową architekturę aplikacji w chmurze AWS.

<img width="909" height="1033" alt="Architektura 3-tier" src="https://github.com/user-attachments/assets/0c23df7d-5dce-4907-9fde-ff9c1a3d367d" />
