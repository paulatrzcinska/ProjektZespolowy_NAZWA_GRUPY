"""Optional catalogue fixtures. Run with: uv run python -m app.scripts.seed."""

import asyncio
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, engine
from app.models import Category, Product

CATEGORIES = [
    ("Sofy i fotele", "sofy-i-fotele", "Meble wypoczynkowe do salonu."),
    ("Stoły i krzesła", "stoly-i-krzesla", "Jadalnia i kącik jadalny."),
    ("Sypialnia", "sypialnia", "Łóżka, szafy i dodatki do sypialni."),
    ("Przechowywanie", "przechowywanie", "Komody, regały, szafy."),
]

PRODUCTS = [
    ("Kanapa modułowa LUNA", "kanapa-modulowa-luna", "6499.00", 6, "sofy-i-fotele"),
    (
        "Fotel LOFT z podnóżkiem",
        "fotel-loft-z-podnozkiem",
        "2899.00",
        8,
        "sofy-i-fotele",
    ),
    (
        "Narożnik skórzany BERGEN",
        "naroznik-skorzany-bergen",
        "12499.00",
        3,
        "sofy-i-fotele",
    ),
    ("Stół dębowy NORD 180", "stol-debowy-nord-180", "3299.00", 4, "stoly-i-krzesla"),
    (
        "Krzesło tapicerowane VELA (2 szt.)",
        "krzeslo-tapicerowane-vela-para",
        "1198.00",
        15,
        "stoly-i-krzesla",
    ),
    (
        "Stolik kawowy MARMUR 80",
        "stolik-kawowy-marmur-80",
        "899.00",
        12,
        "stoly-i-krzesla",
    ),
    (
        "Łóżko kontynentalne AURORA 160",
        "lozko-kontynentalne-aurora-160",
        "4599.00",
        5,
        "sypialnia",
    ),
    ("Szafa przesuwna SKY 240", "szafa-przesuwna-sky-240", "3899.00", 2, "sypialnia"),
    ("Komoda RETRO 3S", "komoda-retro-3s", "1899.00", 7, "przechowywanie"),
    (
        "Regał metalowy INDUSTRIAL",
        "regal-metalowy-industrial",
        "749.00",
        10,
        "przechowywanie",
    ),
    ("Pufa welurowa DOT", "pufa-welurowa-dot", "449.00", 20, "sofy-i-fotele"),
    ("Ława dębowa MINI", "lawa-debowa-mini", "699.00", 9, "stoly-i-krzesla"),
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
    for name, slug, price, stock, category_slug in PRODUCTS:
        await session.execute(
            insert(Product)
            .values(
                name=name,
                slug=slug,
                price=Decimal(price),
                stock_quantity=stock,
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
