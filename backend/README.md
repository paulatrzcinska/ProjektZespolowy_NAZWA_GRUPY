# Backend FastAPI

Działające REST API MVP: konta i JWT, katalog produktów/kategorii, koszyk,
zamówienia i administracja. Lokalna symulacja płatności jest opcjonalna.

## Uruchomienie

Najpierw zastosuj osobny patch bazy i przygotuj PostgreSQL. Kompletna instrukcja,
konfiguracja JWT, tworzenie administratora i opis symulacji:
[backend-runtime.md](../docs/backend-runtime.md).

Z katalogu `backend`, po przygotowaniu ustawień i danych:

```bash
uv sync --locked
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- `/health` — stan procesu.
- `/docs` — Swagger UI.
- `/openapi.json` — specyfikacja OpenAPI.
- `/api/v1` — wersjonowane API.

`API_MODE=live` jest domyślny. Wymaga PostgreSQL i losowego `JWT_SECRET`
ustawionego w `.env.runtime` lub środowisku. Jawny `API_MODE=contract` zachowuje
przykładowe odpowiedzi dla testów interfejsu i jest dozwolony tylko lokalnie
oraz w testach. Błąd połączenia nigdy nie włącza przykładów automatycznie.

## Weryfikacja

```bash
uv run pytest
```

Testy kontraktu nie wymagają połączenia z bazą. Testy integracyjne wymagają
`TEST_DATABASE_URL` wskazującego osobną bazę PostgreSQL o nazwie zakończonej
`_test`; każdy przypadek pracuje we własnym schemacie. Bez tej zmiennej testy
wymagające PostgreSQL są pomijane.

Kontrakt i reguły operacji: [api-contract.md](../docs/api-contract.md).
Status akceptacji przez frontend pozostaje do potwierdzenia przez zespół.
