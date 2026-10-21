import pytest

pytestmark = pytest.mark.database


async def test_categories_crud_persists_and_reports_conflicts(client, admin, product):
    category_id = product["category_id"]
    response = await client.patch(
        f"/api/v1/categories/{category_id}",
        headers=admin["headers"],
        json={"name": "New name", "description": "Description"},
    )
    assert response.status_code == 200
    assert (await client.get(f"/api/v1/categories/{category_id}")).json()[
        "name"
    ] == "New name"
    duplicate = await client.post(
        "/api/v1/categories",
        headers=admin["headers"],
        json={"name": "Other", "slug": "chairs"},
    )
    assert duplicate.status_code == 409
    assert (
        await client.delete(
            f"/api/v1/categories/{category_id}", headers=admin["headers"]
        )
    ).status_code == 409
    empty = await client.post(
        "/api/v1/categories",
        headers=admin["headers"],
        json={"name": "Empty", "slug": "empty"},
    )
    empty_id = empty.json()["id"]
    deleted = await client.delete(
        f"/api/v1/categories/{empty_id}", headers=admin["headers"]
    )
    assert deleted.status_code == 204 and deleted.content == b""
    assert (await client.get(f"/api/v1/categories/{empty_id}")).status_code == 404


async def test_catalog_filters_sorts_and_counts_before_pagination(
    client, admin, product
):
    for index, (name, price) in enumerate(
        [("Birch chair", "49.00"), ("Pine table", "349.00"), ("A 100% chair", "99.00")]
    ):
        response = await client.post(
            "/api/v1/products",
            headers=admin["headers"],
            json={
                "name": name,
                "slug": f"item-{index}",
                "price": price,
                "stock_quantity": 2,
                "category_id": product["category_id"],
            },
        )
        assert response.status_code == 201
    page = await client.get(
        "/api/v1/products",
        params={
            "q": "chair",
            "sort": "price_asc",
            "min_price": "50",
            "max_price": "250",
            "category_id": product["category_id"],
            "skip": 1,
            "limit": 1,
        },
    )
    assert page.status_code == 200 and page.headers["X-Total-Count"] == "2"
    assert page.json()[0]["name"] == "Oak chair"
    assert page.json()[0]["price"] == "199.99"
    literal = await client.get("/api/v1/products", params={"q": "%"})
    assert [item["name"] for item in literal.json()] == ["A 100% chair"]
    assert (
        await client.get(
            "/api/v1/products", params={"min_price": "250", "max_price": "50"}
        )
    ).status_code == 422


async def test_product_patch_null_rules_soft_delete_and_admin_visibility(
    client, admin, customer, product
):
    url = f"/api/v1/products/{product['id']}"
    changed = await client.patch(
        url,
        headers=admin["headers"],
        json={
            "price": "299.99",
            "description": "Text",
            "image_url": "https://example.com/chair.jpg",
        },
    )
    assert changed.status_code == 200
    assert (await client.get(url)).json()["price"] == "299.99"
    patched = await client.patch(
        url,
        headers=admin["headers"],
        json={"price": None, "description": None, "image_url": None},
    )
    assert (
        patched.json()["price"] == "299.99"
        and patched.json()["description"] is None
        and patched.json()["image_url"] is None
    )
    assert (await client.delete(url, headers=admin["headers"])).status_code == 204
    assert (await client.get(url)).status_code == 404
    assert (await client.get(url, headers=customer["headers"])).status_code == 404
    assert (await client.get(url, headers=admin["headers"])).json()[
        "is_active"
    ] is False
    public = await client.get("/api/v1/products")
    assert public.json() == [] and public.headers["X-Total-Count"] == "0"
    assert (
        await client.get(
            "/api/v1/products?include_inactive=true", headers=customer["headers"]
        )
    ).status_code == 403
    private = await client.get(
        "/api/v1/products?include_inactive=true", headers=admin["headers"]
    )
    assert len(private.json()) == 1 and private.headers["Cache-Control"] == "no-store"


async def test_product_duplicate_slug_missing_category_and_hard_delete(
    client, admin, customer, product
):
    duplicate = await client.post(
        "/api/v1/products",
        headers=admin["headers"],
        json={
            "name": "Duplicate",
            "slug": product["slug"],
            "price": "9.99",
            "stock_quantity": 1,
            "category_id": product["category_id"],
        },
    )
    assert duplicate.status_code == 409
    missing = await client.patch(
        f"/api/v1/products/{product['id']}",
        headers=admin["headers"],
        json={"category_id": 999999},
    )
    assert missing.status_code == 404
    added = await client.post(
        "/api/v1/cart/items",
        headers=customer["headers"],
        json={"product_id": product["id"], "quantity": 1},
    )
    assert added.status_code == 201
    assert (
        await client.delete(
            f"/api/v1/products/{product['id']}?hard=true", headers=admin["headers"]
        )
    ).status_code == 409
    await client.delete(
        f"/api/v1/cart/items/{added.json()['items'][0]['id']}",
        headers=customer["headers"],
    )
    assert (
        await client.delete(
            f"/api/v1/products/{product['id']}?hard=true", headers=admin["headers"]
        )
    ).status_code == 204
    assert (await client.get(f"/api/v1/products/{product['id']}")).status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {"price": "0"},
        {"price": "1.001"},
        {"stock_quantity": -1},
        {"stock_quantity": 2147483648},
        {"image_url": "javascript:alert(1)"},
        {"image_url": "https://example.com/" + "a" * 2050},
    ],
)
async def test_invalid_catalog_updates_are_rejected(client, admin, product, payload):
    response = await client.patch(
        f"/api/v1/products/{product['id']}", headers=admin["headers"], json=payload
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("post", "/categories", {"name": "Test", "slug": "test"}),
        ("delete", "/categories/1", None),
        ("patch", "/products/1", {"price": "9.99"}),
        ("get", "/orders/admin/all", None),
    ],
)
async def test_admin_operations_reject_customers(client, customer, method, path, body):
    response = await client.request(
        method, "/api/v1" + path, headers=customer["headers"], json=body
    )
    assert response.status_code == 403
