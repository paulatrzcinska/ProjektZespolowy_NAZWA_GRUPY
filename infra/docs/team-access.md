# Konto AWS i dostęp zespołowy — E1

Status: procedura do zastosowania po wskazaniu konta. Terraform sieci nie tworzy
organizacji, użytkowników, haseł, kluczy ani przydziałów IAM.

## Wybór typu konta

| Wariant | Sposób dostępu | Uzgodnienie przed wdrożeniem |
| --- | --- | --- |
| Istniejąca organizacja uczelni | Indywidualne role/SSO nadane przez administratora | Konto projektu, dozwolone usługi i region |
| AWS Academy / Learner Lab | Sesje i role udostępnione przez laboratorium | Ograniczenia IAM, usługi, region, kredyty i trwałość zasobów |
| Samodzielny AWS Free plan | Indywidualne tożsamości w jednym koncie projektowym | Czy prowadzący akceptuje konto zespołowe bez AWS Organizations |
| AWS Organizations + IAM Identity Center | Indywidualne konta SSO i permission sets | Zgoda na właściwy plan rozliczeniowy i konto projektu |

„Konto zespołowe” nie jest automatycznie tym samym co AWS Organizations.
Według dokumentacji AWS dołączenie Free plan do Organizations przełącza konto
na Paid plan. Nie należy oznaczać wymagania organizacji jako spełnionego przez
samą nazwę konta albo wspólne hasło. Przy obowiązku Organizations potrzebna jest
decyzja prowadzącego/administratora dotycząca konta i budżetu.

## Dostęp indywidualny i minimum uprawnień

W organizacji proponujemy IAM Identity Center z grupami ról zespołowych.
W koncie bez organizacji administrator przygotowuje równoważne, indywidualne
tożsamości i role IAM z MFA. Konto root pozostaje do spraw konta i rozliczeń;
zespół nie współdzieli root ani jednego zestawu kluczy. W Learner Lab stosujemy
role udostępnione przez uczelnię i zapisujemy ograniczenia względem checklisty.

| Rola | Dostęp roboczy | Zakres zasobów |
| --- | --- | --- |
| DevOps / PM | Planowanie i wdrażanie infrastruktury; konfiguracja obserwowalności | Zasoby projektu i wybrany region; IAM/PassRole ograniczone do zatwierdzonych ról |
| Backend | Publikacja obrazów ECR, wdrożenia konkretnej usługi ECS, odczyt logów | Repozytorium ECR, usługa/task family ECS i log group projektu |
| Frontend | Publikacja plików PWA i invalidacja cache | Konkretny bucket PWA i dystrybucja CloudFront |
| Database | Odczyt konfiguracji RDS i kontrolowane uruchamianie migracji w VPC | Konkretna baza i osobna rola/zadanie migracyjne; brak publicznego portu DB |

Uprawnienia do listowania części usług wymagają `Resource: "*"`; operacje zapisu
powinny wskazywać konkretne ARN-y, a tam, gdzie to obsługiwane, także tag Project
i region. Role robocze nie otrzymują domyślnie `AdministratorAccess`. Szczegółowe
polityki zapisujemy po ustaleniu identyfikatorów konta i zasobów — sama tabela
nie nadaje żadnych uprawnień.

Role runtime są oddzielone od ludzi: ECS execution role pobiera obrazy i wysyła
logi; task role dostaje wyłącznie potrzebne uprawnienia aplikacji do konkretnych
sekretów/bucketów. Hasła RDS, JWT i bramki nie trafiają do repozytorium ani
zmiennych zwykłego task environment; są pobierane z usługi przechowywania sekretów.

## Dowody do odbioru E1

- Wskazane konto projektu, właściciel i rodzaj planu, bez publikowania sekretów.
- Lista indywidualnych tożsamości/ról oraz faktycznie przypiętych polityk.
- Potwierdzenie MFA i przeglądu uprawnień każdej roli.
- Potwierdzenie ograniczeń Learner Lab lub decyzji o Organizations.

## Źródła

- [AWS — wybór planu i wpływ Organizations](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html)
- [IAM Identity Center — rozpoczęcie konfiguracji](https://docs.aws.amazon.com/singlesignon/latest/userguide/getting-started.html)
