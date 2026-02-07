from fastapi import APIRouter
from datetime import datetime

from app.core.config import settings
from app.core.supabase import get_supabase

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "lma-api",
        "version": settings.APP_VERSION,
    }


@router.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check with dependency status."""
    checks = {
        "api": {"status": "healthy"},
        "database": {"status": "unknown"},
    }

    # Check Supabase connection
    try:
        supabase = get_supabase()
        # Simple query to test connection
        supabase.table("users").select("id").limit(1).execute()
        checks["database"] = {"status": "healthy"}
    except Exception as e:
        checks["database"] = {"status": "unhealthy", "error": str(e)}

    overall_status = "healthy" if all(
        check["status"] == "healthy" for check in checks.values()
    ) else "unhealthy"

    return {
        "status": overall_status,
        "timestamp": datetime.utcnow().isoformat(),
        "service": "lma-api",
        "version": settings.APP_VERSION,
        "environment": settings.NODE_ENV,
        "checks": checks,
    }


@router.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "LMA API - Last Mile Delivery Application",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }
