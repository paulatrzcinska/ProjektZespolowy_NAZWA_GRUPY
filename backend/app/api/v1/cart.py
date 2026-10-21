from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession, ResourceId
from app.api.responses import error_responses
from app.schemas.cart import CartItemAdd, CartItemUpdate, CartResponse
from app.services import carts

router = APIRouter(prefix="/cart", tags=["cart"], responses=error_responses(401))


@router.get("", response_model=CartResponse)
async def get_cart(user: CurrentUser, db: DbSession) -> CartResponse:
    return await carts.read_cart(db, user.id)


@router.post(
    "/items",
    response_model=CartResponse,
    status_code=201,
    responses=error_responses(400, 404),
)
async def add_cart_item(
    body: CartItemAdd, user: CurrentUser, db: DbSession
) -> CartResponse:
    return await carts.add_item(db, user.id, body.product_id, body.quantity)


@router.patch(
    "/items/{item_id}", response_model=CartResponse, responses=error_responses(400, 404)
)
async def update_cart_item(
    item_id: ResourceId, body: CartItemUpdate, user: CurrentUser, db: DbSession
) -> CartResponse:
    return await carts.edit_item(db, user.id, item_id, body.quantity)


@router.delete(
    "/items/{item_id}", response_model=CartResponse, responses=error_responses(404)
)
async def remove_cart_item(
    item_id: ResourceId, user: CurrentUser, db: DbSession
) -> CartResponse:
    return await carts.edit_item(db, user.id, item_id, None)
