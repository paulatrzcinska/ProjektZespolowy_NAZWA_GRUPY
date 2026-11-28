"""Optional catalogue fixtures. Run with: uv run python -m app.scripts.seed.

The catalogue matches the frontend mock data (web/src/mocks/data), so the demo
looks the same in mock mode, locally and in AWS.
"""

import asyncio
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, engine
from app.models import Category, Product

CATEGORIES = [
    (
        "Legowiska",
        "legowiska",
        "Miękkie legowiska i maty dla psów każdej wielkości.",
    ),
    (
        "Smycze i obroże",
        "smycze-i-obroze",
        "Akcesoria spacerowe: smycze, obroże i szelki.",
    ),
    ("Zabawki", "zabawki", "Gryzaki, piłki i zabawki interaktywne."),
    (
        "Miski i karmienie",
        "miski-i-karmienie",
        "Miski, poidła i maty pod miski.",
    ),
]

_IMG = "https://images.unsplash.com/photo-{}?auto=format&fit=crop&w=800&q=70"

# (name, slug, description, price, stock, category slug, Unsplash photo id)
PRODUCTS = [
    (
        "Legowisko Cloud M",
        "legowisko-cloud-m",
        "Ortopedyczne legowisko z pianki memory, zdejmowany pokrowiec do prania "
        "w 40°C. Rozmiar M (80×60 cm).",
        "189.00",
        12,
        "legowiska",
        "1601758123927-4f7acc7da589",
    ),
    (
        "Legowisko Cloud L",
        "legowisko-cloud-l",
        "Wersja L (100×75 cm) legowiska Cloud dla dużych ras.",
        "249.00",
        3,
        "legowiska",
        "1581888227599-779811939961",
    ),
    (
        "Mata chłodząca",
        "mata-chlodzaca",
        "Żelowa mata chłodząca na upalne dni, bez prądu i wody.",
        "79.90",
        0,
        "legowiska",
        "1762547450600-5a57ea7abc54",
    ),
    (
        "Smycz taśmowa 2 m",
        "smycz-tasmowa-2m",
        "Wytrzymała smycz z taśmy poliestrowej z karabińczykiem obrotowym.",
        "39.00",
        40,
        "smycze-i-obroze",
        "1708062270853-ee7c66b69f07",
    ),
    (
        "Szelki Guard S",
        "szelki-guard-s",
        "Szelki typu guard z odblaskami, regulowane w 4 punktach.",
        "89.00",
        15,
        "smycze-i-obroze",
        "1581597359121-0f69057e2fb1",
    ),
    (
        "Obroża skórzana brąz",
        "obroza-skorzana-braz",
        "Obroża z naturalnej skóry z mosiężną klamrą.",
        "69.00",
        8,
        "smycze-i-obroze",
        "1546687813-3fcc1c363a07",
    ),
    (
        "Piłka Kong Classic",
        "pilka-kong-classic",
        "Gumowa piłka do aportu i wypełniania smakołykami.",
        "45.00",
        25,
        "zabawki",
        "1508948956644-0017e845d797",
    ),
    (
        "Gryzak sznurowy",
        "gryzak-sznurowy",
        "Bawełniany gryzak do przeciągania, wspomaga czyszczenie zębów.",
        "24.90",
        2,
        "zabawki",
        "1774440865489-c7827c96aabc",
    ),
    (
        "Mata węchowa",
        "mata-wechowa",
        "Zabawka interaktywna rozwijająca węch, do prania w pralce.",
        "59.00",
        10,
        "zabawki",
        "1714068691252-685e1426c055",
    ),
    (
        "Miska stalowa 1,5 l",
        "miska-stalowa-1-5l",
        "Miska ze stali nierdzewnej z antypoślizgowym spodem.",
        "29.00",
        30,
        "miski-i-karmienie",
        "1695023267262-7f4ab64152b2",
    ),
    (
        "Miska spowalniająca",
        "miska-spowalniajaca",
        "Miska z labiryntem spowalniająca jedzenie łapczywych psów.",
        "34.90",
        18,
        "miski-i-karmienie",
        "1714068691210-073dc52c6c1d",
    ),
    (
        "Poidło podróżne 500 ml",
        "poidlo-podrozne-500ml",
        "Składane poidło z butelką na spacery i wycieczki.",
        "32.00",
        22,
        "miski-i-karmienie",
        "1541887796712-054f4b0f8e5d",
    ),
    (
        "Miska ceramiczna w łapki",
        "miska-ceramiczna-w-lapki",
        "Ceramiczna miska z wzorem w łapki, ciężka i stabilna, do zmywarki.",
        "22.00",
        50,
        "miski-i-karmienie",
        "1679224106783-c21b1841412a",
    ),
]


async def seed_catalogue(session: AsyncSession) -> None:
    for name, slug, description in CATEGORIES:
        await session.execute(
            insert(Category)
            .values(name=name, slug=slug, description=description)
            .on_conflict_do_nothing(index_elements=[Category.slug])
        )
    category_ids = dict(
        (await session.execute(select(Category.slug, Category.id))).all()
    )
    for name, slug, description, price, stock, category_slug, photo in PRODUCTS:
        await session.execute(
            insert(Product)
            .values(
                name=name,
                slug=slug,
                description=description,
                price=Decimal(price),
                stock_quantity=stock,
                image_url=_IMG.format(photo),
                category_id=category_ids[category_slug],
                is_active=True,
            )
            .on_conflict_do_nothing(index_elements=[Product.slug])
        )


async def main() -> None:
    try:
        async with AsyncSessionLocal.begin() as session:
            await seed_catalogue(session)
        print("Sample catalogue ready: existing products were preserved.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
