from pydantic import ConfigDict, Field

from app.schemas.order import OrderCreate


class CheckoutRequest(OrderCreate):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    shipping_notes: str | None = Field(default=None, max_length=8000)
