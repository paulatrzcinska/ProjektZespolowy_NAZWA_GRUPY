# Infrastruktura

Konfiguracja infrastruktury AWS projektu.

## Struktura

```
infra/
└── terraform/        # kod IaC sieci (Terraform)
    ├── main.tf       # dostawca AWS, zdalny stan, VPC, podsieci, routing, Security Groups
    ├── variables.tf  # parametry: region, zakresy IP, porty
    ├── outputs.tf    # ID VPC, podsieci, IGW i Security Groups
    └── .gitignore
```

## Sieć (architektura 3-tier)

Region: `eu-north-1` (Sztokholm), VPC: `10.0.0.0/16`

| Podsieć | CIDR | Typ | Przeznaczenie |
|---|---|---|---|
| `public-web` | 10.0.1.0/24 | publiczna (trasa do Internet Gateway) | punkt wejścia z Internetu |
| `private-app` | 10.0.2.0/24 | prywatna | backend FastAPI |
| `private-db` | 10.0.3.0/24 | prywatna | baza PostgreSQL (RDS) |

Podsieci prywatne nie mają trasy do Internetu (tylko ruch wewnątrz VPC).

## Security Groups

Ruch przechodzi kaskadowo przez kolejne warstwy: **Internet → web → app → db**.

| Grupa | Ruch przychodzący | Źródło |
|---|---|---|
| `web-sg` | HTTP 80, HTTPS 443 | Internet (`0.0.0.0/0`) |
| `app-sg` | TCP 8000 (FastAPI) | tylko `web-sg` |
| `db-sg` | TCP 5432 (PostgreSQL) | tylko `app-sg` |

Port SSH (22) nie jest otwarty w żadnej grupie.

## Terraform

Stan przechowywany jest zdalnie w S3 (bucket `projekt-zespolowy-nazwa-grupy-tfstate`) z blokadą `use_lockfile`, co zapobiega konfliktom przy pracy zespołowej.

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

Wymagania: Terraform >= 1.10, AWS CLI skonfigurowane na koncie technicznym `terraform-network` (uprawnienia ograniczone do VPC i pliku stanu w S3). Kluczy dostępowych nie umieszczamy w repozytorium.

> **Uwaga:** sieć została utworzona ręcznie w konsoli AWS (Blok 3, E2–E4). Kod odwzorowuje ją 1:1. Przed pierwszym `terraform apply` należy zaimportować istniejące zasoby (`import`) albo usunąć ręczną VPC, aby nie utworzyć duplikatu.