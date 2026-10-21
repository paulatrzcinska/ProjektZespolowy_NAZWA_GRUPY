from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.models.payment import PaymentStatus


class MockSessionRequest(BaseModel):
    order_id: int = Field(ge=1)


class MockCompletionRequest(BaseModel):
    outcome: Literal["paid", "failed"]


class PaymentRead(BaseModel):
    payment_id: int
    order_id: int
    session_id: str
    provider: str
    status: PaymentStatus
    amount: Decimal
    currency: str
