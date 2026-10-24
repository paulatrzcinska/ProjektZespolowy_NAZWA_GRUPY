# Baza danych

PostgreSQL 16, modele SQLAlchemy 2 i migracje Alembic. Schemat obejmuje
użytkowników, kategorie, produkty, koszyki, zamówienia, płatności i klucze
idempotencji zamówień. Dane przykładowe katalogu są osobnym, opcjonalnym krokiem.

## Uruchomienie lokalne

Wymagane Docker z Compose, Python 3.12+ i uv. Polecenia zaczynają się w katalogu
głównym repozytorium:

```bash
cp db/.env.example db/.env
cp backend/.env.example backend/.env
docker compose --env-file db/.env -f db/compose.yaml up -d --wait
cd backend
uv sync --locked
uv run alembic -c ../db/alembic.ini upgrade head
cd ..
docker compose --env-file db/.env -f db/compose.yaml exec -T postgres psql -U shop_migrator -d shop -f /project-scripts/grant-app-permissions.sql
```

Wartości haseł w `db/.env` i URL-ach `backend/.env` muszą być zgodne. Pliki
przykładowe mają dopasowane ustawienia lokalne. Jeśli zmienisz `POSTGRES_DB`
lub `POSTGRES_PORT`, zmień też URL-e backendu. Hasła ze znakami specjalnymi
w URL-u należy zakodować procentowo.

Port jest publikowany wyłącznie na `127.0.0.1`. Dane pozostają w nazwanym
wolumenie `postgres_data`. Skrypt inicjalizujący role wykonuje się tylko podczas
pierwszego uruchomienia pustego wolumenu; edycja `.env` nie zmienia istniejących
haseł ani schematu.

## Role i połączenia

| Rola | Zastosowanie | Uprawnienia |
| --- | --- | --- |
| `postgres` | Lokalny bootstrap kontenera | Administracja lokalnym serwerem; nieużywana przez API |
| `shop_migrator` | Alembic i utrzymanie schematu | Właściciel bazy i schematu; bez SUPERUSER, CREATEDB i CREATEROLE |
| `shop_app` | Backend i opcjonalny seed katalogu | SELECT/INSERT/UPDATE/DELETE danych, użycie sekwencji i typów; bez DDL i dostępu do `alembic_version` |

Skrypt [grant-app-permissions.sql](scripts/grant-app-permissions.sql) uruchamia
się po migracjach. Nadaje dostęp do obecnych tabel oraz domyślne uprawnienia
do przyszłych tabel i sekwencji tworzonych przez `shop_migrator` w `public`.
Metadane Alembic pozostają poza uprawnieniami aplikacji.

Backend używa `DATABASE_URL` ze sterownikiem `postgresql+asyncpg`. Alembic używa
`MIGRATION_DATABASE_URL`, a gdy jej nie ustawiono — `DATABASE_URL`. Do migracji
potrzebne jest konto mogące zarządzać schematem. Migracje nie uruchamiają się
automatycznie przy starcie API. Zależność `app.database.get_db` udostępnia sesję
na żądanie; zapis wymaga jawnego `commit`, a zamknięcie sesji cofa niezapisane
zmiany. Po zatrzymaniu aplikacji pula połączeń jest zamykana.

Endpointy kontraktu API nadal zwracają dane przykładowe. Podłączenie operacji
HTTP do sesji i logiki biznesowej jest kolejnym etapem.

## Schemat i integralność

```mermaid
erDiagram
    users ||--o| carts : owns
    users ||--o{ orders : places
    categories ||--o{ products : groups
    carts ||--o{ cart_items : contains
    products ||--o{ cart_items : references
    orders ||--o{ order_items : contains
    products ||--o{ order_items : references
    orders ||--o{ payments : has
    users ||--o{ order_idempotency_keys : requests
    orders ||--o{ order_idempotency_keys : identifies
```

- E-mail użytkownika i slugi kategorii/produktów mają unikalne indeksy.
- Jeden użytkownik ma najwyżej jeden koszyk; para koszyk–produkt jest unikalna.
- Cena produktu i cena pozycji zamówienia są dodatnie; stan magazynowy nieujemny.
  Ilość w koszyku wynosi 1–999, w pozycji zamówienia musi być dodatnia.
- Kwoty używają `NUMERIC`, nie floatów. Ceny jednostkowe mają typ `NUMERIC(12,2)`,
  sumy zamówień i płatności `NUMERIC(14,2)`. `amount_minor` ma typ BIGINT i musi
  odpowiadać `amount * 100`.
- Statusy są natywnymi ENUM PostgreSQL: zamówienia `pending`, `paid`, `shipped`,
  `cancelled`; płatności `pending`, `awaiting_payment`, `paid`, `failed`.
- Dane wysyłki oraz nazwa i cena produktu są zapisywane w zamówieniu jako snapshot.
  Przejścia statusów, wyliczanie sum i kontrola właściciela należą do logiki API.
- Produktu użytego w koszyku/zamówieniu ani kategorii z produktami nie można
  fizycznie usunąć. Zamówienia chronią powiązanego użytkownika, a płatności
  i klucze idempotencji chronią powiązane zamówienie.
- Koszyk i jego pozycje są usuwane kaskadowo; klucze obce utrzymują spójność
  również przy operacjach wykonywanych bez ORM.
- Daty są przechowywane ze strefą czasową. `updated_at` odświeża ORM przy zmianie
  danego rekordu przez SQLAlchemy; bezpośredni SQL musi ustawić tę wartość jawnie.

Płatność ma neutralne pola `provider`, `session_id`, `provider_token`
i `provider_order_id`. Schemat nie rozstrzyga wyboru bramki płatności. Nie zawiera
danych kart. Klucz idempotencji jest unikalny globalnie; właściwy retry i
weryfikację użytkownika zrealizuje serwis zamówień.

## Migracje

Wszystkie zmiany schematu znajdują się w [alembic](alembic/), a konfiguracja
w [alembic.ini](alembic.ini). Modele SQLAlchemy pozostają w `backend/app/models`.
Pierwsza rewizja tworzy kompletny pusty schemat. Dane demonstracyjne i konta
administratorów nie są częścią migracji.

Polecenia uruchamiaj z katalogu `backend`, aby korzystały z jego zależności
i pliku `.env`:

```bash
uv run alembic -c ../db/alembic.ini current
uv run alembic -c ../db/alembic.ini check
uv run alembic -c ../db/alembic.ini revision --autogenerate -m "describe schema change"
uv run alembic -c ../db/alembic.ini upgrade head
```

Nową rewizję należy przejrzeć przed uruchomieniem. Cofnięcie pierwszej migracji
usuwa dane tabel i typy ENUM. Na testowej bazie sprawdzamy cykl upgrade →
downgrade → upgrade oraz brak różnic między migracjami a metadanymi modeli.
SQL do review bez połączenia z bazą:
`uv run alembic -c ../db/alembic.ini upgrade head --sql`.

## Opcjonalny katalog demonstracyjny

Po migracjach i nadaniu uprawnień, z katalogu `backend`:

```bash
uv run python -m app.scripts.seed
```

Seed dodaje 4 kategorie i 12 produktów. Można uruchamiać go wielokrotnie:
unikalne slugi zapobiegają duplikatom, a istniejące ceny i stany magazynowe
pozostają bez zmian. Nie tworzy użytkowników, haseł, zamówień ani płatności.

## Testy

`uv run pytest` uruchamia testy API i generowania SQL bez działającej bazy.
Testy integracyjne PostgreSQL wymagają osobnej bazy o nazwie zakończonej `_test`.
Przykładowe przygotowanie lokalnego kontenera:

```bash
docker compose --env-file db/.env -f db/compose.yaml exec -T postgres createdb -U postgres shop_test
```

Następnie ustaw `TEST_DATABASE_URL` na adres tej bazy z kontem mogącym tworzyć
schematy. W lokalnym kontenerze można użyć konta bootstrapowego `postgres`:

```bash
cd backend
export TEST_DATABASE_URL=postgresql+asyncpg://postgres:local-bootstrap-password@localhost:5432/shop_test
uv run pytest
```

W PowerShell zamiast `export` użyj `$env:TEST_DATABASE_URL = "..."`.
Testy tworzą losowy, izolowany schemat w bazie testowej i usuwają wyłącznie
ten schemat po zakończeniu. Sprawdzają migracje, relacje, ograniczenia, sesje,
serializację i powtarzalność seeda. Nie korzystają z `DATABASE_URL` jako
domyślnej bazy testowej.

## Docelowe RDS

RDS powinien używać tej samej głównej wersji PostgreSQL, prywatnych podsieci,
`publicly_accessible = false` i dostępu 5432 tylko z warstwy API. Migrator działa
jako oddzielne zadanie wewnątrz VPC, a runtime otrzymuje wyłącznie konto aplikacyjne.
Hasła pochodzą z AWS Secrets Manager/Parameter Store. `MIGRATION_DATABASE_URL`
jest potrzebna zadaniu migracyjnemu, a nie działającej aplikacji.

Ustawienie `DATABASE_SSL_CA` na ścieżkę do zaufanego bundle CA RDS włącza
weryfikację certyfikatu i nazwy hosta dla połączeń aplikacji i migracji. Adres
serwera w URL-u musi być nazwą endpointu RDS. Automatyczne backupy RDS mają mieć
retencję 7 dni; wdrożenie RDS i polityka backupów pozostają w zakresie infrastruktury.

Sposób weryfikacji połączeń TLS opisuje [dokumentacja RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html).
