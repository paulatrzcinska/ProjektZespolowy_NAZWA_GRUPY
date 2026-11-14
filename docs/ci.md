# Integracja ciągła i skanowanie bezpieczeństwa

Każdy push i każdy pull request do `main` uruchamia workflow
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Zasada: błąd ma być
wykryty zanim kod trafi do `main` i do chmury, bez ręcznego sprawdzania.

## Przebieg

```mermaid
flowchart LR
    P[push / pull request] --> S[Secret scan<br/>Gitleaks]
    S --> V[Vulnerability scan<br/>Trivy]
    V --> F[Frontend<br/>typecheck, build, Playwright, Docker]
    V --> B[Backend<br/>uv sync, compileall, pytest + PostgreSQL]
    V --> I[Infrastructure<br/>terraform fmt, validate]
    F --> G[CI status]
    B --> G
    I --> G
```

| Job | Co sprawdza | Kiedy kończy się błędem |
| --- | --- | --- |
| `Secret scan (Gitleaks)` | historia commitów pod kątem kluczy, haseł i tokenów | dowolny wykryty sekret |
| `Vulnerability scan (Trivy)` | `backend/uv.lock`, `web/package-lock.json`, sekrety w drzewie, konfiguracja Dockerfile i Terraform | podatność CRITICAL/HIGH z dostępną poprawką lub sekret; błędy konfiguracji są tylko raportowane |
| `Frontend build and tests (web)` | `npm ci`, `npm run typecheck`, `npm run build`, 20 testów Playwright na kontraktowym API, budowa obrazu Nginx | błąd kompilacji TypeScript, budowania Vite, testu lub obrazu |
| `Backend build and tests (backend)` | `uv sync --locked`, kompilacja modułów, `pytest` na PostgreSQL 16 (kontener usługi, baza `shop_test`) | niezgodny lock, błąd składni, nieudany test |
| `Infrastructure validation (terraform)` | `terraform fmt -check`, `init -backend=false`, `validate` | niesformatowany lub niepoprawny kod HCL |
| `CI status` | agreguje wyniki powyższych | którykolwiek job nie zakończył się sukcesem |

Kolejność jest celowa: `Vulnerability scan` zależy od `Secret scan`, a joby
budujące od obu skanerów (`needs`). Wyciek sekretu lub podatność CRITICAL/HIGH
zatrzymuje pipeline, zanim cokolwiek zostanie zbudowane. `CI status` jest jedynym wymaganym sprawdzeniem w ochronie gałęzi
`main`, dzięki czemu zmiana listy jobów nie wymaga zmiany ustawień repozytorium.

Osobny workflow [`codeql.yml`](../.github/workflows/codeql.yml) analizuje
statycznie kod TypeScript i Python (CodeQL, zestaw `security-and-quality`)
przy zmianach w `main` oraz co tydzień. Raporty Trivy i CodeQL trafiają do
zakładki **Security → Code scanning**.

[`.github/dependabot.yml`](../.github/dependabot.yml) co tydzień proponuje
aktualizacje zależności npm (`web/`), uv (`backend/`), obrazów bazowych
Dockerfile, providerów Terraform i akcji GitHub. Alerty bezpieczeństwa
Dependabot działają niezależnie od harmonogramu.

## Ochrona gałęzi `main`

W ustawieniach repozytorium (**Settings → Branches** lub **Rules → Rulesets**)
dla `main` obowiązują:

- wymagany pull request przed scaleniem, co najmniej jedna akceptacja,
- wymagane sprawdzenie statusu `CI status` z aktualną gałęzią,
- zakaz wypychania bezpośrednio do `main` i wymuszonych pushy,
- brak możliwości obejścia reguł przez administratorów.

Dodatkowo w **Settings → Code security** włączone są Dependabot alerts,
Dependabot security updates, Secret scanning i Push protection, które blokują
push zawierający rozpoznany sekret jeszcze przed uruchomieniem workflow.

## Uruchomienie skanerów lokalnie

Te same narzędzia można uruchomić przed pushem (Docker):

```bash
docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:latest git /repo --redact -v
docker run --rm -v "$PWD:/repo:ro" aquasec/trivy:0.76.2 fs /repo --scanners vuln,secret --severity CRITICAL,HIGH --ignore-unfixed
docker run --rm -v "$PWD:/repo:ro" aquasec/trivy:0.76.2 fs /repo --scanners misconfig --severity CRITICAL,HIGH
```

W PowerShell zamiast `$PWD` użyj `${PWD}`; przy błędzie `dubious ownership`
dodaj `-e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0='*'`.

Gitleaks dopasowuje wzorce (np. `AKIA…`, `ghp_…`), więc wykrywa także fikcyjne
klucze testowe. Trivy weryfikuje sumy kontrolne tokenów i zgłasza wyłącznie
wartości o poprawnej strukturze. Podatności w zależnościach usuwa się
aktualizacją locka, np. `uv lock --upgrade-package <pakiet>` w `backend/`
albo `npm update <pakiet>` w `web/`, a nie wyłączaniem skanera.

## Znane ostrzeżenia konfiguracji

Trivy zgłasza (bez blokowania) m.in. nieograniczony ruch wychodzący grup
bezpieczeństwa (AWS-0104), publiczne IP w podsieci `public-web` (AWS-0164),
retencję kopii RDS 1 dzień (AWS-0077) oraz brak `USER` w obrazie Nginx
(DS-0002). Pierwsze trzy wynikają z założeń architektury i limitów konta AWS
opisanych w [`infra/README.md`](../infra/README.md); ich ewentualne zaostrzenie
to decyzja zespołu, nie wymóg pipeline'u.
