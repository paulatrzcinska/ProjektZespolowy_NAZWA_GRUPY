"""Independent example responses for the MVP contract preview; no persistent state."""

from datetime import datetime, timezone
from decimal import Decimal

from app.models.order import OrderStatus
from app.schemas.cart import CartItemResponse, CartResponse
from app.schemas.category import CategoryRead
from app.schemas.order import OrderItemRead, OrderRead
from app.schemas.product import ProductListRead, ProductRead
from app.schemas.user import UserRead

USER_TOKEN = "example-user-token"
ADMIN_TOKEN = "example-admin-token"


def example_user(*, admin: bool = False) -> UserRead:
    return UserRead(
        id=2 if admin else 1,
        email="admin@example.com" if admin else "user@example.com",
        full_name="Administrator" if admin else "Jan Kowalski",
        is_admin=admin,
    )


def example_category(category_id: int = 1) -> CategoryRead:
    return CategoryRead(
        id=category_id, name="Krzesła", slug="krzesla", description="Krzesła do salonu"
    )


def example_product(product_id: int = 1) -> ProductRead:
    return ProductRead(
        id=product_id,
        name="Krzesło dębowe",
        slug="krzeslo-debowe",
        description="Krzesło z litego drewna",
        price=Decimal("199.99"),
        stock_quantity=10,
        category_id=1,
        image_url=None,
        is_active=True,
    )


def example_product_summary(product_id: int = 1) -> ProductListRead:
    return ProductListRead(**example_product(product_id).model_dump(exclude={"description"}))


def example_cart() -> CartResponse:
    return CartResponse(
        id=1,
        items=[CartItemResponse(
            id=1, product_id=1, quantity=2, line_total=Decimal("399.98"),
            product=example_product_summary(),
        )],
        items_count=2,
        subtotal=Decimal("399.98"),
    )


def example_order(order_id: int = 1) -> OrderRead:
    return OrderRead(
        id=order_id,
        status=OrderStatus.pending,
        total_amount=Decimal("399.98"),
        created_at=datetime(2026, 10, 19, 12, 0, tzinfo=timezone.utc),
        shipping_full_name="Jan Kowalski",
        shipping_address_line1="ul. Długa 1",
        shipping_address_line2=None,
        shipping_city="Warszawa",
        shipping_postal_code="00-001",
        shipping_country="Polska",
        shipping_notes=None,
        items=[OrderItemRead(
            id=1, product_id=1, quantity=2, unit_price=Decimal("199.99"),
            product_name_snapshot="Krzesło dębowe",
        )],
    )
