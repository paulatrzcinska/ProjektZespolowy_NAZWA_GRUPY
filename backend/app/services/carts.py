from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.cart import Cart, CartItem
from app.models.user import User
from app.schemas.cart import CartItemResponse, CartResponse
from app.schemas.product import ProductListRead
from app.services.catalog import product_or_404
from app.services.transactions import commit


async def lock_customer(db: AsyncSession, user_id: int) -> None:
    await db.execute(select(User.id).where(User.id == user_id).with_for_update())


async def ensure_cart(db: AsyncSession, user_id: int) -> Cart:
    cart = await db.scalar(select(Cart).where(Cart.user_id == user_id))
    if cart is None:
        cart = Cart(user_id=user_id)
        db.add(cart)
        await db.flush()
    return cart


async def cart_response(db: AsyncSession, user_id: int) -> CartResponse:
    cart = await db.scalar(select(Cart).where(Cart.user_id == user_id))
    items = (
        await db.scalars(
            select(CartItem)
            .where(CartItem.cart_id == cart.id)
            .options(selectinload(CartItem.product))
            .order_by(CartItem.id)
            .execution_options(populate_existing=True)
        )
    ).all()
    result = [
        CartItemResponse(
            id=item.id,
            product_id=item.product_id,
            quantity=item.quantity,
            line_total=item.product.price * item.quantity,
            product=ProductListRead.model_validate(item.product),
        )
        for item in items
    ]
    return CartResponse(
        id=cart.id,
        items=result,
        items_count=sum(item.quantity for item in result),
        subtotal=sum((item.line_total for item in result), Decimal("0.00")),
    )


async def read_cart(db: AsyncSession, user_id: int) -> CartResponse:
    await lock_customer(db, user_id)
    await ensure_cart(db, user_id)
    response = await cart_response(db, user_id)
    await commit(db)
    return response


async def add_item(
    db: AsyncSession, user_id: int, product_id: int, quantity: int
) -> CartResponse:
    await lock_customer(db, user_id)
    product = await product_or_404(db, product_id, lock=True)
    if not product.is_active:
        raise HTTPException(404, "Product not found")
    cart = await ensure_cart(db, user_id)
    item = await db.scalar(
        select(CartItem).where(
            CartItem.cart_id == cart.id, CartItem.product_id == product_id
        )
    )
    total = quantity + (item.quantity if item else 0)
    if total > 999 or total > product.stock_quantity:
        raise HTTPException(400, "Insufficient stock or cart quantity exceeds 999")
    if item:
        item.quantity = total
    else:
        db.add(CartItem(cart_id=cart.id, product_id=product_id, quantity=total))
    await db.flush()
    response = await cart_response(db, user_id)
    await commit(db)
    return response


async def edit_item(
    db: AsyncSession, user_id: int, item_id: int, quantity: int | None
) -> CartResponse:
    await lock_customer(db, user_id)
    cart = await ensure_cart(db, user_id)
    item = await db.scalar(
        select(CartItem).where(CartItem.cart_id == cart.id, CartItem.id == item_id)
    )
    if item is None:
        raise HTTPException(404, "Cart item not found")
    if quantity is None:
        await db.execute(delete(CartItem).where(CartItem.id == item.id))
    else:
        product = await product_or_404(db, item.product_id, lock=True)
        if not product.is_active or quantity > product.stock_quantity:
            raise HTTPException(400, "Product unavailable or insufficient stock")
        item.quantity = quantity
        await db.flush()
    response = await cart_response(db, user_id)
    await commit(db)
    return response
