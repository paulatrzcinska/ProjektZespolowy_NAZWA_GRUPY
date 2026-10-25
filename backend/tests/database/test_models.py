from decimal import Decimal
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Cart,
    CartItem,
    Category,
    IdempotencyKey,
    Order,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentStatus,
    Product,
    User,
)
from app.schemas.order import OrderRead
from app.schemas.product import ProductRead
from app.schemas.user import UserRead
from app.scripts.seed import seed_catalogue

pytestmark = pytest.mark.database


@pytest_asyncio.fixture
async def catalogue(db_session: AsyncSession) -> tuple[User, Product, Cart]:
    user = User(
        email="user@example.com",
        hashed_password="test-password-hash",
        full_name="Jan Kowalski",
    )
    category = Category(name="Krzesła", slug="krzesla")
    product = Product(
        name="Krzesło dębowe",
        slug="krzeslo-debowe",
        price=Decimal("199.99"),
        stock_quantity=10,
        category=category,
    )
    cart = Cart(user=user)
    db_session.add_all([user, product, cart])
    await db_session.commit()
    return user, product, cart


def make_order(user_id: int) -> Order:
    return Order(
        user_id=user_id,
        total_amount=Decimal("399.98"),
        shipping_full_name="Jan Kowalski",
        shipping_address_line1="ul. Długa 1",
        shipping_city="Warszawa",
        shipping_postal_code="00-001",
        shipping_country="Polska",
    )


async def test_relations_defaults_and_schema_serialization(
    db_session: AsyncSession, catalogue
) -> None:
    user, product, cart = catalogue
    db_session.add(CartItem(cart=cart, product=product, quantity=2))
    order = make_order(user.id)
    order.items = [
        OrderItem(
            product=product,
            quantity=2,
            unit_price=product.price,
            product_name_snapshot=product.name,
        )
    ]
    payment = Payment(
        order=order,
        provider="test",
        session_id="test-session",
        amount=Decimal("399.98"),
        amount_minor=39998,
    )
    db_session.add_all([order, payment])
    await db_session.flush()
    db_session.add(IdempotencyKey(key=str(uuid4()), user_id=user.id, order_id=order.id))
    await db_session.commit()
    result = await db_session.scalar(select(Order).options(selectinload(Order.items)))

    assert result.status == OrderStatus.pending
    assert payment.status == PaymentStatus.pending
    assert payment.currency == "PLN"
    assert user.is_active is True and user.is_admin is False
    assert result.created_at.tzinfo is not None
    assert (
        OrderRead.model_validate(result).model_dump(mode="json")["total_amount"]
        == "399.98"
    )
    assert (
        ProductRead.model_validate(product).model_dump(mode="json")["price"] == "199.99"
    )
    assert "password" not in UserRead.model_validate(user).model_dump()


@pytest.mark.parametrize(
    "field,value",
    [("price", Decimal(0)), ("price", Decimal(-1)), ("stock_quantity", -1)],
)
async def test_product_constraints(
    db_session: AsyncSession, catalogue, field: str, value
) -> None:
    _, product, _ = catalogue
    setattr(product, field, value)
    with pytest.raises(IntegrityError):
        await db_session.commit()


@pytest.mark.parametrize("quantity", [0, -1, 1000])
async def test_cart_quantity_constraints(
    db_session: AsyncSession, catalogue, quantity: int
) -> None:
    _, product, cart = catalogue
    db_session.add(CartItem(cart_id=cart.id, product_id=product.id, quantity=quantity))
    with pytest.raises(IntegrityError):
        await db_session.commit()


async def test_one_cart_per_user(db_session: AsyncSession, catalogue) -> None:
    user, _, _ = catalogue
    db_session.add(Cart(user_id=user.id))
    with pytest.raises(IntegrityError):
        await db_session.commit()


async def test_product_occurs_once_per_cart(
    db_session: AsyncSession, catalogue
) -> None:
    _, product, cart = catalogue
    db_session.add_all(
        [
            CartItem(cart_id=cart.id, product_id=product.id),
            CartItem(cart_id=cart.id, product_id=product.id),
        ]
    )
    with pytest.raises(IntegrityError):
        await db_session.commit()


@pytest.mark.parametrize("entity", ["email", "category_slug", "product_slug"])
async def test_unique_identifiers(
    db_session: AsyncSession, catalogue, entity: str
) -> None:
    user, product, _ = catalogue
    duplicates = {
        "email": User(email=user.email, hashed_password="another-hash"),
        "category_slug": Category(name="Duplicate", slug="krzesla"),
        "product_slug": Product(
            name="Duplicate",
            slug=product.slug,
            price=Decimal("1.00"),
            category_id=product.category_id,
        ),
    }
    db_session.add(duplicates[entity])
    with pytest.raises(IntegrityError):
        await db_session.commit()


async def test_foreign_keys_reject_unknown_products(
    db_session: AsyncSession, catalogue
) -> None:
    _, _, cart = catalogue
    db_session.add(CartItem(cart_id=cart.id, product_id=999999))
    with pytest.raises(IntegrityError):
        await db_session.commit()


async def test_cart_items_are_removed_with_cart(
    db_session: AsyncSession, catalogue
) -> None:
    _, product, cart = catalogue
    db_session.add(CartItem(cart_id=cart.id, product_id=product.id))
    await db_session.commit()
    await db_session.execute(delete(Cart).where(Cart.id == cart.id))
    await db_session.commit()
    assert await db_session.scalar(select(func.count()).select_from(CartItem)) == 0


@pytest.mark.parametrize("target", ["category", "product", "user"])
async def test_referenced_history_cannot_be_deleted(
    db_session: AsyncSession, catalogue, target: str
) -> None:
    user, product, _ = catalogue
    order = make_order(user.id)
    order.items = [
        OrderItem(
            product_id=product.id,
            quantity=1,
            unit_price=product.price,
            product_name_snapshot=product.name,
        )
    ]
    db_session.add(order)
    await db_session.commit()
    statements = {
        "category": delete(Category).where(Category.id == product.category_id),
        "product": delete(Product).where(Product.id == product.id),
        "user": delete(User).where(User.id == user.id),
    }
    with pytest.raises(IntegrityError):
        await db_session.execute(statements[target])
        await db_session.commit()


@pytest.mark.parametrize(
    "field,value",
    [
        ("amount", Decimal("-1.00")),
        ("amount_minor", 99),
        ("currency", "pln"),
    ],
)
async def test_payment_constraints(
    db_session: AsyncSession, catalogue, field: str, value
) -> None:
    user, _, _ = catalogue
    payment = Payment(
        order=make_order(user.id),
        provider="test",
        session_id="session",
        amount=Decimal("1.00"),
        amount_minor=100,
    )
    setattr(payment, field, value)
    db_session.add(payment)
    with pytest.raises(IntegrityError):
        await db_session.commit()


async def test_payment_minor_amount_supports_more_than_32_bits(
    db_session: AsyncSession, catalogue
) -> None:
    user, _, _ = catalogue
    payment = Payment(
        order=make_order(user.id),
        provider="test",
        session_id="large",
        amount=Decimal("21474836.48"),
        amount_minor=2147483648,
    )
    db_session.add(payment)
    await db_session.commit()
    await db_session.refresh(payment)
    assert payment.amount_minor == 2147483648


async def test_duplicate_idempotency_key_is_rejected(
    db_session: AsyncSession, catalogue
) -> None:
    user, _, _ = catalogue
    order = make_order(user.id)
    db_session.add(order)
    await db_session.flush()
    key = str(uuid4())
    db_session.add_all(
        [
            IdempotencyKey(key=key, user_id=user.id, order_id=order.id),
            IdempotencyKey(key=key, user_id=user.id, order_id=order.id),
        ]
    )
    with pytest.raises(IntegrityError):
        await db_session.commit()


async def test_order_enum_rejects_unknown_status(
    db_session: AsyncSession, catalogue
) -> None:
    user, _, _ = catalogue
    db_session.add(make_order(user.id))
    await db_session.commit()
    with pytest.raises(DBAPIError):
        await db_session.execute(text("UPDATE orders SET status = 'unknown'"))


async def test_seed_is_repeatable_and_preserves_changes(
    db_session: AsyncSession,
) -> None:
    await seed_catalogue(db_session)
    await db_session.commit()
    product = await db_session.scalar(
        select(Product).where(Product.slug == "kanapa-modulowa-luna")
    )
    product.price = Decimal("6000.00")
    product.stock_quantity = 1
    await db_session.commit()
    await seed_catalogue(db_session)
    await db_session.commit()
    await db_session.refresh(product)

    assert await db_session.scalar(select(func.count()).select_from(Category)) == 4
    assert await db_session.scalar(select(func.count()).select_from(Product)) == 12
    assert await db_session.scalar(select(func.count()).select_from(User)) == 0
    assert product.price == Decimal("6000.00") and product.stock_quantity == 1
