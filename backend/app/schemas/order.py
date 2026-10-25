from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.order import OrderStatus


class OrderCreate(BaseModel):
    shipping_full_name: str = Field(min_length=1, max_length=200, examples=["Jan Kowalski"])
    shipping_address_line1: str = Field(min_length=1, max_length=300, examples=["ul. Długa 1"])
    shipping_address_line2: str | None = Field(default=None, max_length=300)
    shipping_city: str = Field(min_length=1, max_length=120, examples=["Warszawa"])
    shipping_postal_code: str = Field(min_length=1, max_length=32, examples=["00-001"])
    shipping_country: str = Field(min_length=1, max_length=120, examples=["Polska"])
    shipping_notes: str | None = None


class OrderItemRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    product_name_snapshot: str


class OrderRead(OrderCreate):
    model_config = {"from_attributes": True}

    id: int
    status: OrderStatus
    total_amount: Decimal
    created_at: datetime
    items: list[OrderItemRead]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus = Field(examples=["shipped"])
