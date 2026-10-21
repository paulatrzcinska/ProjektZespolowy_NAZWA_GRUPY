from datetime import UTC, datetime, timedelta

import jwt
import pytest
from sqlalchemy import select

from app.core.security import create_token, verify_password
from app.core.settings import RuntimeSettings, get_runtime_settings
from app.models.user import User

from .conftest import PASSWORD

pytestmark = pytest.mark.database


async def test_registration_hashes_password_normalizes_email_and_never_grants_admin(
    client, db
):
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "Mixed@EXAMPLE.COM", "password": PASSWORD, "is_admin": True},
    )
    assert response.status_code == 201
    assert response.json()["email"] == "mixed@example.com"
    assert response.json()["is_admin"] is False
    assert (
        "hashed_password" not in response.json() and "password" not in response.json()
    )
    user = await db.scalar(select(User).where(User.email == "mixed@example.com"))
    assert user.hashed_password != PASSWORD and verify_password(
        PASSWORD, user.hashed_password
    )
    duplicate = await client.post(
        "/api/v1/auth/register",
        json={"email": "MIXED@example.com", "password": PASSWORD},
    )
    assert duplicate.status_code == 409


@pytest.mark.parametrize(
    "email,password",
    [("missing@example.com", PASSWORD), ("customer@example.com", "wrong-password")],
)
async def test_wrong_credentials_are_rejected(client, customer, email, password):
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


async def test_inactive_accounts_cannot_login_or_use_tokens(client, customer, db):
    user = await db.get(User, customer["user"]["id"])
    user.is_active = False
    await db.commit()
    assert (
        await client.post(
            "/api/v1/auth/login", json={"email": user.email, "password": PASSWORD}
        )
    ).status_code == 403
    assert (
        await client.get("/api/v1/auth/me", headers=customer["headers"])
    ).status_code == 401


@pytest.mark.parametrize(
    "kind",
    [
        "missing",
        "example",
        "tampered",
        "expired",
        "refresh",
        "no-claims",
        "wrong-audience",
    ],
)
async def test_invalid_bearer_tokens_are_rejected(client, customer, db, kind):
    settings = get_runtime_settings()
    user = await db.get(User, customer["user"]["id"])
    token = customer["tokens"]["access_token"]
    if kind == "missing":
        headers = {}
    else:
        if kind == "example":
            token = "example-user-token"
        if kind == "tampered":
            token = token[:-4] + "xxxx"
        if kind == "expired":
            token = create_token(
                user, settings, "access", now=datetime.now(UTC) - timedelta(days=2)
            )
        if kind == "refresh":
            token = customer["tokens"]["refresh_token"]
        if kind == "no-claims":
            token = jwt.encode(
                {"sub": str(user.id)},
                settings.jwt_secret.get_secret_value(),
                algorithm="HS256",
            )
        if kind == "wrong-audience":
            token = create_token(
                user,
                settings.model_copy(update={"jwt_audience": "another-app"}),
                "access",
            )
        headers = {"Authorization": "Bearer " + token}
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401


async def test_profile_updates_are_persistent_and_cannot_change_role(client, customer):
    changed = await client.patch(
        "/api/v1/auth/me",
        headers=customer["headers"],
        json={"full_name": "  Jan  ", "shipping_city": "Warszawa", "is_admin": True},
    )
    assert changed.status_code == 200
    response = await client.get("/api/v1/auth/me", headers=customer["headers"])
    assert response.json()["full_name"] == "Jan"
    assert response.json()["shipping_city"] == "Warszawa"
    assert response.json()["is_admin"] is False
    await client.patch(
        "/api/v1/auth/me", headers=customer["headers"], json={"shipping_city": None}
    )
    assert (await client.get("/api/v1/auth/me", headers=customer["headers"])).json()[
        "shipping_city"
    ] is None
    assert response.headers["Cache-Control"] == "no-store"


async def test_refresh_and_password_change_revoke_existing_access_and_refresh_tokens(
    client, customer
):
    refreshed = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": customer["tokens"]["refresh_token"]},
    )
    assert refreshed.status_code == 200
    assert (
        await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": customer["tokens"]["access_token"]},
        )
    ).status_code == 401
    wrong = await client.post(
        "/api/v1/auth/change-password",
        headers=customer["headers"],
        json={"current_password": "wrong", "new_password": "NewPassword123!"},
    )
    assert wrong.status_code == 401
    changed = await client.post(
        "/api/v1/auth/change-password",
        headers=customer["headers"],
        json={"current_password": PASSWORD, "new_password": "NewPassword123!"},
    )
    assert changed.status_code == 204 and changed.content == b""
    assert (
        await client.get("/api/v1/auth/me", headers=customer["headers"])
    ).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refreshed.json()["refresh_token"]},
        )
    ).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "customer@example.com", "password": PASSWORD},
        )
    ).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "customer@example.com", "password": "NewPassword123!"},
        )
    ).status_code == 200


async def test_auth_rate_limit_is_per_app_and_returns_retry_after(client, monkeypatch):
    monkeypatch.setenv("AUTH_RATE_LIMIT", "2")
    get_runtime_settings.cache_clear()
    for _ in range(2):
        assert (
            await client.post(
                "/api/v1/auth/login",
                json={"email": "none@example.com", "password": "wrong"},
            )
        ).status_code == 401
    limited = await client.post(
        "/api/v1/auth/login", json={"email": "none@example.com", "password": "wrong"}
    )
    assert limited.status_code == 429 and int(limited.headers["Retry-After"]) > 0


@pytest.mark.parametrize(
    "updates",
    [
        {"jwt_secret": None},
        {"jwt_secret": "short"},
        {"app_env": "production", "payments_mock": True},
        {"app_env": "production", "api_mode": "contract"},
        {"create_default_admin": True, "default_admin_email": None},
    ],
)
def test_runtime_settings_reject_invalid_security_configuration(updates):
    values = {
        "api_mode": "live",
        "app_env": "test",
        "payments_mock": False,
        "jwt_secret": "test-only-secret-" * 4,
    }
    values.update(updates)
    with pytest.raises(ValueError):
        RuntimeSettings(_env_file=None, **values)
