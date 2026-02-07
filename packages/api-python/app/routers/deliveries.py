from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional, Dict
from datetime import datetime

from app.core.supabase import get_supabase
from app.core.security import get_current_user, require_role
from app.models.driver import (
    DriverCreate,
    DriverUpdate,
    DriverResponse,
    DriverLocationUpdate,
    DriverStatus,
)
from app.models.order import OrderResponse

router = APIRouter(prefix="/deliveries", tags=["Deliveries"])


@router.get("/drivers/me", response_model=DriverResponse)
async def get_my_driver_profile(current_user: Dict = Depends(require_role(["driver"]))):
    """Get the current driver's profile."""
    supabase = get_supabase()

    result = supabase.table("drivers").select("*").eq("user_id", current_user["id"]).single().execute()

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver profile not found")

    return DriverResponse(**result.data)


@router.post("/drivers", response_model=DriverResponse, status_code=status.HTTP_201_CREATED)
async def create_driver_profile(
    driver_data: DriverCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a driver profile."""
    supabase = get_supabase()

    # Check if driver profile already exists
    existing = supabase.table("drivers").select("id").eq("user_id", current_user["id"]).execute()
    if existing.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Driver profile already exists")

    driver = {
        **driver_data.model_dump(),
        "user_id": current_user["id"],
        "license_expiry": driver_data.license_expiry.isoformat(),
    }

    result = supabase.table("drivers").insert(driver).execute()

    # Update user role
    supabase.table("users").update({"role": "driver"}).eq("id", current_user["id"]).execute()

    return DriverResponse(**result.data[0])


@router.patch("/drivers/me", response_model=DriverResponse)
async def update_driver_profile(
    driver_data: DriverUpdate,
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Update the current driver's profile."""
    supabase = get_supabase()

    update_data = driver_data.model_dump(exclude_unset=True)

    result = supabase.table("drivers").update(update_data).eq("user_id", current_user["id"]).execute()

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver profile not found")

    return DriverResponse(**result.data[0])


@router.post("/drivers/me/location")
async def update_driver_location(
    location: DriverLocationUpdate,
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Update driver's current location."""
    supabase = get_supabase()

    result = supabase.table("drivers").update({
        "current_latitude": location.latitude,
        "current_longitude": location.longitude,
        "last_location_update": datetime.utcnow().isoformat(),
    }).eq("user_id", current_user["id"]).execute()

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver profile not found")

    return {"message": "Location updated", "latitude": location.latitude, "longitude": location.longitude}


@router.post("/drivers/me/status")
async def update_driver_status(
    new_status: DriverStatus,
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Update driver's availability status."""
    supabase = get_supabase()

    result = supabase.table("drivers").update({
        "status": new_status.value,
    }).eq("user_id", current_user["id"]).execute()

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver profile not found")

    return {"message": "Status updated", "status": new_status.value}


@router.get("/available", response_model=List[OrderResponse])
async def get_available_deliveries(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: float = 10,
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Get available orders for delivery."""
    supabase = get_supabase()

    # Get orders that are ready for pickup and don't have a driver assigned
    query = supabase.table("orders").select("*").eq("status", "ready_for_pickup").is_("driver_id", "null")

    result = query.order("created_at").limit(20).execute()

    orders = []
    for order_data in result.data:
        items = supabase.table("order_items").select("*").eq("order_id", order_data["id"]).execute()
        order_data["items"] = items.data or []
        orders.append(OrderResponse(**order_data))

    return orders


@router.post("/accept/{order_id}", response_model=OrderResponse)
async def accept_delivery(
    order_id: str,
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Accept a delivery order."""
    supabase = get_supabase()

    # Get driver ID
    driver = supabase.table("drivers").select("id, status").eq("user_id", current_user["id"]).single().execute()

    if not driver.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver profile not found")

    if driver.data["status"] != "online":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Driver must be online to accept deliveries")

    # Check if order is available
    order = supabase.table("orders").select("*").eq("id", order_id).single().execute()

    if not order.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if order.data["status"] != "ready_for_pickup":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order is not available for pickup")

    if order.data.get("driver_id"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order already assigned to another driver")

    # Assign driver to order
    result = supabase.table("orders").update({
        "driver_id": driver.data["id"],
        "status": "driver_assigned",
    }).eq("id", order_id).execute()

    # Update driver status
    supabase.table("drivers").update({"status": "on_delivery"}).eq("id", driver.data["id"]).execute()

    # Log status change
    supabase.table("order_status_history").insert({
        "order_id": order_id,
        "status": "driver_assigned",
        "changed_by": current_user["id"],
        "notes": f"Driver {current_user.get('first_name', '')} assigned",
    }).execute()

    # Get updated order
    updated_order = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    items = supabase.table("order_items").select("*").eq("order_id", order_id).execute()
    updated_order.data["items"] = items.data or []

    return OrderResponse(**updated_order.data)


@router.get("/my-deliveries", response_model=List[OrderResponse])
async def get_my_deliveries(
    status_filter: Optional[str] = None,
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Get current driver's assigned deliveries."""
    supabase = get_supabase()

    # Get driver ID
    driver = supabase.table("drivers").select("id").eq("user_id", current_user["id"]).single().execute()

    if not driver.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver profile not found")

    query = supabase.table("orders").select("*").eq("driver_id", driver.data["id"])

    if status_filter:
        query = query.eq("status", status_filter)
    else:
        # By default, show active deliveries
        query = query.in_("status", ["driver_assigned", "picked_up", "in_transit", "arrived"])

    result = query.order("created_at", desc=True).execute()

    orders = []
    for order_data in result.data:
        items = supabase.table("order_items").select("*").eq("order_id", order_data["id"]).execute()
        order_data["items"] = items.data or []
        orders.append(OrderResponse(**order_data))

    return orders


@router.get("/earnings")
async def get_driver_earnings(
    period: str = "today",  # today, week, month, all
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Get driver's earnings summary."""
    supabase = get_supabase()

    # Get driver ID
    driver = supabase.table("drivers").select("id, wallet_balance").eq("user_id", current_user["id"]).single().execute()

    if not driver.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver profile not found")

    # Get earnings
    earnings = supabase.table("driver_earnings").select("*").eq("driver_id", driver.data["id"]).execute()

    total_earnings = sum(e["total_earnings"] for e in earnings.data) if earnings.data else 0
    total_deliveries = len(earnings.data) if earnings.data else 0
    total_tips = sum(e["tip_amount"] for e in earnings.data) if earnings.data else 0

    return {
        "wallet_balance": driver.data["wallet_balance"],
        "total_earnings": total_earnings,
        "total_deliveries": total_deliveries,
        "total_tips": total_tips,
        "recent_earnings": earnings.data[:10] if earnings.data else [],
    }
