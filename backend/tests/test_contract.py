from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from app.schemas.cart import CartResponse
from app.schemas.category import CategoryRead
from app.schemas.order import OrderRead
from app.schemas.product import ProductListRead, ProductRead
from app.schemas.user import Token, UserRead

USER = {"Authorization": "Bearer example-user-token"}
ADMIN = {"Authorization": "Bearer example-admin-token"}
CATEGORY = {"name": "Stoły", "slug": "stoly", "description": "Stoły do jadalni"}
PRODUCT = {
    "name": "Stół dębowy", "slug": "stol-debowy", "price": "999.99",
    "stock_quantity": 5, "category_id": 1,
}
SHIPPING = {
    "shipping_full_name": "Anna Nowak", "shipping_address_line1": "ul. Krótka 2",
    "shipping_city": "Kraków", "shipping_postal_code": "30-001", "shipping_country": "Polska",
}

# These requests exercise every MVP operation as a frontend client would.
REQUESTS = [
    ("POST", "/auth/register", {"email": "anna@example.com", "password": "password123"}, {}, 201, UserRead),
    ("POST", "/auth/login", {"email": "user@example.com", "password": "password123"}, {}, 200, Token),
    ("GET", "/auth/me", None, USER, 200, UserRead),
    ("PATCH", "/auth/me", {"full_name": "Anna Nowak"}, USER, 200, UserRead),
    ("POST", "/auth/change-password", {"current_password": "password123", "new_password": "newpassword123"}, USER, 204, None),
    ("GET", "/categories", None, {}, 200, list[CategoryRead]),
    ("GET", "/categories/1", None, {}, 200, CategoryRead),
    ("POST", "/categories", CATEGORY, ADMIN, 201, CategoryRead),
    ("PATCH", "/categories/1", {"name": "Fotele"}, ADMIN, 200, CategoryRead),
    ("DELETE", "/categories/1", None, ADMIN, 204, None),
    ("GET", "/products", None, {}, 200, list[ProductListRead]),
    ("GET", "/products/1", None, {}, 200, ProductRead),
    ("POST", "/products", PRODUCT, ADMIN, 201, ProductRead),
    ("PATCH", "/products/1", {"price": "249.99"}, ADMIN, 200, ProductRead),
    ("DELETE", "/products/1", None, ADMIN, 204, None),
    ("GET", "/cart", None, USER, 200, CartResponse),
    ("POST", "/cart/items", {"product_id": 1, "quantity": 2}, USER, 201, CartResponse),
    ("PATCH", "/cart/items/1", {"quantity": 3}, USER, 200, CartResponse),
    ("DELETE", "/cart/items/1", None, USER, 200, CartResponse),
    ("POST", "/orders", SHIPPING, USER, 201, OrderRead),
    ("GET", "/orders", None, USER, 200, list[OrderRead]),
    ("GET", "/orders/1", None, USER, 200, OrderRead),
    ("GET", "/orders/admin/all", None, ADMIN, 200, list[OrderRead]),
    ("PATCH", "/orders/1/status", {"status": "shipped"}, ADMIN, 200, OrderRead),
]


@pytest.mark.parametrize("method,path,body,headers,code,model", REQUESTS)
def test_example_responses_match_contract(
    client: TestClient, method: str, path: str, body: Any,
    headers: dict[str, str], code: int, model: Any,
) -> None:
    response = client.request(method, f"/api/v1{path}", json=body, headers=headers)

    assert response.status_code == code, response.text
    if model is None:
        assert response.content == b""
    else:
        TypeAdapter(model).validate_json(response.content)
        assert "password" not in response.json()


@pytest.mark.parametrize(
    "method,path,body,headers,code,model", [case for case in REQUESTS if case[3]],
)
def test_protected_operations_require_bearer_token(
    client: TestClient, method: str, path: str, body: Any,
    headers: dict[str, str], code: int, model: Any,
) -> None:
    response = client.request(method, f"/api/v1{path}", json=body)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert isinstance(response.json()["detail"], str)


@pytest.mark.parametrize(
    "method,path,body,headers,code,model", [case for case in REQUESTS if case[3] == ADMIN],
)
def test_admin_operations_reject_user_token(
    client: TestClient, method: str, path: str, body: Any,
    headers: dict[str, str], code: int, model: Any,
) -> None:
    response = client.request(method, f"/api/v1{path}", json=body, headers=USER)

    assert response.status_code == 403
    assert response.json() == {"detail": "Admin only"}


@pytest.mark.parametrize(
    "method,path,body,field",
    [
        ("POST", "/auth/register", {"email": "invalid", "password": "password123"}, "email"),
        ("POST", "/auth/register", {"email": "user@example.com", "password": "short"}, "password"),
        ("POST", "/categories", {**CATEGORY, "slug": "Invalid Slug"}, "slug"),
        ("POST", "/products", {**PRODUCT, "price": "0"}, "price"),
        ("POST", "/products", {**PRODUCT, "price": "199.999"}, "price"),
        ("POST", "/products", {**PRODUCT, "stock_quantity": -1}, "stock_quantity"),
        ("POST", "/cart/items", {"product_id": 1, "quantity": 0}, "quantity"),
        ("PATCH", "/cart/items/1", {"quantity": 1000}, "quantity"),
        ("POST", "/orders", {}, "shipping_city"),
        ("PATCH", "/orders/1/status", {"status": "unknown"}, "status"),
        ("GET", "/products/0", None, "product_id"),
        ("GET", "/products?limit=101", None, "limit"),
        ("GET", "/products?skip=-1", None, "skip"),
        ("GET", "/products?sort=unknown", None, "sort"),
        ("GET", "/products?min_price=-1", None, "min_price"),
    ],
)
def test_invalid_requests_return_validation_errors(
    client: TestClient, method: str, path: str, body: Any, field: str,
) -> None:
    response = client.request(method, f"/api/v1{path}", json=body, headers=ADMIN)

    assert response.status_code == 422
    assert any(error["loc"][-1] == field for error in response.json()["detail"])


def test_product_pagination_headers_are_accessible_from_frontend(client: TestClient) -> None:
    response = client.get("/api/v1/products?skip=1&limit=1", headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 200
    assert response.json() == []
    assert response.headers["x-total-count"] == "1"
    assert "X-Total-Count" in response.headers["access-control-expose-headers"]


def test_inactive_products_require_admin(client: TestClient) -> None:
    assert client.get("/api/v1/products?include_inactive=true").status_code == 403
    assert client.get("/api/v1/products?include_inactive=true", headers=USER).status_code == 403
    assert client.get("/api/v1/products?include_inactive=true", headers=ADMIN).status_code == 200


def test_invalid_token_is_rejected(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid-token"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid token"}


def test_money_uses_decimal_strings_and_cart_counts_quantities(client: TestClient) -> None:
    product = client.get("/api/v1/products/1").json()
    cart = client.get("/api/v1/cart", headers=USER).json()
    order = client.get("/api/v1/orders/1", headers=USER).json()

    assert product["price"] == "199.99"
    assert cart["subtotal"] == order["total_amount"] == "399.98"
    assert cart["items_count"] == sum(item["quantity"] for item in cart["items"])
    assert order["created_at"].endswith("Z")


def test_order_idempotency_key_is_optional_uuid(client: TestClient) -> None:
    valid = client.post(
        "/api/v1/orders", json=SHIPPING,
        headers={**USER, "Idempotency-Key": "18dd31cc-5bf5-4bc1-85dc-1c1d614d100a"},
    )
    invalid = client.post(
        "/api/v1/orders", json=SHIPPING, headers={**USER, "Idempotency-Key": "not-a-uuid"},
    )

    assert valid.status_code == 201
    assert invalid.status_code == 422
    assert invalid.json()["detail"][0]["loc"] == ["header", "Idempotency-Key"]


def test_openapi_documents_all_mvp_operations(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    operations = {
        (method, path): operation
        for path, methods in schema["paths"].items()
        if path.startswith("/api/v1")
        for method, operation in methods.items()
    }
    expected = {
        (method.lower(), "/api/v1" + path.replace("/1/status", "/{order_id}/status"))
        for method, path, *_ in REQUESTS
        if "/1" not in path or path.endswith("/1/status")
    }
    expected.update({
        (method, "/api/v1" + path)
        for path, methods in {
            "/categories/{category_id}": ["get", "patch", "delete"],
            "/products/{product_id}": ["get", "patch", "delete"],
            "/cart/items/{item_id}": ["patch", "delete"],
            "/orders/{order_id}": ["get"],
        }.items()
        for method in methods
    })
    assert set(operations) == expected
    assert len({operation["operationId"] for operation in operations.values()}) == len(operations)
    for (method, path), operation in operations.items():
        success = next(value for code, value in operation["responses"].items() if code.startswith("2"))
        if "204" in operation["responses"]:
            assert "content" not in success
        else:
            assert success["content"]["application/json"]["schema"]
        if method in {"post", "patch"}:
            assert operation["requestBody"]["required"] is True
            assert "$ref" in operation["requestBody"]["content"]["application/json"]["schema"]
        if "admin" in operation["tags"]:
            assert {"BearerAuth": []} in operation["security"]
            assert {"401", "403"} <= operation["responses"].keys()
    assert {} in operations[("get", "/api/v1/products")]["security"]
    assert schema["components"]["securitySchemes"]["BearerAuth"]["scheme"] == "bearer"
    assert "password" not in schema["components"]["schemas"]["UserRead"]["properties"]
    assert "ErrorResponse" in schema["components"]["schemas"]
    assert "HTTPValidationError" in schema["components"]["schemas"]
