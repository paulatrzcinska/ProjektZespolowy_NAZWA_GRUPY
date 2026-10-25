from pydantic import BaseModel, Field


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=200, examples=["Krzesła"])
    slug: str = Field(
        min_length=1, max_length=200, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", examples=["krzesla"]
    )
    description: str | None = Field(default=None, examples=["Krzesła do salonu"])


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    """Omitted fields or null name/slug keep their values; null clears description."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(
        default=None, min_length=1, max_length=200, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
    )
    description: str | None = None


class CategoryRead(CategoryBase):
    model_config = {"from_attributes": True}

    id: int
