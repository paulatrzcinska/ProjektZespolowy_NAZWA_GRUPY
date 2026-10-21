from fastapi import APIRouter

from app.api.v1 import auth, cart, categories, orders, payments, products

router = APIRouter()
router.include_router(auth.router)
router.include_router(categories.router)
router.include_router(products.router)
router.include_router(cart.router)
router.include_router(orders.router)
router.include_router(payments.router)
