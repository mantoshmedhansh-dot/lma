from app.routers.health import router as health_router
from app.routers.auth import router as auth_router
from app.routers.merchants import router as merchants_router
from app.routers.orders import router as orders_router
from app.routers.deliveries import router as deliveries_router
from app.routers.payments import router as payments_router
from app.routers.hubs import router as hubs_router
from app.routers.hub_orders import router as hub_orders_router
from app.routers.hub_routes import router as hub_routes_router
from app.routers.fleet import router as fleet_router
from app.routers.hub_delivery import router as hub_delivery_router
from app.routers.hub_analytics import router as hub_analytics_router

__all__ = [
    "health_router",
    "auth_router",
    "merchants_router",
    "orders_router",
    "deliveries_router",
    "payments_router",
    "hubs_router",
    "hub_orders_router",
    "hub_routes_router",
    "fleet_router",
    "hub_delivery_router",
    "hub_analytics_router",
]
