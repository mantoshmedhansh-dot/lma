from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional, Dict
from datetime import datetime, date

from app.core.supabase import get_supabase
from app.core.security import get_current_user, require_role
from app.models.hub import (
    HubCreate,
    HubUpdate,
    HubResponse,
    HubStats,
)

router = APIRouter(prefix="/hubs", tags=["Hubs"])


@router.post("", response_model=HubResponse, status_code=status.HTTP_201_CREATED)
async def create_hub(
    hub_data: HubCreate,
    current_user: Dict = Depends(require_role(["admin", "super_admin"]))
):
    """Create a new delivery hub."""
    supabase = get_supabase()

    # Check for duplicate code
    existing = supabase.table("hubs").select("id").eq("code", hub_data.code).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Hub code already exists")

    hub = hub_data.model_dump()
    result = supabase.table("hubs").insert(hub).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create hub")

    return HubResponse(**result.data[0])


@router.get("", response_model=List[HubResponse])
async def list_hubs(
    is_active: Optional[bool] = None,
    current_user: Dict = Depends(get_current_user)
):
    """List hubs. Admin sees all, hub_manager sees only their hub."""
    supabase = get_supabase()
    role = current_user.get("role", "customer")

    if role == "hub_manager":
        # Hub manager sees only their assigned hub
        query = supabase.table("hubs").select("*").eq("manager_id", current_user["id"])
    elif role in ("admin", "super_admin"):
        query = supabase.table("hubs").select("*")
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if is_active is not None:
        query = query.eq("is_active", is_active)

    result = query.order("created_at", desc=True).execute()
    return [HubResponse(**h) for h in result.data]


@router.get("/{hub_id}", response_model=HubResponse)
async def get_hub(
    hub_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get hub detail."""
    supabase = get_supabase()
    role = current_user.get("role", "customer")

    result = supabase.table("hubs").select("*").eq("id", hub_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Hub not found")

    # Hub managers can only see their own hub
    if role == "hub_manager" and result.data.get("manager_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    if role not in ("hub_manager", "admin", "super_admin", "driver"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    return HubResponse(**result.data)


@router.patch("/{hub_id}", response_model=HubResponse)
async def update_hub(
    hub_id: str,
    hub_data: HubUpdate,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Update a hub."""
    supabase = get_supabase()
    role = current_user.get("role")

    # Hub managers can only update their own hub
    if role == "hub_manager":
        existing = supabase.table("hubs").select("manager_id").eq("id", hub_id).single().execute()
        if not existing.data or existing.data.get("manager_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")

    update_data = hub_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.table("hubs").update(update_data).eq("id", hub_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Hub not found")

    return HubResponse(**result.data[0])


@router.get("/{hub_id}/stats", response_model=HubStats)
async def get_hub_stats(
    hub_id: str,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Get hub dashboard stats for today."""
    supabase = get_supabase()
    today = date.today().isoformat()

    # Total orders today
    all_orders = supabase.table("delivery_orders").select("status").eq(
        "hub_id", hub_id
    ).gte("created_at", today + "T00:00:00").execute()

    total = len(all_orders.data) if all_orders.data else 0
    pending = sum(1 for o in (all_orders.data or []) if o["status"] == "pending")
    out_for_delivery = sum(1 for o in (all_orders.data or []) if o["status"] == "out_for_delivery")
    delivered = sum(1 for o in (all_orders.data or []) if o["status"] == "delivered")
    failed = sum(1 for o in (all_orders.data or []) if o["status"] == "failed")

    completion_rate = (delivered / total * 100) if total > 0 else 0

    # Active drivers
    active_drivers = supabase.table("drivers").select("id").eq(
        "hub_id", hub_id
    ).in_("status", ["online", "on_delivery"]).execute()

    # Active routes
    active_routes = supabase.table("delivery_routes").select("id").eq(
        "hub_id", hub_id
    ).eq("route_date", today).in_("status", ["assigned", "in_progress"]).execute()

    return HubStats(
        total_orders_today=total,
        pending_orders=pending,
        out_for_delivery=out_for_delivery,
        delivered_today=delivered,
        failed_today=failed,
        completion_rate=round(completion_rate, 1),
        active_drivers=len(active_drivers.data) if active_drivers.data else 0,
        active_routes=len(active_routes.data) if active_routes.data else 0,
    )
