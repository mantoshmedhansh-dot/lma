from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional, Dict

from app.core.supabase import get_supabase
from app.core.security import get_current_user, require_role
from app.models.hub import (
    VehicleCreate,
    VehicleUpdate,
    VehicleResponse,
)

router = APIRouter(prefix="/fleet", tags=["Fleet"])


# =====================================================
# VEHICLES
# =====================================================

@router.post("/vehicles", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    vehicle_data: VehicleCreate,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Add a vehicle to a hub."""
    supabase = get_supabase()

    result = supabase.table("hub_vehicles").insert(vehicle_data.model_dump()).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create vehicle")

    return VehicleResponse(**result.data[0])


@router.get("/vehicles", response_model=List[VehicleResponse])
async def list_vehicles(
    hub_id: Optional[str] = None,
    vehicle_type: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """List vehicles with filters."""
    supabase = get_supabase()

    query = supabase.table("hub_vehicles").select("*")

    if hub_id:
        query = query.eq("hub_id", hub_id)
    if vehicle_type:
        query = query.eq("vehicle_type", vehicle_type)
    if status_filter:
        query = query.eq("status", status_filter)

    query = query.eq("is_active", True)
    result = query.order("created_at", desc=True).execute()

    return [VehicleResponse(**v) for v in result.data]


@router.patch("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: str,
    vehicle_data: VehicleUpdate,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Update a vehicle."""
    supabase = get_supabase()

    update_data = vehicle_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.table("hub_vehicles").update(update_data).eq("id", vehicle_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    return VehicleResponse(**result.data[0])


@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(
    vehicle_id: str,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Soft-delete a vehicle."""
    supabase = get_supabase()

    result = supabase.table("hub_vehicles").update({
        "is_active": False,
        "status": "inactive",
    }).eq("id", vehicle_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    return {"message": "Vehicle removed", "vehicle_id": vehicle_id}


# =====================================================
# DRIVERS
# =====================================================

@router.get("/drivers")
async def list_drivers(
    hub_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """List drivers at a hub."""
    supabase = get_supabase()

    query = supabase.table("drivers").select("*, users(first_name, last_name, email, phone)")

    if hub_id:
        query = query.eq("hub_id", hub_id)
    if status_filter:
        query = query.eq("status", status_filter)

    query = query.eq("is_active", True)
    result = query.execute()

    drivers = []
    for d in (result.data or []):
        user_info = d.pop("users", {}) or {}
        drivers.append({
            **d,
            "first_name": user_info.get("first_name", ""),
            "last_name": user_info.get("last_name", ""),
            "email": user_info.get("email", ""),
            "user_phone": user_info.get("phone", ""),
        })

    return drivers


@router.post("/drivers/{driver_id}/assign-hub")
async def assign_driver_to_hub(
    driver_id: str,
    hub_id: str = Query(...),
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Assign a driver to a hub."""
    supabase = get_supabase()

    result = supabase.table("drivers").update({
        "hub_id": hub_id,
    }).eq("id", driver_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Driver not found")

    return {"message": "Driver assigned to hub", "driver_id": driver_id, "hub_id": hub_id}
