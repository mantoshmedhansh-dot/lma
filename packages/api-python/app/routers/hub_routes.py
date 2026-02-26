from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional, Dict
from datetime import datetime, date
import uuid
import math

from app.core.supabase import get_supabase
from app.core.security import get_current_user, require_role
from app.models.hub import (
    RouteCreate,
    RouteUpdate,
    RouteAssign,
    RouteResponse,
    RouteDetailResponse,
    RouteStopResponse,
    DeliveryOrderBrief,
    AutoPlanRequest,
    AutoPlanResponse,
    VehicleResponse,
)

router = APIRouter(prefix="/routes", tags=["Routes"])


@router.post("", response_model=RouteResponse, status_code=status.HTTP_201_CREATED)
async def create_route(
    route_data: RouteCreate,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Create a manual route."""
    supabase = get_supabase()

    # Get hub code for route name
    hub = supabase.table("hubs").select("code").eq("id", route_data.hub_id).single().execute()
    hub_code = hub.data["code"] if hub.data else "HUB"

    route_name = route_data.route_name or f"{hub_code}-R{uuid.uuid4().hex[:4].upper()}-{route_data.route_date.strftime('%Y%m%d')}"

    route_dict = {
        "hub_id": route_data.hub_id,
        "route_name": route_name,
        "vehicle_id": route_data.vehicle_id,
        "driver_id": route_data.driver_id,
        "route_date": route_data.route_date.isoformat(),
        "created_by": current_user["id"],
        "total_stops": len(route_data.order_ids),
    }

    result = supabase.table("delivery_routes").insert(route_dict).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create route")

    route_id = result.data[0]["id"]

    # Create route stops
    for seq, order_id in enumerate(route_data.order_ids, 1):
        supabase.table("route_stops").insert({
            "route_id": route_id,
            "order_id": order_id,
            "sequence": seq,
        }).execute()

        # Update order assignment
        supabase.table("delivery_orders").update({
            "route_id": route_id,
            "driver_id": route_data.driver_id,
            "status": "assigned" if route_data.driver_id else "pending",
            "assigned_at": datetime.utcnow().isoformat() if route_data.driver_id else None,
        }).eq("id", order_id).execute()

    return RouteResponse(**result.data[0])


@router.get("", response_model=List[RouteResponse])
async def list_routes(
    hub_id: Optional[str] = None,
    route_date: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """List routes with filters."""
    supabase = get_supabase()

    query = supabase.table("delivery_routes").select("*")

    if hub_id:
        query = query.eq("hub_id", hub_id)
    if route_date:
        query = query.eq("route_date", route_date)
    if status_filter:
        query = query.eq("status", status_filter)

    result = query.order("created_at", desc=True).execute()
    return [RouteResponse(**r) for r in result.data]


@router.get("/{route_id}", response_model=RouteDetailResponse)
async def get_route_detail(
    route_id: str,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager", "driver"]))
):
    """Get route detail with stops."""
    supabase = get_supabase()

    result = supabase.table("delivery_routes").select("*").eq("id", route_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Route not found")

    # Get stops with order details
    stops_result = supabase.table("route_stops").select("*").eq(
        "route_id", route_id
    ).order("sequence").execute()

    stops = []
    for stop in (stops_result.data or []):
        order = supabase.table("delivery_orders").select(
            "id, order_number, customer_name, customer_phone, delivery_address, product_description, status, is_cod, cod_amount"
        ).eq("id", stop["order_id"]).single().execute()

        stop_data = RouteStopResponse(
            **stop,
            order=DeliveryOrderBrief(**order.data) if order.data else None,
        )
        stops.append(stop_data)

    # Get vehicle info
    vehicle = None
    if result.data.get("vehicle_id"):
        v = supabase.table("hub_vehicles").select("*").eq("id", result.data["vehicle_id"]).single().execute()
        if v.data:
            vehicle = VehicleResponse(**v.data)

    # Get driver name
    driver_name = None
    if result.data.get("driver_id"):
        driver = supabase.table("drivers").select("user_id").eq("id", result.data["driver_id"]).single().execute()
        if driver.data:
            user = supabase.table("users").select("first_name, last_name").eq(
                "id", driver.data["user_id"]
            ).single().execute()
            if user.data:
                driver_name = f"{user.data['first_name']} {user.data['last_name']}"

    return RouteDetailResponse(
        **result.data,
        stops=stops,
        vehicle=vehicle,
        driver_name=driver_name,
    )


@router.patch("/{route_id}", response_model=RouteResponse)
async def update_route(
    route_id: str,
    route_data: RouteUpdate,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Update route details."""
    supabase = get_supabase()

    update_data = route_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "route_date" in update_data and update_data["route_date"]:
        update_data["route_date"] = update_data["route_date"].isoformat()

    result = supabase.table("delivery_routes").update(update_data).eq("id", route_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Route not found")

    return RouteResponse(**result.data[0])


@router.delete("/{route_id}")
async def delete_route(
    route_id: str,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Delete a route and unassign orders."""
    supabase = get_supabase()

    # Get orders assigned to this route
    orders = supabase.table("delivery_orders").select("id").eq("route_id", route_id).execute()

    # Unassign orders
    for order in (orders.data or []):
        supabase.table("delivery_orders").update({
            "route_id": None,
            "driver_id": None,
            "status": "pending",
            "assigned_at": None,
        }).eq("id", order["id"]).execute()

    # Delete stops (cascade)
    supabase.table("route_stops").delete().eq("route_id", route_id).execute()

    # Delete route
    supabase.table("delivery_routes").delete().eq("id", route_id).execute()

    return {"message": "Route deleted", "route_id": route_id}


@router.post("/{route_id}/assign", response_model=RouteResponse)
async def assign_route(
    route_id: str,
    assign_data: RouteAssign,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Assign driver and vehicle to a route."""
    supabase = get_supabase()

    result = supabase.table("delivery_routes").update({
        "driver_id": assign_data.driver_id,
        "vehicle_id": assign_data.vehicle_id,
        "status": "assigned",
    }).eq("id", route_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Route not found")

    # Update all orders on this route
    orders = supabase.table("delivery_orders").select("id").eq("route_id", route_id).execute()
    for order in (orders.data or []):
        supabase.table("delivery_orders").update({
            "driver_id": assign_data.driver_id,
            "status": "assigned",
            "assigned_at": datetime.utcnow().isoformat(),
        }).eq("id", order["id"]).execute()

    # Update vehicle status
    supabase.table("hub_vehicles").update({
        "status": "on_route",
        "assigned_driver_id": assign_data.driver_id,
    }).eq("id", assign_data.vehicle_id).execute()

    return RouteResponse(**result.data[0])


@router.post("/{route_id}/dispatch", response_model=RouteResponse)
async def dispatch_route(
    route_id: str,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Mark route as dispatched (in_progress)."""
    supabase = get_supabase()

    route = supabase.table("delivery_routes").select("*").eq("id", route_id).single().execute()
    if not route.data:
        raise HTTPException(status_code=404, detail="Route not found")

    if not route.data.get("driver_id") or not route.data.get("vehicle_id"):
        raise HTTPException(status_code=400, detail="Route must have driver and vehicle assigned before dispatch")

    result = supabase.table("delivery_routes").update({
        "status": "in_progress",
        "start_time": datetime.utcnow().isoformat(),
    }).eq("id", route_id).execute()

    # Update all orders to out_for_delivery
    orders = supabase.table("delivery_orders").select("id").eq("route_id", route_id).execute()
    for order in (orders.data or []):
        supabase.table("delivery_orders").update({
            "status": "out_for_delivery",
            "out_for_delivery_at": datetime.utcnow().isoformat(),
        }).eq("id", order["id"]).execute()

    # Update driver status
    supabase.table("drivers").update({"status": "on_delivery"}).eq("id", route.data["driver_id"]).execute()

    return RouteResponse(**result.data[0])


@router.post("/auto-plan", response_model=AutoPlanResponse)
async def auto_plan_routes(
    plan_data: AutoPlanRequest,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Auto-generate routes grouping orders by area and vehicle capacity."""
    supabase = get_supabase()

    # Get unassigned orders for the date
    orders_query = supabase.table("delivery_orders").select("*").eq(
        "hub_id", plan_data.hub_id
    ).eq("status", "pending").is_("route_id", "null")

    if plan_data.route_date:
        orders_query = orders_query.eq("scheduled_date", plan_data.route_date.isoformat())

    orders_result = orders_query.execute()
    orders = orders_result.data or []

    if not orders:
        return AutoPlanResponse(routes_created=0, total_orders_assigned=0, unassigned_orders=0)

    # Get available vehicles
    if plan_data.vehicle_ids:
        vehicles_result = supabase.table("hub_vehicles").select("*").eq(
            "hub_id", plan_data.hub_id
        ).in_("id", plan_data.vehicle_ids).eq("is_active", True).execute()
    else:
        vehicles_result = supabase.table("hub_vehicles").select("*").eq(
            "hub_id", plan_data.hub_id
        ).eq("status", "available").eq("is_active", True).execute()

    vehicles = vehicles_result.data or []

    if not vehicles:
        raise HTTPException(status_code=400, detail="No available vehicles at this hub")

    # Get hub location for reference
    hub = supabase.table("hubs").select("code, latitude, longitude").eq(
        "id", plan_data.hub_id
    ).single().execute()
    hub_code = hub.data["code"] if hub.data else "HUB"

    # Simple route planning: distribute orders across vehicles by capacity
    routes_created = []
    assigned_count = 0
    remaining_orders = list(orders)

    # Sort orders by postal code for geographic grouping
    remaining_orders.sort(key=lambda o: (o.get("delivery_postal_code") or "", o.get("delivery_city") or ""))

    for vehicle in vehicles:
        if not remaining_orders:
            break

        capacity_kg = vehicle.get("capacity_kg") or 999999
        current_weight = 0.0
        route_orders = []

        # Fill vehicle up to capacity
        still_remaining = []
        for order in remaining_orders:
            order_weight = order.get("total_weight_kg") or 0
            if current_weight + order_weight <= capacity_kg and len(route_orders) < 30:
                route_orders.append(order)
                current_weight += order_weight
            else:
                still_remaining.append(order)

        remaining_orders = still_remaining

        if not route_orders:
            continue

        # Create route
        route_name = f"{hub_code}-R{len(routes_created)+1}-{plan_data.route_date.strftime('%Y%m%d')}"
        route_result = supabase.table("delivery_routes").insert({
            "hub_id": plan_data.hub_id,
            "route_name": route_name,
            "vehicle_id": vehicle["id"],
            "route_date": plan_data.route_date.isoformat(),
            "status": "planned",
            "total_stops": len(route_orders),
            "total_weight_kg": current_weight,
            "created_by": current_user["id"],
        }).execute()

        route_id = route_result.data[0]["id"]

        # Create stops
        for seq, order in enumerate(route_orders, 1):
            supabase.table("route_stops").insert({
                "route_id": route_id,
                "order_id": order["id"],
                "sequence": seq,
            }).execute()

            supabase.table("delivery_orders").update({
                "route_id": route_id,
            }).eq("id", order["id"]).execute()

        assigned_count += len(route_orders)
        routes_created.append(RouteResponse(**route_result.data[0]))

    return AutoPlanResponse(
        routes_created=len(routes_created),
        total_orders_assigned=assigned_count,
        unassigned_orders=len(remaining_orders),
        routes=routes_created,
    )
