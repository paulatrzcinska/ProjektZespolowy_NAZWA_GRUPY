from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.order import Order


class PaymentStatus(str, Enum):
    pending = "pending"
    awaiting_payment = "awaiting_payment"
    paid = "paid"
    failed = "failed"


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint("amount_minor = amount * 100", name="amount_minor_matches"),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="currency_format"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    provider: Mapped[str] = mapped_column(String(32))
    session_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    currency: Mapped[str] = mapped_column(
        String(3), default="PLN", server_default=text("'PLN'")
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, name="payment_status"),
        default=PaymentStatus.pending,
        server_default=text("'pending'"),
    )
    provider_token: Mapped[str | None] = mapped_column(String(512))
    provider_order_id: Mapped[str | None] = mapped_column(String(64))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    order: Mapped[Order] = relationship(back_populates="payments")
