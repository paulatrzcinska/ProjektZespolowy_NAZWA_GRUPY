from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response

from app.api.deps import AdminUser, DbSession, OptionalUser, ResourceId
from app.api.responses import error_responses
from app.schemas.product import (
    ProductCreate,
    ProductListRead,
    ProductRead,
    ProductSort,
    ProductUpdate,
)
from app.services import catalog

router = APIRouter(prefix="/products", tags=["products"])


@router.get(
    "",
    response_model=list[ProductListRead],
    responses={
        **error_responses(401, 403),
        200: {
            "headers": {
                "X-Total-Count": {
                    "description": "Count before pagination",
                    "schema": {"type": "integer"},
                }
            }
        },
    },
)
async def list_products(
    response: Response,
    db: DbSession,
    current_user: OptionalUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category_id: int | None = Query(None, ge=1),
    include_inactive: bool = False,
    q: str | None = Query(None, max_length=200),
    sort: ProductSort = "newest",
    min_price: Annotated[Decimal | None, Query(ge=0)] = None,
    max_price: Annotated[Decimal | None, Query(ge=0)] = None,
) -> list[ProductListRead]:
    items, total = await catalog.list_products(
        db,
        current_user,
        skip=skip,
        limit=limit,
        category_id=category_id,
        include_inactive=include_inactive,
        q=q,
        sort=sort,
        min_price=min_price,
        max_price=max_price,
    )
    response.headers["X-Total-Count"] = str(total)
    if include_inactive:
        response.headers["Cache-Control"] = "no-store"
    return items


@router.get(
    "/{product_id}", response_model=ProductRead, responses=error_responses(401, 404)
)
async def get_product(
    product_id: ResourceId, db: DbSession, current_user: OptionalUser
) -> ProductRead:
    item = await catalog.product_or_404(db, product_id)
    if not item.is_active and (current_user is None or not current_user.is_admin):
        raise HTTPException(404, "Product not found")
    return ProductRead.model_validate(item)


@router.post(
    "",
    response_model=ProductRead,
    status_code=201,
    tags=["admin"],
    responses=error_responses(401, 403, 404, 409),
)
async def create_product(
    body: ProductCreate, admin: AdminUser, db: DbSession
) -> ProductRead:
    return await catalog.save_product(db, body)


@router.patch(
    "/{product_id}",
    response_model=ProductRead,
    tags=["admin"],
    responses=error_responses(401, 403, 404, 409),
)
async def update_product(
    product_id: ResourceId, body: ProductUpdate, admin: AdminUser, db: DbSession
) -> ProductRead:
    return await catalog.save_product(db, body, product_id)


@router.delete(
    "/{product_id}",
    status_code=204,
    tags=["admin"],
    responses=error_responses(401, 403, 404, 409),
)
async def delete_product(
    product_id: ResourceId, admin: AdminUser, db: DbSession, hard: bool = False
) -> Response:
    await catalog.delete_product(db, product_id, hard)
    return Response(status_code=204)
