# Infrastruktura

Konfiguracja infrastruktury AWS projektu.

## Struktura

```
infra/
└── terraform/           # kod IaC (Terraform)
    ├── main.tf          # dostawca AWS, zdalny stan, VPC, podsieci, routing, Security Groups, RDS
    ├── web.tf           # warstwa web: bucket S3, CloudFront (OAC, funkcja SPA, origin VPC do API)
    ├── app.tf           # warstwa app: ECR, ECS Fargate, wewnętrzny NLB, rola wykonawcza, sekret, logi
    ├── endpoints.tf     # punkty końcowe VPC dla podsieci prywatnej (ECR, Logs, Secrets Manager, S3)
    ├── deploy.tf        # użytkownik IAM GitHub Actions o minimalnych uprawnieniach (OIDC zablokowane przez SCP)
    ├── functions/       # kod CloudFront Function (przepisywanie tras SPA)
    ├── variables.tf     # parametry: region, zakresy IP, porty, rozmiar zadania
    ├── outputs.tf       # ID sieci oraz wartości dla GitHub Actions (rola, bucket, dystrybucja, ECS)
    └── .gitignore
```

## Sieć (architektura 3-tier)

Region: `eu-north-1` (Sztokholm), VPC: `10.0.0.0/16`

| Podsieć | CIDR | Typ | Przeznaczenie |
|---|---|---|---|
| `public-web` | 10.0.1.0/24 | publiczna (trasa do Internet Gateway) | punkt wejścia z Internetu |
| `private-app` | 10.0.2.0/24 | prywatna | backend FastAPI |
| `private-db` | 10.0.3.0/24 | prywatna | baza PostgreSQL (RDS) |
| `private-db-2` | 10.0.4.0/24 (`eu-north-1b`) | prywatna | druga podsieć bazy – wymóg DB subnet group RDS |

Podsieci prywatne nie mają trasy do Internetu (tylko ruch wewnątrz VPC) i są
jawnie przypisane do tablicy `rt-private`. Wszystkie podsieci poza `private-db-2`
leżą w `eu-north-1a`.

## Security Groups

Ruch przechodzi kaskadowo przez kolejne warstwy: **Internet → web → app → db**.

| Grupa | Ruch przychodzący | Źródło |
|---|---|---|
| `web-sg` | HTTP 80, HTTPS 443 | Internet (`0.0.0.0/0`) |
| `app-sg` | TCP 8000 (FastAPI) | tylko `web-sg` |
| `db-sg` | TCP 5432 (PostgreSQL) | tylko `app-sg` |

Ruch wychodzący: `web-sg` i `app-sg` – dowolny; `db-sg` – wyłącznie TCP 5432 do
`app-sg`, więc baza nie może sama nawiązać połączenia z niczym innym.

Port SSH (22) nie jest otwarty w żadnej grupie.

## Baza danych (RDS PostgreSQL)

Baza `pz-db` została utworzona w konsoli AWS (Blok 5, E4); kod w `main.tf`
odwzorowuje jej konfigurację.

| Ustawienie | Wartość |
|---|---|
| Silnik | PostgreSQL 16 (ta sama wersja główna co lokalny `db/compose.yaml`) |
| Instancja | `db.t4g.micro`, Single-AZ `eu-north-1a`, 20 GiB gp3, bez autoskalowania dysku |
| DB subnet group | `pz-db-subnet-group`: `private-db` + `private-db-2` |
| Dostęp publiczny | **wyłączony** – brak publicznego IP, endpoint rozwiązuje się tylko w VPC |
| Security Group | `db-sg` – port 5432 tylko z `app-sg` |
| Baza / administrator | `shop` / `pgadmin` |
| Hasło administratora | generowane i przechowywane w AWS Secrets Manager (`rds!db-…`) |
| Szyfrowanie | włączone (KMS `aws/rds`), certyfikat TLS `rds-ca-rsa2048-g1` |
| Backupy | automatyczne, retencja **1 dzień** – maksimum dla konta na Free planie |
| Ochrona | deletion protection włączone |

Endpoint: `pz-db.cl2kmam8azud.eu-north-1.rds.amazonaws.com:5432` (nie jest
sekretem; z Internetu i z laptopa jest nieosiągalny). Konto `pgadmin` służy tylko
do administracji. Backend łączy się ograniczonym kontem `shop_app`, z hasłem
wstrzykiwanym z Secrets Manager. Role tworzy bootstrap bazy, a migracje Alembic
tworzą schemat; skrypt `db/scripts/grant-app-permissions.sql` nadaje uprawnienia aplikacji.

Koszt: ok. 15 USD miesięcznie (instancja 0,019 USD/h + dysk + sekret), pokrywany
z kredytów konta. Gdy baza nie jest potrzebna: Actions → **Stop temporarily**
(AWS uruchamia ją automatycznie po 7 dniach). Przed usunięciem bazy trzeba
najpierw wyłączyć deletion protection (Modify → Apply immediately).

## Warstwy web i app (wdrożenie CD)

| Zasób | Umiejscowienie | Rola |
|---|---|---|
| S3 `pz-web-<konto>` + CloudFront | poza VPC | build frontendu; dystrybucja kieruje `/api/*`, `/health`, `/docs`, `/openapi.json` do API |
| NLB `pz-api-nlb` (wewnętrzny) | `public-web`, `web-sg` | wejście do API dla CloudFront (origin VPC), bez publicznego IP |
| ECS Fargate `pz-api` | `private-app`, `app-sg` | kontener FastAPI, obraz z ECR `pz-api`, port 8000 tylko z `web-sg` |
| Punkty końcowe VPC | `private-app`, `vpce-sg` | ECR, CloudWatch Logs, Secrets Manager (interfejsowe) i S3 (gateway) zamiast NAT |
| Secrets Manager `pz/api` | – | `DB_PASSWORD`, `MIGRATION_DB_PASSWORD`, `JWT_SECRET`; wartości wpisywane ręcznie |
| Użytkownik IAM `pz-github-deploy` | – | bez konsoli; klucz w sekretach środowiska GitHub `production` (tylko `main`), uprawnienia tylko do wdrożenia |

Przebieg wdrożenia i wartości do ustawień GitHuba: [docs/deployment.md](../docs/deployment.md).

## Terraform

Stan przechowywany jest zdalnie w S3 (bucket `projekt-zespolowy-nazwa-grupy-tfstate`) z blokadą `use_lockfile`, co zapobiega konfliktom przy pracy zespołowej.

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

Wymagania: Terraform >= 1.10, AWS CLI skonfigurowane na koncie technicznym. Konto `terraform-network` ma uprawnienia tylko do VPC i pliku stanu w S3; zasoby wdrożenia (IAM, S3, CloudFront, ECR, ECS, ELB, Logs, Secrets Manager) wymagają szerszych uprawnień. Kluczy dostępowych nie umieszczamy w repozytorium.

> **Uwaga:** sieć (Blok 3) i baza RDS (Blok 5) zostały utworzone ręcznie w konsoli AWS. Kod odwzorowuje je 1:1. Przed pierwszym `terraform apply` należy zaimportować istniejące zasoby (`import`) albo usunąć ręczne zasoby, aby nie utworzyć duplikatu. Do zarządzania RDS konto `terraform-network` potrzebuje dodatkowych uprawnień (obecnie ma tylko AmazonVPCFullAccess).
>
> Import robi się blokami `import` generowanymi lokalnie, bez publikowania identyfikatorów zasobów w repozytorium:
>
> ```bash
> cd infra/terraform
> ./scripts/generate-imports.sh   # tylko odczyt AWS; tworzy imports.generated.tf (w .gitignore)
> terraform init
> terraform plan                  # import + zmiany; nie może być "destroy" ani "must be replaced"
> ```
>
> Skrypt wyszukuje VPC, podsieci, tablice tras, Security Groups z regułami oraz RDS po nazwach. Jeśli podsieć jest powiązana z inną tablicą tras niż w kodzie, skrypt ostrzega i nie importuje tego powiązania.
>
> Przy imporcie sprawdzić też tagi: w konsoli Security Groups nie mają tagu `Name` (kolumna Name jest pusta), a kod go ustawia – `terraform plan` pokaże to jako zmianę tagów, nie odtworzenie grupy.