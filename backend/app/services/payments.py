from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_runtime_settings
from app.models.order import OrderStatus
from app.models.payment import Payment, PaymentStatus
from app.schemas.payment import PaymentRead
from app.services.orders import load_order
from app.services.transactions import commit


def require_mock() -> None:
    settings = get_runtime_settings()
    if not settings.payments_mock or settings.app_env not in {"local", "test"}:
        raise HTTPException(404, "Payment simulation is disabled")


def payment_response(payment: Payment) -> PaymentRead:
    return PaymentRead(
        payment_id=payment.id,
        order_id=payment.order_id,
        session_id=payment.session_id,
        provider=payment.provider,
        status=payment.status,
        amount=payment.amount,
        currency=payment.currency,
    )


async def create_mock_session(
    db: AsyncSession, user_id: int, order_id: int
) -> PaymentRead:
    require_mock()
    order = await load_order(db, order_id, user_id=user_id, lock=True)
    if order.status not in {OrderStatus.pending, OrderStatus.paid}:
        raise HTTPException(409, "Order cannot be paid")
    payment = await db.scalar(
        select(Payment)
        .where(
            Payment.order_id == order.id,
            Payment.provider == "mock",
            Payment.status.in_([PaymentStatus.awaiting_payment, PaymentStatus.paid]),
        )
        .order_by(Payment.id.desc())
    )
    if payment is not None:
        return payment_response(payment)
    if order.status != OrderStatus.pending:
        raise HTTPException(409, "Order is already paid")
    payment = Payment(
        order_id=order.id,
        provider="mock",
        session_id=str(uuid4()),
        amount=order.total_amount,
        amount_minor=int(order.total_amount * 100),
        currency="PLN",
        status=PaymentStatus.awaiting_payment,
    )
    db.add(payment)
    await commit(db)
    await db.refresh(payment)
    return payment_response(payment)


async def read_payment(db: AsyncSession, user_id: int, payment_id: int) -> PaymentRead:
    payment = await db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(404, "Payment not found")
    await load_order(db, payment.order_id, user_id=user_id)
    return payment_response(payment)


async def complete_mock(
    db: AsyncSession, user_id: int, payment_id: int, outcome: str
) -> PaymentRead:
    require_mock()
    # All payment creation/completion and admin status changes first lock the order.
    identity = (
        await db.execute(
            select(Payment.order_id, Payment.provider).where(Payment.id == payment_id)
        )
    ).first()
    if identity is None or identity.provider != "mock":
        raise HTTPException(404, "Payment not found")
    order = await load_order(db, identity.order_id, user_id=user_id, lock=True)
    payment = await db.get(Payment, payment_id, populate_existing=True)
    requested = PaymentStatus(outcome)
    if payment.status == requested:
        return payment_response(payment)
    if (
        payment.status != PaymentStatus.awaiting_payment
        or order.status != OrderStatus.pending
    ):
        raise HTTPException(409, "Payment or order is already finalized")
    payment.status = requested
    if requested == PaymentStatus.paid:
        order.status = OrderStatus.paid
        payment.provider_order_id = f"mock-{payment.id}"
    else:
        payment.last_error = "Local simulation of a failed payment"
    await commit(db)
    return payment_response(payment)
