from fastapi import APIRouter, status

from app.api.deps import CurrentUser, ResourceId
from app.api.responses import error_responses
from app.schemas.cart import CartItemAdd, CartItemUpdate, CartResponse
from app.services.contract_examples import example_cart

router = APIRouter(prefix="/cart", tags=["cart"], responses=error_responses(401))


@router.get("", response_model=CartResponse, summary="Read the current user's cart")
async def get_cart(user: CurrentUser) -> CartResponse:
    return example_cart()


@router.post(
    "/items", response_model=CartResponse, status_code=status.HTTP_201_CREATED,
    responses=error_responses(400, 404), summary="Add a product to the cart",
)
async def add_cart_item(body: CartItemAdd, user: CurrentUser) -> CartResponse:
    return example_cart()


@router.patch(
    "/items/{item_id}", response_model=CartResponse,
    responses=error_responses(400, 404), summary="Set a cart item's quantity",
)
async def update_cart_item(
    item_id: ResourceId, body: CartItemUpdate, user: CurrentUser,
) -> CartResponse:
    return example_cart()


@router.delete(
    "/items/{item_id}", response_model=CartResponse,
    responses=error_responses(404), summary="Remove an item from the cart",
)
async def remove_cart_item(item_id: ResourceId, user: CurrentUser) -> CartResponse:
    return example_cart()
