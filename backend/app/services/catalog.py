from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate
from app.schemas.product import (
    ProductCreate,
    ProductListRead,
    ProductRead,
    ProductSort,
    ProductUpdate,
)
from app.services.transactions import commit


async def category_or_404(db: AsyncSession, category_id: int) -> Category:
    item = await db.get(Category, category_id)
    if item is None:
        raise HTTPException(404, "Category not found")
    return item


async def list_categories(db: AsyncSession) -> list[CategoryRead]:
    return [
        CategoryRead.model_validate(item)
        for item in (
            await db.scalars(select(Category).order_by(Category.name, Category.id))
        ).all()
    ]


async def save_category(
    db: AsyncSession,
    body: CategoryCreate | CategoryUpdate,
    category_id: int | None = None,
) -> CategoryRead:
    values = body.model_dump(exclude_unset=True)
    values = {
        key: value
        for key, value in values.items()
        if value is not None or key == "description"
    }
    if category_id is None:
        item = Category(**values)
        db.add(item)
    else:
        item = await category_or_404(db, category_id)
        for key, value in values.items():
            setattr(item, key, value)
    await commit(db, "Category slug already exists")
    await db.refresh(item)
    return CategoryRead.model_validate(item)


async def delete_category(db: AsyncSession, category_id: int) -> None:
    item = await category_or_404(db, category_id)
    await db.delete(item)
    await commit(db, "Category contains products")


async def product_or_404(
    db: AsyncSession, product_id: int, *, lock: bool = False
) -> Product:
    statement = select(Product).where(Product.id == product_id)
    if lock:
        statement = statement.with_for_update().execution_options(
            populate_existing=True
        )
    item = await db.scalar(statement)
    if item is None:
        raise HTTPException(404, "Product not found")
    return item


async def list_products(
    db: AsyncSession,
    user: User | None,
    *,
    skip: int,
    limit: int,
    category_id: int | None,
    include_inactive: bool,
    q: str | None,
    sort: ProductSort,
    min_price: Decimal | None,
    max_price: Decimal | None,
) -> tuple[list[ProductListRead], int]:
    if include_inactive and (user is None or not user.is_admin):
        raise HTTPException(403, "Admin only")
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(422, "min_price must not exceed max_price")
    filters = []
    if not include_inactive:
        filters.append(Product.is_active.is_(True))
    if category_id is not None:
        filters.append(Product.category_id == category_id)
    if q and q.strip():
        filters.append(Product.name.icontains(q.strip(), autoescape=True))
    if min_price is not None:
        filters.append(Product.price >= min_price)
    if max_price is not None:
        filters.append(Product.price <= max_price)
    total = await db.scalar(select(func.count()).select_from(Product).where(*filters))
    sorting = {
        "newest": Product.created_at.desc(),
        "price_asc": Product.price.asc(),
        "price_desc": Product.price.desc(),
        "name": Product.name.asc(),
    }
    rows = (
        await db.scalars(
            select(Product)
            .where(*filters)
            .order_by(sorting[sort], Product.id)
            .offset(skip)
            .limit(limit)
        )
    ).all()
    return [ProductListRead.model_validate(item) for item in rows], total


async def save_product(
    db: AsyncSession, body: ProductCreate | ProductUpdate, product_id: int | None = None
) -> ProductRead:
    values = body.model_dump(exclude_unset=True)
    nullable = {"description", "image_url"}
    values = {
        key: value
        for key, value in values.items()
        if value is not None or key in nullable
    }
    if values.get("stock_quantity", 0) > 2147483647:
        raise HTTPException(422, "Stock quantity must not exceed 2147483647")
    if "category_id" in values:
        await category_or_404(db, values["category_id"])
    if values.get("image_url") is not None:
        values["image_url"] = str(values["image_url"])
        if len(values["image_url"]) > 2048:
            raise HTTPException(422, "Image URL must not exceed 2048 characters")
    if product_id is None:
        item = Product(**values)
        db.add(item)
    else:
        item = await product_or_404(db, product_id, lock=True)
        for key, value in values.items():
            setattr(item, key, value)
    await commit(db, "Product slug already exists or category changed")
    await db.refresh(item)
    return ProductRead.model_validate(item)


async def delete_product(db: AsyncSession, product_id: int, hard: bool) -> None:
    item = await product_or_404(db, product_id, lock=True)
    if hard:
        # The database rejects references from carts and historical orders.
        await db.delete(item)
    else:
        item.is_active = False
    await commit(db, "Product is referenced by carts or orders")
