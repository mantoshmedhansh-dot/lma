from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Optional, List
from datetime import datetime, date, timedelta

from app.core.supabase import get_supabase
from app.core.security import require_role

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/hub/{hub_id}/dashboard")
async def hub_dashboard(
    hub_id: str,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Today's KPIs for a hub."""
    supabase = get_supabase()
    today = date.today().isoformat()

    # Orders
    orders = supabase.table("delivery_orders").select("status, is_cod, cod_amount, created_at").eq(
        "hub_id", hub_id
    ).gte("created_at", today + "T00:00:00").execute()

    all_orders = orders.data or []
    total = len(all_orders)
    delivered = sum(1 for o in all_orders if o["status"] == "delivered")
    failed = sum(1 for o in all_orders if o["status"] == "failed")
    pending = sum(1 for o in all_orders if o["status"] == "pending")
    out_for_delivery = sum(1 for o in all_orders if o["status"] == "out_for_delivery")
    assigned = sum(1 for o in all_orders if o["status"] == "assigned")
    returned = sum(1 for o in all_orders if o["status"] == "returned_to_hub")

    success_rate = (delivered / (delivered + failed) * 100) if (delivered + failed) > 0 else 0
    cod_collected = sum(
        float(o.get("cod_amount") or 0)
        for o in all_orders
        if o["status"] == "delivered" and o.get("is_cod")
    )

    # Routes
    routes = supabase.table("delivery_routes").select("status").eq(
        "hub_id", hub_id
    ).eq("route_date", today).execute()
    total_routes = len(routes.data or [])
    active_routes = sum(1 for r in (routes.data or []) if r["status"] == "in_progress")
    completed_routes = sum(1 for r in (routes.data or []) if r["status"] == "completed")

    # Drivers
    drivers = supabase.table("drivers").select("status").eq("hub_id", hub_id).eq("is_active", True).execute()
    total_drivers = len(drivers.data or [])
    online_drivers = sum(1 for d in (drivers.data or []) if d["status"] in ("online", "on_delivery"))

    return {
        "date": today,
        "orders": {
            "total": total,
            "pending": pending,
            "assigned": assigned,
            "out_for_delivery": out_for_delivery,
            "delivered": delivered,
            "failed": failed,
            "returned_to_hub": returned,
            "success_rate": round(success_rate, 1),
            "cod_collected": cod_collected,
        },
        "routes": {
            "total": total_routes,
            "active": active_routes,
            "completed": completed_routes,
        },
        "drivers": {
            "total": total_drivers,
            "online": online_drivers,
        },
    }


@router.get("/hub/{hub_id}/daily")
async def hub_daily_report(
    hub_id: str,
    start_date: str = Query(...),
    end_date: str = Query(...),
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Daily report for a date range."""
    supabase = get_supabase()

    orders = supabase.table("delivery_orders").select(
        "status, is_cod, cod_amount, created_at, delivered_at"
    ).eq("hub_id", hub_id).gte(
        "created_at", start_date + "T00:00:00"
    ).lte("created_at", end_date + "T23:59:59").execute()

    # Group by date
    daily = {}
    for o in (orders.data or []):
        d = o["created_at"][:10]
        if d not in daily:
            daily[d] = {"date": d, "total": 0, "delivered": 0, "failed": 0, "cod_collected": 0}
        daily[d]["total"] += 1
        if o["status"] == "delivered":
            daily[d]["delivered"] += 1
            if o.get("is_cod"):
                daily[d]["cod_collected"] += float(o.get("cod_amount") or 0)
        elif o["status"] == "failed":
            daily[d]["failed"] += 1

    # Calculate success rates
    for d in daily.values():
        attempted = d["delivered"] + d["failed"]
        d["success_rate"] = round((d["delivered"] / attempted * 100) if attempted > 0 else 0, 1)

    return sorted(daily.values(), key=lambda x: x["date"])


@router.get("/overview")
async def overview(
    current_user: Dict = Depends(require_role(["admin", "super_admin"]))
):
    """All-hubs overview for admin."""
    supabase = get_supabase()
    today = date.today().isoformat()

    hubs = supabase.table("hubs").select("id, name, code").eq("is_active", True).execute()

    hub_stats = []
    for hub in (hubs.data or []):
        orders = supabase.table("delivery_orders").select("status").eq(
            "hub_id", hub["id"]
        ).gte("created_at", today + "T00:00:00").execute()

        total = len(orders.data or [])
        delivered = sum(1 for o in (orders.data or []) if o["status"] == "delivered")
        failed = sum(1 for o in (orders.data or []) if o["status"] == "failed")
        success_rate = (delivered / (delivered + failed) * 100) if (delivered + failed) > 0 else 0

        drivers = supabase.table("drivers").select("status").eq(
            "hub_id", hub["id"]
        ).eq("is_active", True).execute()
        online = sum(1 for d in (drivers.data or []) if d["status"] in ("online", "on_delivery"))

        hub_stats.append({
            "hub_id": hub["id"],
            "hub_name": hub["name"],
            "hub_code": hub["code"],
            "total_orders": total,
            "delivered": delivered,
            "failed": failed,
            "success_rate": round(success_rate, 1),
            "drivers_online": online,
        })

    return {
        "date": today,
        "total_hubs": len(hub_stats),
        "hubs": hub_stats,
        "total_orders": sum(h["total_orders"] for h in hub_stats),
        "total_delivered": sum(h["delivered"] for h in hub_stats),
        "total_failed": sum(h["failed"] for h in hub_stats),
    }
