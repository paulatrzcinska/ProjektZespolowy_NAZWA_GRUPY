from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["UP", "DOWN"] = "UP"
    database: Literal["UP", "DOWN", "SKIPPED"] = "SKIPPED"
    version: str = "dev"
