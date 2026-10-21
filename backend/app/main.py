from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health
from app.api.v1 import router as api_v1_router
from app.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        description=(
            "MVP API contract preview. Responses use example data; writes are not persisted. "
            "Use example-user-token or example-admin-token in Authorize to preview "
            "protected endpoints. Real authentication, database access and business rules "
            "will be implemented separately. Error responses describe the target contract."
        ),
        openapi_tags=[
            {"name": "health", "description": "Service health."},
            {"name": "auth", "description": "Registration, login and user profile."},
            {"name": "categories", "description": "Product categories."},
            {"name": "products", "description": "Product catalogue and search."},
            {"name": "cart", "description": "Current user's cart."},
            {"name": "orders", "description": "Checkout and order history."},
            {"name": "admin", "description": "Admin-only catalogue and order operations."},
        ],
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Total-Count"],
    )

    app.include_router(health.router)
    app.include_router(api_v1_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
