from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.deps import AdminUser, OptionalUser, ResourceId
from app.api.responses import error_responses
from app.schemas.product import ProductCreate, ProductListRead, ProductRead, ProductSort, ProductUpdate
from app.services.contract_examples import example_product, example_product_summary

router = APIRouter(prefix="/products", tags=["products"])


@router.get(
    "", response_model=list[ProductListRead], summary="List products",
    description=(
        "Paginated product list. X-Total-Count reports the count before pagination. "
        "The preview returns a fixed example and does not apply filters or sorting. "
        "include_inactive requires an admin token."
    ),
    responses={
        **error_responses(401, 403),
        200: {"headers": {"X-Total-Count": {
            "description": "Total matching products before pagination.",
            "schema": {"type": "integer", "minimum": 0},
        }}},
    },
    openapi_extra={"security": [{}, {"BearerAuth": []}]},
)
async def list_products(
    response: Response,
    current_user: OptionalUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category_id: int | None = Query(default=None, ge=1),
    include_inactive: bool = False,
    q: str | None = Query(default=None, max_length=200),
    sort: ProductSort = "newest",
    min_price: Decimal | None = Query(default=None, ge=0),
    max_price: Decimal | None = Query(default=None, ge=0),
) -> list[ProductListRead]:
    if include_inactive and (current_user is None or not current_user.is_admin):
        raise HTTPException(403, "Admin only")
    response.headers["X-Total-Count"] = "1"
    return [example_product_summary()][skip:skip + limit]


@router.get(
    "/{product_id}", response_model=ProductRead, responses=error_responses(404),
    summary="Read a product",
)
async def get_product(product_id: ResourceId) -> ProductRead:
    return example_product(product_id)


@router.post(
    "", response_model=ProductRead, status_code=status.HTTP_201_CREATED,
    responses=error_responses(401, 403, 409), tags=["admin"], summary="Create a product",
)
async def create_product(body: ProductCreate, admin: AdminUser) -> ProductRead:
    return ProductRead(id=2, **body.model_dump(mode="json"))


@router.patch(
    "/{product_id}", response_model=ProductRead,
    responses=error_responses(401, 403, 404, 409), tags=["admin"], summary="Update a product",
)
async def update_product(
    product_id: ResourceId, body: ProductUpdate, admin: AdminUser,
) -> ProductRead:
    return example_product(product_id)


@router.delete(
    "/{product_id}", status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(401, 403, 404, 409), tags=["admin"], summary="Delete a product",
    description="Soft delete by default; hard=true requests permanent deletion.",
)
async def delete_product(
    product_id: ResourceId, admin: AdminUser, hard: bool = False,
) -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)
