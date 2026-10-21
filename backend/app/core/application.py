from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI

from app.core.limiter import AuthLimiter
from app.core.settings import get_runtime_settings


class SecurityHeadersMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        async def secured(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend(
                    [
                        (b"x-content-type-options", b"nosniff"),
                        (b"x-frame-options", b"DENY"),
                        (b"referrer-policy", b"strict-origin-when-cross-origin"),
                        (
                            b"permissions-policy",
                            b"camera=(), microphone=(), geolocation=()",
                        ),
                    ]
                )
                private = any(
                    name.lower() == b"authorization"
                    for name, _ in scope.get("headers", [])
                ) or "/auth/" in scope.get("path", "")
                if private:
                    headers = [
                        (name, value)
                        for name, value in headers
                        if name.lower() != b"cache-control"
                    ]
                    headers.append((b"cache-control", b"no-store"))
                if scope.get("scheme") == "https":
                    headers.append((b"strict-transport-security", b"max-age=31536000"))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, secured)


def configure_runtime(app: FastAPI) -> None:
    settings = get_runtime_settings()
    app.state.auth_limiter = AuthLimiter()
    app.add_middleware(SecurityHeadersMiddleware)
    if settings.api_mode == "live":
        app.description = "Persistent e-commerce REST API. Authenticate with a JWT access token. Payment simulation is available only when explicitly enabled locally."
    original = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(application):
        async with original(application) as state:
            if settings.api_mode == "live" and settings.create_default_admin:
                from app.database import AsyncSessionLocal
                from app.services.accounts import ensure_admin

                async with AsyncSessionLocal() as session:
                    await ensure_admin(
                        session,
                        settings.default_admin_email,
                        settings.default_admin_password.get_secret_value(),
                    )
            yield state

    app.router.lifespan_context = lifespan


def api_router() -> APIRouter:
    if get_runtime_settings().api_mode == "contract":
        from app.api.preview import auth, cart, categories, orders, products

        preview = APIRouter()
        for module in (auth, categories, products, cart, orders):
            preview.include_router(module.router)
        return preview
    from app.api.v1 import router

    return router
