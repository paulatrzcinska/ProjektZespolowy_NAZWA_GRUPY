import asyncio

import pytest
from sqlalchemy import func, select

from app.core.settings import get_runtime_settings
from app.models.payment import Payment

from .conftest import checkout

pytestmark = pytest.mark.database


async def test_payment_amount_is_server_owned_and_success_is_persistent(
    client, customer, product
):
    order_id = (await checkout(client, customer, product["id"])).json()["id"]
    response = await client.post(
        "/api/v1/payments/mock/sessions",
        headers=customer["headers"],
        json={"order_id": order_id, "amount": "0.01"},
    )
    assert response.status_code == 201
    payment = response.json()
    assert (
        payment["provider"] == "mock"
        and payment["amount"] == "399.98"
        and payment["status"] == "awaiting_payment"
    )
    assert (
        await client.get(f"/api/v1/orders/{order_id}", headers=customer["headers"])
    ).json()["status"] == "pending"
    completed = await client.post(
        f"/api/v1/payments/mock/{payment['payment_id']}/complete",
        headers=customer["headers"],
        json={"outcome": "paid"},
    )
    assert completed.status_code == 200 and completed.json()["status"] == "paid"
    assert (
        await client.get(f"/api/v1/orders/{order_id}", headers=customer["headers"])
    ).json()["status"] == "paid"
    assert (
        await client.get(
            f"/api/v1/payments/{payment['payment_id']}/status",
            headers=customer["headers"],
        )
    ).json()["status"] == "paid"
    repeat = await client.post(
        f"/api/v1/payments/mock/{payment['payment_id']}/complete",
        headers=customer["headers"],
        json={"outcome": "paid"},
    )
    assert repeat.status_code == 200
    assert (await client.get(f"/api/v1/products/{product['id']}")).json()[
        "stock_quantity"
    ] == 8


async def test_failed_payment_can_be_retried_without_changing_order_amount(
    client, customer, product
):
    order_id = (await checkout(client, customer, product["id"])).json()["id"]
    first = (
        await client.post(
            "/api/v1/payments/mock/sessions",
            headers=customer["headers"],
            json={"order_id": order_id},
        )
    ).json()
    result = await client.post(
        f"/api/v1/payments/mock/{first['payment_id']}/complete",
        headers=customer["headers"],
        json={"outcome": "failed"},
    )
    assert result.status_code == 200 and result.json()["status"] == "failed"
    assert (
        await client.get(f"/api/v1/orders/{order_id}", headers=customer["headers"])
    ).json()["status"] == "pending"
    retried = (
        await client.post(
            "/api/v1/payments/mock/sessions",
            headers=customer["headers"],
            json={"order_id": order_id},
        )
    ).json()
    assert (
        retried["payment_id"] != first["payment_id"] and retried["amount"] == "399.98"
    )
    assert (
        await client.post(
            f"/api/v1/payments/mock/{first['payment_id']}/complete",
            headers=customer["headers"],
            json={"outcome": "paid"},
        )
    ).status_code == 409


async def test_payment_ownership_disabled_mode_and_cancelled_order(
    client, customer, other_customer, admin, product, monkeypatch
):
    order_id = (await checkout(client, customer, product["id"])).json()["id"]
    assert (
        await client.post(
            "/api/v1/payments/mock/sessions",
            headers=other_customer["headers"],
            json={"order_id": order_id},
        )
    ).status_code == 404
    payment = (
        await client.post(
            "/api/v1/payments/mock/sessions",
            headers=customer["headers"],
            json={"order_id": order_id},
        )
    ).json()
    assert (
        await client.get(
            f"/api/v1/payments/{payment['payment_id']}/status",
            headers=other_customer["headers"],
        )
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v1/payments/mock/{payment['payment_id']}/complete",
            headers=other_customer["headers"],
            json={"outcome": "paid"},
        )
    ).status_code == 404
    await client.patch(
        f"/api/v1/orders/{order_id}/status",
        headers=admin["headers"],
        json={"status": "cancelled"},
    )
    assert (
        await client.post(
            f"/api/v1/payments/mock/{payment['payment_id']}/complete",
            headers=customer["headers"],
            json={"outcome": "paid"},
        )
    ).status_code == 409
    assert (
        await client.post(
            "/api/v1/payments/mock/sessions",
            headers=customer["headers"],
            json={"order_id": order_id},
        )
    ).status_code == 409
    monkeypatch.setenv("PAYMENTS_MOCK", "false")
    get_runtime_settings.cache_clear()
    assert (
        await client.post(
            "/api/v1/payments/mock/sessions",
            headers=customer["headers"],
            json={"order_id": order_id},
        )
    ).status_code == 404


async def test_concurrent_payment_session_and_completion_are_idempotent(
    client, customer, product, db
):
    order_id = (await checkout(client, customer, product["id"])).json()["id"]
    sessions = await asyncio.gather(
        *(
            client.post(
                "/api/v1/payments/mock/sessions",
                headers=customer["headers"],
                json={"order_id": order_id},
            )
            for _ in range(2)
        )
    )
    assert [response.status_code for response in sessions] == [201, 201]
    assert sessions[0].json()["payment_id"] == sessions[1].json()["payment_id"]
    payment_id = sessions[0].json()["payment_id"]
    responses = await asyncio.gather(
        *(
            client.post(
                f"/api/v1/payments/mock/{payment_id}/complete",
                headers=customer["headers"],
                json={"outcome": "paid"},
            )
            for _ in range(2)
        )
    )
    assert [response.status_code for response in responses] == [200, 200]
    assert await db.scalar(select(func.count()).select_from(Payment)) == 1
