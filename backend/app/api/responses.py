from http import HTTPStatus
from typing import Any

from app.schemas.error import ErrorResponse


def error_responses(*codes: int) -> dict[int, dict[str, Any]]:
    return {
        code: {"model": ErrorResponse, "description": HTTPStatus(code).phrase}
        for code in codes
    }
