# Checklista środowiska chmurowego — E1–E5

Stan: kod i projekt do review, **bez wdrożenia w AWS**. Poniższe elementy można
potwierdzić w kodzie i testach; odbiór działającego środowiska wymaga dodatkowo
planu i wyników z właściwego konta.

| Wymaganie | Przygotowany element | Potwierdzenie po wdrożeniu |
| --- | --- | --- |
| E1 — konto i IAM | [Procedura konta, role i zakresy](team-access.md) | Konto projektu, tożsamości, MFA i przypięte polityki; decyzja o Organizations |
| E2 — dedykowana sieć | `aws_vpc.main`, domyślnie `10.0.0.0/16`, DNS | VPC ID, CIDR i tagi projektu |
| E3 — podział 3-tier | Po dwie podsieci Public Web, Private App, Private Database | Lista sześciu subnetów, AZ oraz ich powiązań z tablicami tras |
| E4 — routing | IGW tylko dla tras Public Web; App opcjonalnie przez NAT; Database bez default route | Tablice tras i brak publicznych IP API/DB |
| E4 — zapory | Internet:443 → SG Web; SG Web:8000 → SG App; SG App:5432 → SG Database | SG i faktyczne przypięcie do ALB, ECS i RDS; próby dostępu |
| E5 — Terraform | `infra/terraform`, plik lock providera, przykładowe parametry i testy | Zatwierdzony plan, rezultat wdrożenia i zdalny stan zespołu |

## Do sprawdzenia przed akceptacją kodu

- [ ] Potwierdzony typ konta, region i dostępne kredyty/budżet.
- [ ] Rozstrzygnięte wymaganie Organizations względem Free plan / laboratorium.
- [ ] Zaakceptowany plan CIDR i model Public Web → Private App → Private Database.
- [ ] Wybrany wariant dostępu wychodzącego i oszacowany jego koszt.
- [ ] Przyjęty zakres IAM każdej roli oraz sposób przechowywania stanu Terraform.

## Do sprawdzenia przy uruchamianiu aplikacji

- [ ] ALB ma listener HTTPS z poprawnym certyfikatem i health check `/health`.
- [ ] ECS używa prywatnych subnetów i `assign_public_ip = false`.
- [ ] RDS używa subnetów Database i `publicly_accessible = false`.
- [ ] API:8000 i PostgreSQL:5432 nie przyjmują bezpośrednich połączeń z internetu.
- [ ] API łączy się z bazą przez TLS, używając ograniczonego konta aplikacyjnego.
- [ ] Sekrety są poza repozytorium; aplikacja nie korzysta z hasła administratora DB.
- [ ] Backupy RDS mają retencję 7 dni; logi trafiają do CloudWatch.
- [ ] PWA działa przez CloudFront, bucket jest prywatny, a CORS wskazuje domenę PWA.
- [ ] Alarm budżetowy i plan wyłączania/usuwania zasobów są uzgodnione.

Mockowane testy Terraform sprawdzają deklaracje konfiguracji. Nie zastępują
rzeczywistych prób połączeń, kontroli przypięcia SG ani weryfikacji rachunku AWS.
