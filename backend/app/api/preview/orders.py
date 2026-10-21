from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, Query, status

from app.api.preview.deps import AdminUser, CurrentUser, ResourceId
from app.api.responses import error_responses
from app.models.order import OrderStatus
from app.schemas.order import OrderCreate, OrderRead, OrderStatusUpdate
from app.services.contract_examples import example_order

router = APIRouter(prefix="/orders", tags=["orders"], responses=error_responses(401))


@router.post(
    "",
    response_model=OrderRead,
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(400, 409),
    summary="Create an order from the current cart",
    description=(
        "The request contains shipping details; items and prices come from the cart. "
        "Idempotency-Key is an optional UUID reserved for safe retries. "
        "The preview does not persist orders or idempotency keys."
    ),
)
async def create_order(
    body: OrderCreate,
    user: CurrentUser,
    idempotency_key: Annotated[UUID | None, Header(alias="Idempotency-Key")] = None,
) -> OrderRead:
    return example_order().model_copy(update=body.model_dump())


@router.get(
    "", response_model=list[OrderRead], summary="List the current user's orders"
)
async def list_my_orders(user: CurrentUser) -> list[OrderRead]:
    return [example_order()]


@router.get(
    "/admin/all",
    response_model=list[OrderRead],
    responses=error_responses(403),
    tags=["admin"],
    summary="List all orders",
    description="Admin order list. The preview does not apply status or user filters.",
)
async def admin_list_orders(
    admin: AdminUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: OrderStatus | None = None,
    user_id: int | None = Query(default=None, ge=1),
) -> list[OrderRead]:
    return [example_order()][skip : skip + limit]


@router.patch(
    "/{order_id}/status",
    response_model=OrderRead,
    responses=error_responses(400, 403, 404),
    tags=["admin"],
    summary="Change an order's status",
)
async def admin_update_order_status(
    order_id: ResourceId,
    body: OrderStatusUpdate,
    admin: AdminUser,
) -> OrderRead:
    return example_order(order_id).model_copy(update={"status": body.status})


@router.get(
    "/{order_id}",
    response_model=OrderRead,
    responses=error_responses(404),
    summary="Read an order belonging to the current user",
)
async def get_order(order_id: ResourceId, user: CurrentUser) -> OrderRead:
    return example_order(order_id)
