from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time

from app.core.config import settings
from app.routers import (
    health_router,
    auth_router,
    merchants_router,
    orders_router,
    deliveries_router,
    payments_router,
    hubs_router,
    hub_orders_router,
    hub_routes_router,
    fleet_router,
    hub_delivery_router,
    hub_analytics_router,
)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Delivery Hub Operations System API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred" if settings.is_production else str(exc),
            }
        }
    )


# Include routers
app.include_router(health_router)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(merchants_router, prefix="/api/v1")
app.include_router(orders_router, prefix="/api/v1")
app.include_router(deliveries_router, prefix="/api/v1")
app.include_router(payments_router, prefix="/api/v1")
app.include_router(hubs_router, prefix="/api/v1")
app.include_router(hub_orders_router, prefix="/api/v1")
app.include_router(hub_routes_router, prefix="/api/v1")
app.include_router(fleet_router, prefix="/api/v1")
app.include_router(hub_delivery_router, prefix="/api/v1")
app.include_router(hub_analytics_router, prefix="/api/v1")


# Startup event
@app.on_event("startup")
async def startup_event():
    print(f"""
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 Delivery Hub Operations API (FastAPI)              ║
║                                                        ║
║   Environment: {settings.NODE_ENV.ljust(39)}║
║   Port: {str(settings.PORT).ljust(45)}║
║   URL: http://localhost:{settings.PORT}{' ' * 28}║
║                                                        ║
║   Health: http://localhost:{settings.PORT}/health{' ' * 18}║
║   API: http://localhost:{settings.PORT}/api/v1{' ' * 18}║
║   Docs: http://localhost:{settings.PORT}/docs{' ' * 19}║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    """)


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    print("\nShutting down gracefully...")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=not settings.is_production,
    )
