"""Create the first administrator without embedding credentials in the repository."""

import argparse
import asyncio
import getpass

from app.database import AsyncSessionLocal, engine
from app.services.accounts import ensure_admin


async def create(email: str) -> None:
    password = getpass.getpass("Admin password (8–128 characters): ")
    if password != getpass.getpass("Repeat password: "):
        raise ValueError("Passwords do not match")
    try:
        async with AsyncSessionLocal() as db:
            created = await ensure_admin(db, email, password)
        print(
            "Administrator created."
            if created
            else "Administrator already exists; credentials unchanged."
        )
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email")
    args = parser.parse_args()
    asyncio.run(create(args.email))


if __name__ == "__main__":
    main()
