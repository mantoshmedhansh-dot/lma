from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional, Dict
from datetime import datetime
import uuid

from app.core.supabase import get_supabase
from app.core.security import get_current_user, require_role
from app.models.reverse_pickup import (
    ReversePickupCreate,
    ReversePickupUpdate,
    ReversePickupResponse,
    ReversePickupDetailResponse,
    PickupAttemptResponse,
)

router = APIRouter(prefix="/reverse-pickups", tags=["Reverse Pickups"])


def get_user_hub_id(current_user: Dict) -> Optional[str]:
    """Get the hub_id the user has access to."""
    role = current_user.get("role")
    if role in ("admin", "super_admin"):
        return None  # Admin can access all hubs
    if role == "hub_manager":
        supabase = get_supabase()
        hub = supabase.table("hubs").select("id").eq("manager_id", current_user["id"]).limit(1).execute()
        if hub.data:
            return hub.data[0]["id"]
    return None


@router.post("", response_model=ReversePickupResponse, status_code=status.HTTP_201_CREATED)
async def create_pickup(
    pickup_data: ReversePickupCreate,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Create a reverse pickup. Optionally auto-fill from original order."""
    supabase = get_supabase()

    pickup_dict = pickup_data.model_dump()
    pickup_dict["pickup_number"] = f"RP-{uuid.uuid4().hex[:8].upper()}"

    # Convert date to string
    if pickup_dict.get("scheduled_date"):
        pickup_dict["scheduled_date"] = pickup_dict["scheduled_date"].isoformat()

    # Auto-fill from original order if provided
    if pickup_data.original_order_id:
        order = supabase.table("delivery_orders").select("*").eq(
            "id", pickup_data.original_order_id
        ).single().execute()
        if order.data:
            o = order.data
            # Fill customer info if not provided
            if not pickup_data.customer_name:
                pickup_dict["customer_name"] = o.get("customer_name", "")
            if not pickup_data.customer_phone:
                pickup_dict["customer_phone"] = o.get("customer_phone", "")
            if not pickup_data.customer_email:
                pickup_dict["customer_email"] = o.get("customer_email")
            # Fill address (delivery address becomes pickup address)
            if not pickup_data.pickup_address:
                pickup_dict["pickup_address"] = o.get("delivery_address", "")
            if not pickup_data.pickup_city:
                pickup_dict["pickup_city"] = o.get("delivery_city")
            if not pickup_data.pickup_state:
                pickup_dict["pickup_state"] = o.get("delivery_state")
            if not pickup_data.pickup_postal_code:
                pickup_dict["pickup_postal_code"] = o.get("delivery_postal_code")
            pickup_dict["pickup_latitude"] = pickup_dict.get("pickup_latitude") or o.get("delivery_latitude")
            pickup_dict["pickup_longitude"] = pickup_dict.get("pickup_longitude") or o.get("delivery_longitude")
            # Fill product info
            if not pickup_data.product_description:
                pickup_dict["product_description"] = o.get("product_description", "Return Item")
            if not pickup_data.product_sku:
                pickup_dict["product_sku"] = o.get("product_sku")
            if not pickup_data.total_weight_kg:
                pickup_dict["total_weight_kg"] = o.get("total_weight_kg")
            # Copy external refs
            pickup_dict["external_order_id"] = pickup_dict.get("external_order_id") or o.get("external_order_id")
            pickup_dict["external_source"] = pickup_dict.get("external_source") or o.get("external_source")

    result = supabase.table("reverse_pickups").insert(pickup_dict).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create reverse pickup")

    return ReversePickupResponse(**result.data[0])


@router.get("", response_model=List[ReversePickupResponse])
async def list_pickups(
    hub_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    source: Optional[str] = None,
    scheduled_date: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """List reverse pickups with filters."""
    supabase = get_supabase()
    role = current_user.get("role")

    query = supabase.table("reverse_pickups").select("*")

    # Hub filtering
    if role == "hub_manager":
        user_hub_id = get_user_hub_id(current_user)
        if user_hub_id:
            query = query.eq("hub_id", user_hub_id)
        else:
            return []
    elif hub_id:
        query = query.eq("hub_id", hub_id)

    # Apply filters
    if status_filter:
        query = query.eq("status", status_filter)
    if source:
        query = query.eq("source", source)
    if scheduled_date:
        query = query.eq("scheduled_date", scheduled_date)
    if search:
        query = query.or_(
            f"pickup_number.ilike.%{search}%,customer_name.ilike.%{search}%,customer_phone.ilike.%{search}%"
        )

    # Pagination
    offset = (page - 1) * page_size
    result = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()

    return [ReversePickupResponse(**p) for p in result.data]


@router.get("/{pickup_id}", response_model=ReversePickupDetailResponse)
async def get_pickup_detail(
    pickup_id: str,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager", "driver"]))
):
    """Get reverse pickup detail with attempt history."""
    supabase = get_supabase()

    result = supabase.table("reverse_pickups").select("*").eq("id", pickup_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Reverse pickup not found")

    # Get pickup attempts
    attempts = supabase.table("pickup_attempts").select("*").eq(
        "pickup_id", pickup_id
    ).order("attempt_number").execute()

    # Get driver name if assigned
    driver_name = None
    if result.data.get("driver_id"):
        driver = supabase.table("drivers").select("user_id").eq(
            "id", result.data["driver_id"]
        ).single().execute()
        if driver.data:
            user = supabase.table("users").select("first_name, last_name").eq(
                "id", driver.data["user_id"]
            ).single().execute()
            if user.data:
                driver_name = f"{user.data['first_name']} {user.data['last_name']}"

    # Get original order number if linked
    original_order_number = None
    if result.data.get("original_order_id"):
        order = supabase.table("delivery_orders").select("order_number").eq(
            "id", result.data["original_order_id"]
        ).single().execute()
        if order.data:
            original_order_number = order.data["order_number"]

    return ReversePickupDetailResponse(
        **result.data,
        attempts=[PickupAttemptResponse(**a) for a in (attempts.data or [])],
        driver_name=driver_name,
        original_order_number=original_order_number,
    )


@router.patch("/{pickup_id}", response_model=ReversePickupResponse)
async def update_pickup(
    pickup_id: str,
    pickup_data: ReversePickupUpdate,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Update reverse pickup details."""
    supabase = get_supabase()

    update_data = pickup_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "scheduled_date" in update_data and update_data["scheduled_date"]:
        update_data["scheduled_date"] = update_data["scheduled_date"].isoformat()

    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("reverse_pickups").update(update_data).eq("id", pickup_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Reverse pickup not found")

    return ReversePickupResponse(**result.data[0])


@router.delete("/{pickup_id}")
async def cancel_pickup(
    pickup_id: str,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Cancel a reverse pickup."""
    supabase = get_supabase()

    pickup = supabase.table("reverse_pickups").select("status").eq("id", pickup_id).single().execute()
    if not pickup.data:
        raise HTTPException(status_code=404, detail="Reverse pickup not found")

    if pickup.data["status"] in ("picked_up", "received_at_hub", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel pickup with status: {pickup.data['status']}"
        )

    result = supabase.table("reverse_pickups").update({
        "status": "cancelled",
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", pickup_id).execute()

    return {"message": "Pickup cancelled", "pickup_id": pickup_id}


@router.post("/{pickup_id}/assign")
async def assign_driver(
    pickup_id: str,
    driver_id: str,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Assign a driver to a reverse pickup."""
    supabase = get_supabase()

    pickup = supabase.table("reverse_pickups").select("status").eq("id", pickup_id).single().execute()
    if not pickup.data:
        raise HTTPException(status_code=404, detail="Reverse pickup not found")

    if pickup.data["status"] not in ("pickup_pending", "assigned"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot assign driver to pickup with status: {pickup.data['status']}"
        )

    now = datetime.utcnow().isoformat()
    result = supabase.table("reverse_pickups").update({
        "driver_id": driver_id,
        "status": "assigned",
        "assigned_at": now,
        "updated_at": now,
    }).eq("id", pickup_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Reverse pickup not found")

    return {"message": "Driver assigned", "pickup_id": pickup_id, "driver_id": driver_id}


@router.post("/{pickup_id}/receive")
async def receive_at_hub(
    pickup_id: str,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Hub confirms receipt of returned item."""
    supabase = get_supabase()

    pickup = supabase.table("reverse_pickups").select("status").eq("id", pickup_id).single().execute()
    if not pickup.data:
        raise HTTPException(status_code=404, detail="Reverse pickup not found")

    if pickup.data["status"] != "picked_up":
        raise HTTPException(
            status_code=400,
            detail=f"Can only receive pickups with status 'picked_up', current: {pickup.data['status']}"
        )

    now = datetime.utcnow().isoformat()
    result = supabase.table("reverse_pickups").update({
        "status": "received_at_hub",
        "received_at_hub_at": now,
        "updated_at": now,
    }).eq("id", pickup_id).execute()

    return {"message": "Pickup received at hub", "pickup_id": pickup_id}
