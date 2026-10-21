import asyncio

import pytest

pytestmark = pytest.mark.database


async def test_cart_changes_persist_and_totals_use_database_prices(
    client, customer, product
):
    assert (await client.get("/api/v1/cart", headers=customer["headers"])).json()[
        "items"
    ] == []
    response = await client.post(
        "/api/v1/cart/items",
        headers=customer["headers"],
        json={"product_id": product["id"], "quantity": 2, "price": "0.01"},
    )
    assert response.status_code == 201 and response.json()["subtotal"] == "399.98"
    item_id = response.json()["items"][0]["id"]
    changed = await client.patch(
        f"/api/v1/cart/items/{item_id}",
        headers=customer["headers"],
        json={"quantity": 3},
    )
    assert changed.status_code == 200 and changed.json()["items_count"] == 3
    persisted = await client.get("/api/v1/cart", headers=customer["headers"])
    assert persisted.json()["subtotal"] == "599.97"
    assert (
        await client.delete(
            f"/api/v1/cart/items/{item_id}", headers=customer["headers"]
        )
    ).json()["items"] == []
    assert (await client.get("/api/v1/cart", headers=customer["headers"])).json()[
        "items_count"
    ] == 0


async def test_cart_ownership_and_product_availability(
    client, customer, other_customer, admin, product
):
    added = await client.post(
        "/api/v1/cart/items",
        headers=customer["headers"],
        json={"product_id": product["id"], "quantity": 1},
    )
    item_id = added.json()["items"][0]["id"]
    assert (
        await client.patch(
            f"/api/v1/cart/items/{item_id}",
            headers=other_customer["headers"],
            json={"quantity": 2},
        )
    ).status_code == 404
    assert (
        await client.delete(
            f"/api/v1/cart/items/{item_id}", headers=other_customer["headers"]
        )
    ).status_code == 404
    assert (await client.get("/api/v1/cart", headers=other_customer["headers"])).json()[
        "items"
    ] == []
    await client.delete(f"/api/v1/products/{product['id']}", headers=admin["headers"])
    assert (
        await client.post(
            "/api/v1/cart/items",
            headers=customer["headers"],
            json={"product_id": product["id"], "quantity": 1},
        )
    ).status_code == 404
    assert (
        await client.patch(
            f"/api/v1/cart/items/{item_id}",
            headers=customer["headers"],
            json={"quantity": 2},
        )
    ).status_code == 400
    assert (
        await client.delete(
            f"/api/v1/cart/items/{item_id}", headers=customer["headers"]
        )
    ).status_code == 200


async def test_additive_quantity_limits_and_stock_revalidation(
    client, customer, product
):
    for quantity in (6, 5):
        response = await client.post(
            "/api/v1/cart/items",
            headers=customer["headers"],
            json={"product_id": product["id"], "quantity": quantity},
        )
        assert response.status_code == (201 if quantity == 6 else 400)
    cart = (await client.get("/api/v1/cart", headers=customer["headers"])).json()
    assert cart["items_count"] == 6
    response = await client.patch(
        f"/api/v1/cart/items/{cart['items'][0]['id']}",
        headers=customer["headers"],
        json={"quantity": 11},
    )
    assert response.status_code == 400


@pytest.mark.parametrize("quantity", [0, -1, 1000])
async def test_cart_rejects_invalid_quantities(client, customer, product, quantity):
    response = await client.post(
        "/api/v1/cart/items",
        headers=customer["headers"],
        json={"product_id": product["id"], "quantity": quantity},
    )
    assert response.status_code == 422


async def test_concurrent_additions_share_one_cart_and_keep_both_updates(
    client, customer, product
):
    results = await asyncio.gather(
        *(
            client.post(
                "/api/v1/cart/items",
                headers=customer["headers"],
                json={"product_id": product["id"], "quantity": 1},
            )
            for _ in range(2)
        )
    )
    assert [result.status_code for result in results] == [201, 201]
    response = await client.get("/api/v1/cart", headers=customer["headers"])
    assert len(response.json()["items"]) == 1 and response.json()["items_count"] == 2
