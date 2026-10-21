from fastapi import APIRouter, Response

from app.api.deps import AdminUser, DbSession, ResourceId
from app.api.responses import error_responses
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate
from app.services import catalog

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
async def list_categories(db: DbSession) -> list[CategoryRead]:
    return await catalog.list_categories(db)


@router.get(
    "/{category_id}", response_model=CategoryRead, responses=error_responses(404)
)
async def get_category(category_id: ResourceId, db: DbSession) -> CategoryRead:
    return CategoryRead.model_validate(await catalog.category_or_404(db, category_id))


@router.post(
    "",
    response_model=CategoryRead,
    status_code=201,
    tags=["admin"],
    responses=error_responses(401, 403, 409),
)
async def create_category(
    body: CategoryCreate, admin: AdminUser, db: DbSession
) -> CategoryRead:
    return await catalog.save_category(db, body)


@router.patch(
    "/{category_id}",
    response_model=CategoryRead,
    tags=["admin"],
    responses=error_responses(401, 403, 404, 409),
)
async def update_category(
    category_id: ResourceId, body: CategoryUpdate, admin: AdminUser, db: DbSession
) -> CategoryRead:
    return await catalog.save_category(db, body, category_id)


@router.delete(
    "/{category_id}",
    status_code=204,
    tags=["admin"],
    responses=error_responses(401, 403, 404, 409),
)
async def delete_category(
    category_id: ResourceId, admin: AdminUser, db: DbSession
) -> Response:
    await catalog.delete_category(db, category_id)
    return Response(status_code=204)
