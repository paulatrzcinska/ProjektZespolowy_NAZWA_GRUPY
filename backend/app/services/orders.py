from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.cart import Cart, CartItem
from app.models.idempotency import IdempotencyKey
from app.models.order import Order, OrderItem, OrderStatus
from app.models.payment import Payment, PaymentStatus
from app.models.product import Product
from app.schemas.order import OrderCreate, OrderRead
from app.services.carts import lock_customer
from app.services.transactions import commit

TRANSITIONS = {
    OrderStatus.pending: {OrderStatus.paid, OrderStatus.cancelled},
    OrderStatus.paid: {OrderStatus.shipped, OrderStatus.cancelled},
    OrderStatus.shipped: set(),
    OrderStatus.cancelled: set(),
}


async def load_order(
    db: AsyncSession, order_id: int, *, user_id: int | None = None, lock: bool = False
) -> Order:
    statement = (
        select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    )
    if user_id is not None:
        statement = statement.where(Order.user_id == user_id)
    if lock:
        statement = statement.with_for_update().execution_options(
            populate_existing=True
        )
    order = await db.scalar(statement)
    if order is None:
        raise HTTPException(404, "Order not found")
    return order


async def create_order(
    db: AsyncSession, user_id: int, body: OrderCreate, key: UUID | None
) -> OrderRead:
    # Every cart writer and checkout serializes on this customer's row.
    await lock_customer(db, user_id)
    values = body.model_dump()
    if key is not None:
        previous = await db.scalar(
            select(IdempotencyKey).where(IdempotencyKey.key == str(key))
        )
        if previous is not None:
            if previous.user_id != user_id:
                raise HTTPException(409, "Idempotency key conflict")
            order = await load_order(db, previous.order_id, user_id=user_id)
            if any(getattr(order, name) != value for name, value in values.items()):
                raise HTTPException(
                    409, "Idempotency key was used with different shipping details"
                )
            return OrderRead.model_validate(order)
    cart = await db.scalar(select(Cart).where(Cart.user_id == user_id))
    items = (
        []
        if cart is None
        else list(
            (
                await db.scalars(
                    select(CartItem)
                    .where(CartItem.cart_id == cart.id)
                    .order_by(CartItem.product_id)
                )
            ).all()
        )
    )
    if not items:
        raise HTTPException(400, "Cart is empty")
    product_ids = [item.product_id for item in items]
    products = {
        product.id: product
        for product in (
            await db.scalars(
                select(Product)
                .where(Product.id.in_(product_ids))
                .order_by(Product.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).all()
    }
    total = Decimal("0.00")
    for item in items:
        product = products.get(item.product_id)
        if product is None or not product.is_active:
            raise HTTPException(400, "A cart product is unavailable")
        if product.stock_quantity < item.quantity:
            raise HTTPException(400, "Insufficient stock")
        total += product.price * item.quantity
    if total > Decimal("999999999999.99"):
        raise HTTPException(400, "Order total exceeds the supported amount")
    order = Order(user_id=user_id, total_amount=total, **values)
    db.add(order)
    await db.flush()
    for item in items:
        product = products[item.product_id]
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=item.quantity,
                unit_price=product.price,
                product_name_snapshot=product.name,
            )
        )
        product.stock_quantity -= item.quantity
    await db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))
    if key is not None:
        db.add(IdempotencyKey(key=str(key), user_id=user_id, order_id=order.id))
    await commit(db, "Concurrent idempotency key conflict")
    return OrderRead.model_validate(await load_order(db, order.id))


async def list_orders(
    db: AsyncSession,
    *,
    user_id: int | None,
    status: OrderStatus | None = None,
    skip: int = 0,
    limit: int | None = None,
) -> list[OrderRead]:
    statement = (
        select(Order)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc(), Order.id.desc())
        .offset(skip)
    )
    if user_id is not None:
        statement = statement.where(Order.user_id == user_id)
    if status is not None:
        statement = statement.where(Order.status == status)
    if limit is not None:
        statement = statement.limit(limit)
    return [
        OrderRead.model_validate(order) for order in (await db.scalars(statement)).all()
    ]


async def update_status(
    db: AsyncSession, order_id: int, status: OrderStatus
) -> OrderRead:
    order = await load_order(db, order_id, lock=True)
    if order.status == status:
        return OrderRead.model_validate(order)
    if status not in TRANSITIONS[order.status]:
        raise HTTPException(400, "Invalid order status transition")
    if status == OrderStatus.cancelled:
        ids = sorted(item.product_id for item in order.items)
        products = {
            product.id: product
            for product in (
                await db.scalars(
                    select(Product)
                    .where(Product.id.in_(ids))
                    .order_by(Product.id)
                    .with_for_update()
                    .execution_options(populate_existing=True)
                )
            ).all()
        }
        for item in order.items:
            product = products[item.product_id]
            if product.stock_quantity + item.quantity > 2147483647:
                raise HTTPException(
                    409, "Restored stock exceeds the supported quantity"
                )
            product.stock_quantity += item.quantity
    if status in {OrderStatus.paid, OrderStatus.cancelled}:
        pending = (
            await db.scalars(
                select(Payment).where(
                    Payment.order_id == order.id,
                    Payment.status.in_(
                        [PaymentStatus.pending, PaymentStatus.awaiting_payment]
                    ),
                )
            )
        ).all()
        for payment in pending:
            payment.status = PaymentStatus.failed
            payment.last_error = (
                "Order cancelled"
                if status == OrderStatus.cancelled
                else "Order paid outside this payment session"
            )
    order.status = status
    await commit(db)
    return OrderRead.model_validate(order)
