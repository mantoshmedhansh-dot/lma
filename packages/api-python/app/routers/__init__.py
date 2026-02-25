from app.routers.health import router as health_router
from app.routers.auth import router as auth_router
from app.routers.merchants import router as merchants_router
from app.routers.orders import router as orders_router
from app.routers.deliveries import router as deliveries_router
from app.routers.payments import router as payments_router

__all__ = [
    "health_router",
    "auth_router",
    "merchants_router",
    "orders_router",
    "deliveries_router",
    "payments_router",
]
