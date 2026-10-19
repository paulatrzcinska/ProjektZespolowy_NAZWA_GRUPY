# Backend (FastAPI)

## Wymagania

- Python 3.12+
- [uv](https://docs.astral.sh/uv/getting-started/installation/)

## Uruchomienie lokalne

Z katalogu głównego repozytorium:

```bash
cd backend
uv sync --locked
cp .env.example .env
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

W PowerShell zamiast `cp .env.example .env` można użyć `Copy-Item .env.example .env`.
Plik `.env` jest opcjonalny — aplikacja ma domyślne ustawienia lokalne.

- Health: http://localhost:8000/health — HTTP 200, `{"status":"ok"}`
- Swagger UI: http://localhost:8000/docs
- OpenAPI: http://localhost:8000/openapi.json

## Konfiguracja

Ustawienia wczytuje `pydantic-settings` z pliku `backend/.env` i ze zmiennych
środowiskowych. Zmienne środowiskowe mają pierwszeństwo. Polecenia uruchamiaj
z katalogu `backend`, aby aplikacja odczytała właściwy plik `.env`.
Po zmianie ustawień uruchom serwer ponownie.

| Zmienna | Domyślna wartość | Opis |
| --- | --- | --- |
| `APP_NAME` | `projekt-zespolowy-api` | Nazwa API w dokumentacji |
| `DEBUG` | `false` | Tryb debugowania FastAPI; przeładowanie kodu włącza flaga `--reload` |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:8081` | Dozwolone originy oddzielone przecinkami |

CORS obsługuje dane uwierzytelniające, wszystkie metody i nagłówki dla wskazanych
originów. Każdy origin powinien zawierać protokół, host i ewentualny port,
np. `http://localhost:5173`.

## Struktura

```text
app/
├── api/          # routery HTTP
│   └── health.py
├── models/       # modele danych
├── schemas/      # schematy Pydantic
├── services/     # logika biznesowa
├── config.py     # ustawienia aplikacji
└── main.py       # fabryka aplikacji i konfiguracja CORS
tests/
```

## Zależności i testy

Zależności są zadeklarowane w `pyproject.toml`. Plik `uv.lock` utrwala konkretne
wersje dla powtarzalnej instalacji. `uv sync --locked` instaluje również grupę
`dev` z narzędziami testowymi.

```bash
uv run pytest
```

Testy sprawdzają `/health`, Swagger UI, OpenAPI, CORS oraz konfigurację z pliku
`.env` i zmiennych środowiskowych.
