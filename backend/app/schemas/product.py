from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

ProductSort = Literal["newest", "price_asc", "price_desc", "name"]


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=300, examples=["Krzesło dębowe"])
    slug: str = Field(
        min_length=1, max_length=300, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        examples=["krzeslo-debowe"],
    )
    description: str | None = Field(default=None, examples=["Krzesło z litego drewna"])
    price: Decimal = Field(gt=0, decimal_places=2, max_digits=12, examples=["199.99"])
    stock_quantity: int = Field(ge=0, examples=[10])
    category_id: int = Field(ge=1, examples=[1])
    image_url: HttpUrl | None = None
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    """Omitted/null fields keep their values, except null clears description/image_url."""

    name: str | None = Field(default=None, min_length=1, max_length=300)
    slug: str | None = Field(
        default=None, min_length=1, max_length=300, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
    )
    description: str | None = None
    price: Decimal | None = Field(default=None, gt=0, decimal_places=2, max_digits=12)
    stock_quantity: int | None = Field(default=None, ge=0)
    category_id: int | None = Field(default=None, ge=1)
    image_url: HttpUrl | None = None
    is_active: bool | None = None


class ProductListRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    slug: str
    price: Decimal
    stock_quantity: int
    category_id: int
    image_url: str | None
    is_active: bool


class ProductRead(ProductListRead):
    description: str | None
