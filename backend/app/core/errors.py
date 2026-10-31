import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("app.errors")


class InternalErrorMiddleware:
    """Turns unhandled exceptions into a JSON 500 and logs the traceback.

    Added before CORSMiddleware, so it runs inside it and the 500 keeps CORS
    headers (FastAPI's Exception handler runs outside all middleware).
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = False

        async def tracked(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, tracked)
        except Exception:
            logger.exception("Unhandled error: %s %s", scope.get("method"), scope.get("path"))
            if started:
                raise
            response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
            await response(scope, receive, send)


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Same HTTPValidationError body as FastAPI's default, only the status is 400.
    return JSONResponse(status_code=400, content={"detail": jsonable_encoder(exc.errors())})


def _validation_errors_as_400(schema: dict) -> None:
    for methods in schema.get("paths", {}).values():
        for operation in methods.values():
            responses = operation.get("responses", {})
            validation = responses.pop("422", None)
            if validation is None:
                continue
            existing = responses.get("400")
            if existing is None:
                responses["400"] = {**validation, "description": "Bad Request"}
                continue
            # Endpoint already documents a domain 400 (ErrorResponse): accept both bodies.
            content = existing.setdefault("content", {}).setdefault("application/json", {})
            content["schema"] = {
                "anyOf": [
                    content.get("schema", {}),
                    validation["content"]["application/json"]["schema"],
                ]
            }


def use_400_for_validation_errors(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    generate_openapi = app.openapi

    def openapi() -> dict:
        if app.openapi_schema is None:
            _validation_errors_as_400(generate_openapi())
        return app.openapi_schema

    app.openapi = openapi
