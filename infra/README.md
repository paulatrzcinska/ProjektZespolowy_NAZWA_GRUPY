# Infrastruktura AWS

Proponowany wariant: **S3 + CloudFront → publiczny ALB → prywatne ECS Fargate
(FastAPI) → prywatny RDS PostgreSQL**. Sieć jest podzielona na Public Web,
Private App i Private Database w dwóch Availability Zones.

Aktualny zakres Terraform to **fundament sieci i reguły dostępu**, przygotowany
do review wymagań E1–E5. Nie tworzy jeszcze ALB, ECS, RDS, bucketów aplikacji,
organizacji AWS ani kont użytkowników. Konfiguracja nie została wdrożona do AWS.

- [Architektura, CIDR i koszty](docs/aws-architecture.md)
- [Konto i dostęp zespołu](docs/team-access.md)
- [Mapowanie checklisty E1–E5](docs/cloud-checklist.md)
- [Terraform](terraform/)

## Wariant dla konta bezpłatnego lub edukacyjnego

Domyślnie `enable_nat_gateway = false`: kod nie tworzy NAT Gateway ani Elastic IP.
Podsieci App mają wtedy wyłącznie trasy lokalne VPC oraz endpoint Gateway do S3.
Nie jest to jeszcze uruchomione środowisko aplikacji: pobieranie obrazów z ECR,
CloudWatch, sekrety i połączenia z bramką płatności wymagają dodatkowego dostępu
wychodzącego. Po wyborze runtime trzeba uzgodnić NAT lub zestaw VPC endpoints.

Free Tier nie oznacza, że cały docelowy zestaw ALB + Fargate + RDS + NAT jest
bezpłatny. Rozliczenie zależy od planu konta, kredytów, regionu i czasu działania.
Przy obecnym Free plan dołączenie do AWS Organizations przełącza konto na Paid
plan; dlatego sposób spełnienia E1 trzeba uzgodnić z prowadzącym, zanim powstanie
organizacja. Źródła i warianty opisano w dokumentach poniżej.

## Sprawdzenie lokalne bez konta AWS

Wymagany Terraform 1.10+ i dostęp do internetu do pobrania providera przy `init`.

```bash
cd infra/terraform
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
terraform test
```

Testy używają mock providera AWS i sprawdzają plany: podział podsieci, brak
publicznych IP, izolację bazy, reguły SG oraz włączanie opcjonalnego NAT.
Nie łączą się z kontem AWS i nie tworzą zasobów.

## Przygotowanie planu na docelowym koncie

Po wyborze typu konta, regionu i akceptacji konfiguracji:

1. Zaloguj się własną rolą/profilami AWS CLI lub sesją laboratorium.
2. Sprawdź konto poleceniem `aws sts get-caller-identity`.
3. Skopiuj `terraform.tfvars.example` do `terraform.tfvars` i ustaw parametry.
4. Przygotuj plan do wspólnego review:

```bash
terraform init
terraform plan -out=network.tfplan
terraform show network.tfplan
```

`terraform apply network.tfplan` jest osobnym krokiem po zaakceptowaniu planu.
Wygenerowanie i testy plików nie są dowodem skonfigurowania środowiska chmurowego.

## Stan Terraform

Na etapie lokalnego review stan pozostaje lokalny i jest ignorowany przez Git.
Przed wspólnym wdrażaniem skonfiguruj prywatny, szyfrowany i wersjonowany bucket
S3 na stan, z blokadą `use_lockfile`. Przykład parametrów:
`terraform/backend.s3.hcl.example`. Bucket stanu i uprawnienia do niego wymagają
osobnego bootstrapu; nie są tworzone przez tę konfigurację.

Pliki stanu, plany, lokalne parametry i poświadczenia nie trafiają do repozytorium.
