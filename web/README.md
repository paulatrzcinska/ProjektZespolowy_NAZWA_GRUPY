# Web / PWA

React + TypeScript + Vite, React Router, TanStack Query i Tailwind CSS.
Aplikacja korzysta z REST API opisanego w [`docs/api-contract.md`](../docs/api-contract.md).

## Uruchomienie lokalne

Wymagane Node.js 22.12+ (plik `.nvmrc` wybiera 24), npm 10+ i uv dla backendu.
W pierwszym terminalu, z katalogu głównego repozytorium:

```bash
cd backend
uv sync --locked
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

W drugim terminalu:

```bash
cd web
cp .env.example .env
npm ci
npm run dev
```

Sklep: http://localhost:5173. Vite przekazuje żądania `/api` do
`API_PROXY_TARGET` (domyślnie `http://127.0.0.1:8000`). Swagger API:
http://127.0.0.1:8000/docs. `VITE_API_BASE_URL` pozostaw puste przy proxy.
Zwykłe uruchomienie developerskie nie instaluje service workera.

## Funkcjonalności i trasy

| Trasa                      | Funkcja                                                           | Dostęp                            |
| -------------------------- | ----------------------------------------------------------------- | --------------------------------- |
| `/`                        | Katalog, kategorie, wyszukiwanie, sortowanie i paginacja          | Publiczny                         |
| `/products/:id`            | Szczegóły, dostępność i dodawanie do koszyka                      | Publiczny; dodanie po zalogowaniu |
| `/login`                   | Logowanie i rejestracja                                           | Publiczny                         |
| `/cart`                    | Ilości, usuwanie pozycji i podsumowanie koszyka                   | Klient                            |
| `/checkout`                | Dane wysyłki i złożenie zamówienia                                | Klient                            |
| `/orders/:orderId/summary` | Podsumowanie i adres dostawy                                      | Właściciel zamówienia             |
| `/orders/:orderId/status`  | Odczyt statusu z automatycznym odświeżaniem oczekujących zamówień | Właściciel zamówienia             |
| `/profil/dane`             | Profil, adres i zmiana hasła                                      | Klient                            |
| `/profil/zamowienia`       | Historia zamówień                                                 | Klient                            |
| `/admin`                   | Tworzenie, edycja i ukrywanie produktów                           | Administrator                     |
| `/admin/categories`        | Tworzenie, edycja i usuwanie kategorii                            | Administrator                     |
| `/admin/orders`            | Lista i zmiana statusu zamówień                                   | Administrator                     |

Frontend wysyła JSON zgodny z BE-2, kwoty jako stringi dziesiętne i token Bearer
wyłącznie dla chronionych żądań. Paginacja katalogu korzysta z `X-Total-Count`.
Odpowiedzi `204` nie są parsowane jako JSON. Błędy domenowe i walidacja `422`
są pokazywane przy odpowiednich formularzach. `401` kończy sesję; `403` nie
wylogowuje użytkownika. Role w interfejsie nie zastępują autoryzacji API.

Kwoty koszyka i zamówienia pochodzą z odpowiedzi serwera. Checkout przesyła tylko
adres oraz nagłówek UUID `Idempotency-Key`. Ponowienie identycznego formularza
po błędzie używa tego samego klucza w ramach otwartego widoku.
Zmiany koszyka aktualizują wspólny stan i licznik w nagłówku. Wylogowanie czyści
cache zapytań użytkownika. Token jest przechowywany w `localStorage`; aplikacja
nie przechowuje haseł ani kluczy do usług zewnętrznych.

## API i środowisko backendu

Dla backendu z logiką biznesową zastosuj również patch bazy, ustaw `.env`
oraz `.env.runtime` i wygeneruj losowy `JWT_SECRET`. Szczegóły opisuje
[`docs/backend-runtime.md`](../docs/backend-runtime.md). Produkty muszą znajdować
się w bazie; opcjonalny seed dodaje katalog demonstracyjny. Rejestracja i zapisy
wykonują rzeczywiste operacje w PostgreSQL.

Panel administratora wymaga konta utworzonego przez CLI backendu. Użytkownik
nie może nadać sobie tej roli przez formularz. Zmiana hasła kończy bieżącą sesję;
interfejs prosi o ponowne logowanie. Szczegóły nieaktywnych produktów w panelu
są pobierane z tokenem administratora i nie trafiają do cache offline.

Testy kontraktu interfejsu uruchamiają backend z `API_MODE=contract` i
`APP_ENV=test`. W tym jawnym trybie odpowiedzi są przykładowe, zapisy nie są
trwałe, a filtry są tylko parametrami żądań. Konta przykładowe i tokeny
`example-user-token` / `example-admin-token` dotyczą wyłącznie tego trybu.
Docelową autoryzację sprawdzają testy integracyjne backendu na PostgreSQL.

Frontend nie ma jeszcze widoku płatności. Lokalna symulacja backendu może być
obsłużona przez Swagger UI; jej endpointy i włączenie są opisane w dokumentacji
backendu. Interfejs odczytuje status zamówienia z API.

## Build i PWA

```bash
npm run typecheck
npm run build
npm run preview
```

Podgląd: http://localhost:4173. Gotowe pliki statyczne: `web/dist/`.
Instalacja PWA wymaga HTTPS lub localhost. Manifest zawiera ikony PNG
192/512, ikonę maskowalną i metadane aplikacji. Aktualizacja service workera
wymaga potwierdzenia użytkownika, aby nie przerywać formularza zamówienia.

Offline działa po wcześniejszej wizycie online w zbudowanej aplikacji:

- Zasoby aplikacji są zapisane w cache service workera.
- Publiczna lista produktów: Network First, maks. 20 zapytań przez 7 dni.
- Szczegóły: Stale While Revalidate, maks. 80 produktów przez 7 dni.
- Kategorie: Stale While Revalidate, maks. 5 odpowiedzi przez 7 dni.
- Cache katalogu obejmuje tylko publiczne żądania `GET /api/v1/...` z tej samej
  domeny. Żądania z `Authorization` i `include_inactive` nie trafiają do niego.
- Profil, koszyk, zamówienia, panel administratora i zapisy wymagają sieci.
  Service worker nie przechowuje ich odpowiedzi. Ostatni stan widoku może
  pozostać w pamięci do odświeżenia lub wylogowania.

Tryb offline nie potwierdza aktualnych cen i stanów magazynowych. Przy osobnej
domenie API (`VITE_API_BASE_URL`) dane działają online; cache katalogu dotyczy
wyłącznie wariantu z `/api` pod domeną sklepu.

## Hosting na AWS

`npm run build` tworzy pliki do prywatnego bucketa S3 udostępnianego przez
CloudFront po HTTPS. Aplikacja nie potrzebuje serwera Node.js w chmurze.

Przy domyślnym `VITE_API_BASE_URL=` CloudFront powinien mieć osobny origin
i behavior `/api/*` kierujący do wejścia warstwy API. Instancje API i RDS
pozostają w prywatnych podsieciach; przeglądarka nigdy nie łączy się z nimi
bezpośrednio. Przekazuj metody HTTP oraz nagłówki `Authorization`,
`Content-Type` i `Idempotency-Key`; cache odpowiedzi API w CDN wyłącz.

Dla originu S3 należy obsłużyć trasy SPA, takie jak `/profil/dane`, przez
zwrócenie `index.html`. Ta reguła nie może obejmować `/api/*` ani zamieniać
błędów API w HTML. `index.html`, `sw.js` i manifest wymagają odświeżania;
pliki z hashem w `assets/` mogą mieć długi cache. CORS backendu powinien
zezwalać na domenę sklepu i udostępniać `X-Total-Count`.

Alternatywnie ustaw przed buildem `VITE_API_BASE_URL=https://api.example.com`
(bez `/api/v1`). Jest to publiczny adres wejścia API, nigdy wewnętrzny host
VPC. `API_PROXY_TARGET` działa tylko podczas dev/preview. Zmienne `VITE_*`
są widoczne w bundlu, więc nie mogą zawierać sekretów. Konfiguracja AWS i
wdrożenie pozostają poza zakresem frontendu.

## Testy w przeglądarce

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

Na Linuxie mogą być potrzebne zależności systemowe Chromium, instalowane przez
`npx playwright install --with-deps chromium`. Do uruchomienia backendu w testach
wymagane są Python 3.12+ i `uv` w `PATH`.

Playwright buduje aplikację i sam uruchamia API na `127.0.0.1:18000` oraz podgląd
na `127.0.0.1:4175`. Testy obejmują desktop i viewport mobilny, przepływy klienta,
CRUD administratora, błędy API oraz rzeczywisty cache service workera offline.
Podstawą są endpointy BE-2. Wybrane błędy oraz odpowiedź zmiany ilości koszyka
są symulowane, ponieważ backend kontraktowy nie ma trwałego stanu.

## Struktura

```text
web/
  public/        # manifest i ikony
  src/
    api/         # klient HTTP i typy kontraktu
    auth/        # sesja użytkownika
    components/  # layout, UI, karty produktów
    hooks/       # wspólny koszyk i pobieranie zamówienia
    pages/       # katalog, zakup, profil i administracja
    routes/      # ochrona tras
    styles/
  tests/         # Playwright
  vite.config.ts
```
