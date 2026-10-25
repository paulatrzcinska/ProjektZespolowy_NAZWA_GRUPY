from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


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
