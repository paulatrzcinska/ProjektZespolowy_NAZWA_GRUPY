from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.product import ProductListRead


class CartItemAdd(BaseModel):
    product_id: int = Field(ge=1, examples=[1])
    quantity: int = Field(ge=1, le=999, examples=[2])


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1, le=999, examples=[3])


class CartItemResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    product_id: int
    quantity: int
    line_total: Decimal
    product: ProductListRead


class CartResponse(BaseModel):
    id: int
    items: list[CartItemResponse]
    items_count: int = Field(description="Total quantity of all items, not the number of lines.")
    subtotal: Decimal
