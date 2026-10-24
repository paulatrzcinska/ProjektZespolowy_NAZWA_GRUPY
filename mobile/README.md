# Mobile

Aplikacja mobilna sklepu „Z Dech Pies” (React Native) — drugi klient tego samego
REST API co aplikacja webowa w [`web/`](../web/README.md).

**Status:** zaplanowana. Na tym etapie projektu priorytetem jest
aplikacja webowa PWA; katalog zawiera wyłącznie założenia, aby decyzje
architektoniczne podjęte w `web/` i `backend/` były z nimi zgodne.

## Założenia

| Obszar | Decyzja |
| --- | --- |
| Framework | React Native z Expo (TypeScript) — ten sam język i model komponentów co `web/` |
| Nawigacja | React Navigation (stos: katalog → produkt → koszyk → checkout → status zamówienia) |
| Dane | TanStack Query, jak w `web/`; cache zapytań utrwalany lokalnie dla trybu offline katalogu |
| API | Wyłącznie REST z `docs/api-contract.md`; żadnej logiki biznesowej po stronie aplikacji |
| Autoryzacja | JWT Bearer jak w `web/`, ale token w bezpiecznym magazynie urządzenia (`expo-secure-store`), nie w pamięci przeglądarki |
| Konfiguracja | Adres API w zmiennej `EXPO_PUBLIC_API_BASE_URL` (`.env.example`), bez adresów w kodzie |
| Platformy | Android i iOS z jednego kodu; build przez EAS |

## Co jest wspólne z `web/`

- Kontrakt API i typy danych (`web/src/api/types.ts` — produkty, kategorie, koszyk, zamówienia) do wydzielenia do wspólnego pakietu, gdy powstanie drugi klient.
- Reguły: kwoty jako stringi dziesiętne, paginacja po `X-Total-Count`, nagłówek `Idempotency-Key` przy składaniu zamówienia, `401` kończy sesję.

## Planowane ekrany (MVP mobilne)

1. Katalog z kategoriami i wyszukiwaniem
2. Szczegóły produktu i dodanie do koszyka
3. Koszyk i checkout (adres wysyłki)
4. Status i historia zamówień
5. Logowanie / rejestracja / profil

Panel administratora pozostaje wyłącznie w aplikacji webowej.

## Uruchomienie

Po rozpoczęciu prac: `npm ci && npx expo start` (Expo Go na telefonie lub
emulator). Do tego czasu katalog nie zawiera kodu.
