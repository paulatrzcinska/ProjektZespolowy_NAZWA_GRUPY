import asyncio

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text

from app.config import Settings, get_settings
from app.core.settings import RuntimeSettings, get_runtime_settings
from app.database import engine
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


async def probe_database() -> None:
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


@router.get("/health", response_model=HealthResponse, responses={500: {"model": HealthResponse}})
async def health(
    response: Response,
    settings: Settings = Depends(get_settings),
    runtime: RuntimeSettings = Depends(get_runtime_settings),
) -> HealthResponse:
    response.headers["Cache-Control"] = "no-store"
    if runtime.api_mode == "contract":
        return HealthResponse(version=settings.app_version)
    try:
        # Bound pool checkout, connection, query and cleanup; Docker's probe has 2s.
        async with asyncio.timeout(1):
            await probe_database()
    except Exception:
        # Do not expose connection strings, credentials or driver exceptions.
        response.status_code = 500
        return HealthResponse(status="DOWN", database="DOWN", version=settings.app_version)
    return HealthResponse(database="UP", version=settings.app_version)
