from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, Query

from app.api.deps import AdminUser, CurrentUser, DbSession, ResourceId
from app.api.responses import error_responses
from app.models.order import OrderStatus
from app.schemas.checkout import CheckoutRequest
from app.schemas.order import OrderRead, OrderStatusUpdate
from app.services import orders

router = APIRouter(prefix="/orders", tags=["orders"], responses=error_responses(401))


@router.post(
    "", response_model=OrderRead, status_code=201, responses=error_responses(400, 409)
)
async def create_order(
    body: CheckoutRequest,
    user: CurrentUser,
    db: DbSession,
    idempotency_key: Annotated[UUID | None, Header(alias="Idempotency-Key")] = None,
) -> OrderRead:
    return await orders.create_order(db, user.id, body, idempotency_key)


@router.get("", response_model=list[OrderRead])
async def list_my_orders(user: CurrentUser, db: DbSession) -> list[OrderRead]:
    return await orders.list_orders(db, user_id=user.id)


@router.get(
    "/admin/all",
    response_model=list[OrderRead],
    tags=["admin"],
    responses=error_responses(403),
)
async def admin_list_orders(
    admin: AdminUser,
    db: DbSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: OrderStatus | None = None,
    user_id: int | None = Query(None, ge=1),
) -> list[OrderRead]:
    return await orders.list_orders(
        db, user_id=user_id, status=status, skip=skip, limit=limit
    )


@router.patch(
    "/{order_id}/status",
    response_model=OrderRead,
    tags=["admin"],
    responses=error_responses(400, 403, 404, 409),
)
async def admin_update_order_status(
    order_id: ResourceId, body: OrderStatusUpdate, admin: AdminUser, db: DbSession
) -> OrderRead:
    return await orders.update_status(db, order_id, body.status)


@router.get("/{order_id}", response_model=OrderRead, responses=error_responses(404))
async def get_order(
    order_id: ResourceId, user: CurrentUser, db: DbSession
) -> OrderRead:
    return OrderRead.model_validate(
        await orders.load_order(db, order_id, user_id=user.id)
    )
