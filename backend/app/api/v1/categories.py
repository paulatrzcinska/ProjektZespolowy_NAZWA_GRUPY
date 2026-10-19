from fastapi import APIRouter, Response, status

from app.api.deps import AdminUser, ResourceId
from app.api.responses import error_responses
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate
from app.services.contract_examples import example_category

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead], summary="List categories")
async def list_categories() -> list[CategoryRead]:
    return [example_category()]


@router.get(
    "/{category_id}", response_model=CategoryRead, responses=error_responses(404),
    summary="Read a category",
)
async def get_category(category_id: ResourceId) -> CategoryRead:
    return example_category(category_id)


@router.post(
    "", response_model=CategoryRead, status_code=status.HTTP_201_CREATED,
    responses=error_responses(401, 403, 409), tags=["admin"], summary="Create a category",
)
async def create_category(body: CategoryCreate, admin: AdminUser) -> CategoryRead:
    return CategoryRead(id=2, **body.model_dump())


@router.patch(
    "/{category_id}", response_model=CategoryRead,
    responses=error_responses(401, 403, 404, 409), tags=["admin"],
    summary="Update a category",
)
async def update_category(
    category_id: ResourceId, body: CategoryUpdate, admin: AdminUser,
) -> CategoryRead:
    return example_category(category_id)


@router.delete(
    "/{category_id}", status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(401, 403, 404, 409), tags=["admin"],
    summary="Delete a category",
)
async def delete_category(category_id: ResourceId, admin: AdminUser) -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)
