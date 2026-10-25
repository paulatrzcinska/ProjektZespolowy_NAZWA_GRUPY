import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.models.order import Order
from app.models.product import Product

from .conftest import SHIPPING, checkout

pytestmark = pytest.mark.database


async def test_checkout_persists_snapshots_deducts_stock_and_clears_cart(
    client, customer, admin, product
):
    response = await checkout(client, customer, product["id"])
    assert response.status_code == 201
    order = response.json()
    assert (
        order["total_amount"] == "399.98"
        and order["items"][0]["unit_price"] == "199.99"
    )
    assert (await client.get("/api/v1/cart", headers=customer["headers"])).json()[
        "items"
    ] == []
    assert (await client.get(f"/api/v1/products/{product['id']}")).json()[
        "stock_quantity"
    ] == 8
    await client.patch(
        f"/api/v1/products/{product['id']}",
        headers=admin["headers"],
        json={"name": "New catalogue name", "price": "999.99"},
    )
    saved = (
        await client.get(f"/api/v1/orders/{order['id']}", headers=customer["headers"])
    ).json()
    assert (
        saved["items"][0]["product_name_snapshot"] == "Oak chair"
        and saved["total_amount"] == "399.98"
    )
    assert [
        item["id"]
        for item in (
            await client.get("/api/v1/orders", headers=customer["headers"])
        ).json()
    ] == [order["id"]]


async def test_checkout_uses_latest_price_and_rejects_client_amount_fields(
    client, customer, admin, product
):
    await client.post(
        "/api/v1/cart/items",
        headers=customer["headers"],
        json={"product_id": product["id"], "quantity": 2},
    )
    await client.patch(
        f"/api/v1/products/{product['id']}",
        headers=admin["headers"],
        json={"price": "249.99"},
    )
    invalid = await client.post(
        "/api/v1/orders",
        headers=customer["headers"],
        json={**SHIPPING, "total_amount": "0.01"},
    )
    assert invalid.status_code == 400
    order = await client.post(
        "/api/v1/orders", headers=customer["headers"], json=SHIPPING
    )
    assert order.status_code == 201 and order.json()["total_amount"] == "499.98"


async def test_ownership_and_empty_cart_errors(
    client, customer, other_customer, product
):
    assert (
        await client.post("/api/v1/orders", headers=customer["headers"], json=SHIPPING)
    ).status_code == 400
    order = (await checkout(client, customer, product["id"])).json()
    assert (
        await client.get(
            f"/api/v1/orders/{order['id']}", headers=other_customer["headers"]
        )
    ).status_code == 404
    assert (
        await client.get("/api/v1/orders", headers=other_customer["headers"])
    ).json() == []


async def test_unavailable_checkout_rolls_back_and_preserves_cart(
    client, customer, admin, product
):
    await client.post(
        "/api/v1/cart/items",
        headers=customer["headers"],
        json={"product_id": product["id"], "quantity": 2},
    )
    await client.patch(
        f"/api/v1/products/{product['id']}",
        headers=admin["headers"],
        json={"stock_quantity": 1},
    )
    response = await client.post(
        "/api/v1/orders", headers=customer["headers"], json=SHIPPING
    )
    assert response.status_code == 400
    assert (await client.get("/api/v1/cart", headers=customer["headers"])).json()[
        "items_count"
    ] == 2
    assert (
        await client.get("/api/v1/orders", headers=customer["headers"])
    ).json() == []
    assert (await client.get(f"/api/v1/products/{product['id']}")).json()[
        "stock_quantity"
    ] == 1


async def test_idempotent_retry_checks_owner_and_shipping_payload(
    client, customer, other_customer, product
):
    key = str(uuid4())
    first = await checkout(client, customer, product["id"], key=key)
    headers = {**customer["headers"], "Idempotency-Key": key}
    retried = await client.post("/api/v1/orders", headers=headers, json=SHIPPING)
    assert (
        first.status_code == retried.status_code == 201
        and first.json()["id"] == retried.json()["id"]
    )
    changed = await client.post(
        "/api/v1/orders", headers=headers, json={**SHIPPING, "shipping_city": "Krakow"}
    )
    assert changed.status_code == 409
    assert (
        await client.post(
            "/api/v1/orders",
            headers={**other_customer["headers"], "Idempotency-Key": key},
            json=SHIPPING,
        )
    ).status_code == 409
    assert (
        await client.post(
            "/api/v1/orders",
            headers={**customer["headers"], "Idempotency-Key": "invalid"},
            json=SHIPPING,
        )
    ).status_code == 400


async def test_concurrent_idempotent_checkout_creates_one_order(
    client, customer, product, db
):
    await client.post(
        "/api/v1/cart/items",
        headers=customer["headers"],
        json={"product_id": product["id"], "quantity": 2},
    )
    headers = {**customer["headers"], "Idempotency-Key": str(uuid4())}
    results = await asyncio.gather(
        *(
            client.post("/api/v1/orders", headers=headers, json=SHIPPING)
            for _ in range(2)
        )
    )
    assert [result.status_code for result in results] == [201, 201]
    assert results[0].json()["id"] == results[1].json()["id"]
    assert await db.scalar(select(func.count()).select_from(Order)) == 1
    assert (await client.get(f"/api/v1/products/{product['id']}")).json()[
        "stock_quantity"
    ] == 8


async def test_concurrent_customers_cannot_oversell_last_unit(
    client, customer, other_customer, admin, product, db
):
    await client.patch(
        f"/api/v1/products/{product['id']}",
        headers=admin["headers"],
        json={"stock_quantity": 1},
    )
    for account in (customer, other_customer):
        assert (
            await client.post(
                "/api/v1/cart/items",
                headers=account["headers"],
                json={"product_id": product["id"], "quantity": 1},
            )
        ).status_code == 201
    responses = await asyncio.gather(
        *(
            client.post("/api/v1/orders", headers=account["headers"], json=SHIPPING)
            for account in (customer, other_customer)
        )
    )
    assert sorted(result.status_code for result in responses) == [201, 400]
    assert await db.scalar(select(func.count()).select_from(Order)) == 1
    assert (
        await db.scalar(
            select(Product.stock_quantity).where(Product.id == product["id"])
        )
        == 0
    )


async def test_admin_transitions_filters_and_single_stock_restoration(
    client, customer, admin, product
):
    order_id = (await checkout(client, customer, product["id"])).json()["id"]
    path = f"/api/v1/orders/{order_id}/status"
    assert (
        await client.patch(path, headers=admin["headers"], json={"status": "shipped"})
    ).status_code == 400
    assert (
        await client.patch(path, headers=admin["headers"], json={"status": "paid"})
    ).status_code == 200
    filtered = await client.get(
        "/api/v1/orders/admin/all",
        headers=admin["headers"],
        params={"status": "paid", "user_id": customer["user"]["id"], "limit": 1},
    )
    assert [item["id"] for item in filtered.json()] == [order_id]
    assert (
        await client.get(
            "/api/v1/orders/admin/all?status=pending", headers=admin["headers"]
        )
    ).json() == []
    for _ in range(2):
        assert (
            await client.patch(
                path, headers=admin["headers"], json={"status": "cancelled"}
            )
        ).status_code == 200
    assert (await client.get(f"/api/v1/products/{product['id']}")).json()[
        "stock_quantity"
    ] == 10
    assert (
        await client.patch(path, headers=admin["headers"], json={"status": "paid"})
    ).status_code == 400
    assert (
        await client.delete(
            f"/api/v1/products/{product['id']}?hard=true", headers=admin["headers"]
        )
    ).status_code == 409
