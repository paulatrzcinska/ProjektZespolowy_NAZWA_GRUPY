from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    detail: str = Field(examples=["Product not found"])
