# Z Dech Pies

Wieloplatformowa aplikacja e-commerce umożliwiająca przeglądanie produktów, zarządzanie koszykiem, składanie zamówień oraz realizację płatności internetowych.

System składa się z aplikacji webowej PWA (React), aplikacji mobilnej (React Native) oraz wspólnego backendu opartego na FastAPI i PostgreSQL. Projekt obejmuje również uwierzytelnianie użytkowników oraz panel administracyjny do zarządzania ofertą sklepu.

## Funkcjonalności

**Dla klienta**
- przeglądanie katalogu produktów i kategorii
- zarządzanie koszykiem
- składanie zamówień i płatności internetowe
- rejestracja, logowanie i konto użytkownika

**Dla administratora**
- zarządzanie produktami i kategoriami
- podgląd i obsługa zamówień

## Technologie

| Obszar | Technologie |
| --- | --- |
| Frontend (web) | React, TypeScript, PWA |
| Frontend (mobile) | React Native |
| Backend | Python, FastAPI |
| Baza danych | PostgreSQL |
| Chmura | AWS |

## Architektura

System oparty jest na architekturze trójwarstwowej uruchomionej w chmurze AWS.

1. **Warstwa Web** – aplikacja PWA (React + TypeScript) hostowana jako pliki statyczne w Amazon S3 z dystrybucją przez CloudFront; aplikacja mobilna (React Native) instalowana na urządzeniach użytkowników.
2. **Warstwa API** – backend w Pythonie (FastAPI) uruchomiony w kontenerze na AWS. Jedyny punkt dostępu do danych dla aplikacji klienckich i panelu administratora. Odpowiada za logikę biznesową, uwierzytelnianie (JWT) oraz integrację z bramką płatności.
3. **Warstwa Database** – baza PostgreSQL w usłudze Amazon RDS, umieszczona w prywatnej sieci (VPC) i dostępna wyłącznie z warstwy API.

Komunikacja między warstwami odbywa się przez REST API po HTTPS, a dane uwierzytelniające przechowywane są w AWS Secrets Manager.

## Struktura repozytorium

Planowana struktura (może się zmienić w trakcie prac):

```
.
├── web/        # aplikacja PWA (React + TypeScript)
├── mobile/     # aplikacja mobilna (React Native)
├── backend/    # API (FastAPI)
├── db/         # migracje, skrypty i dane testowe bazy
├── infra/      # konfiguracja infrastruktury AWS
└── docs/       # dokumentacja projektu
```

## Uruchomienie lokalne

> Sekcja w przygotowaniu – zostanie uzupełniona po skonfigurowaniu środowiska Docker (zadanie DEVOPS-2).

Planowane wymagania: Docker, Node.js, Python.

## Zespół

| Rola | Osoba |
| --- | --- |
| DevOps / Project Manager | Paula Trzcińska |
| Frontend | Patryk Stulczewski |
| Backend | Dawid Makielak |
| Administrator bazy danych | Krzysztof Trzęsicki |

## Organizacja pracy

- zadania prowadzimy w GitHub Projects (tablica Kanban),
- każda zmiana trafia do gałęzi `main` przez Pull Request z przeglądem kodu.
