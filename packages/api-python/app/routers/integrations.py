"""CJDQuick OMS Integration Router.

Endpoints:
  POST /integrations/cjdquick/webhook   — Receive webhook events from CJDQuick
  POST /integrations/cjdquick/sync      — Manual poll-sync of orders
  GET  /integrations/cjdquick/status    — Sync health & stats
  GET  /integrations/cjdquick/config    — Get integration config for a hub
  PUT  /integrations/cjdquick/config    — Save integration config for a hub
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException, Request, Depends, Query, status
from pydantic import BaseModel

from app.core.supabase import get_supabase
from app.core.security import require_role
from app.services import cjdquick

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["Integrations"])


# =====================================================
# MODELS
# =====================================================


class IntegrationConfigUpdate(BaseModel):
    api_key: Optional[str] = None
    webhook_secret: Optional[str] = None
    location_id: Optional[str] = None
    is_active: Optional[bool] = None


# =====================================================
# WEBHOOK RECEIVER
# =====================================================


@router.post("/cjdquick/webhook")
async def cjdquick_webhook(request: Request):
    """Receive webhook events from CJDQuick OMS.

    No auth — CJDQuick calls this directly. Verified via HMAC signature.
    """
    payload = await request.body()
    signature = request.headers.get("x-webhook-signature", "")

    if not cjdquick.verify_webhook_signature(payload, signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    body = await request.json()
    event_type = body.get("event", "")
    data = body.get("data", {})

    logger.info(f"CJDQuick webhook: {event_type}")

    if event_type in ("order.created", "order.confirmed"):
        return await _handle_order_created(data)
    elif event_type == "order.cancelled":
        return await _handle_order_cancelled(data)
    elif event_type == "return.approved":
        return await _handle_return_approved(data)

    return {"status": "ignored", "event": event_type}


async def _handle_order_created(data: dict) -> dict:
    """Create a delivery order in LMA from a CJDQuick order."""
    supabase = get_supabase()
    external_id = data.get("id") or data.get("orderNumber")

    if not external_id:
        return {"status": "skipped", "reason": "no order id"}

    # Check for duplicate
    existing = (
        supabase.table("delivery_orders")
        .select("id")
        .eq("external_order_id", external_id)
        .eq("external_source", "cjdquick")
        .execute()
    )
    if existing.data:
        return {"status": "duplicate", "lma_order_id": existing.data[0]["id"]}

    # Find hub — use location mapping from integration_configs, or first active hub
    hub_id = await _resolve_hub_id(data.get("locationId"))
    if not hub_id:
        logger.warning("No hub found for CJDQuick order")
        return {"status": "error", "reason": "no hub mapped"}

    order_dict = cjdquick.map_cjdquick_order_to_lma(data, hub_id)
    order_dict["order_number"] = f"CJD-{uuid.uuid4().hex[:8].upper()}"

    result = supabase.table("delivery_orders").insert(order_dict).execute()

    if result.data:
        cjdquick._log_sync(
            "inbound",
            "order_created",
            external_id,
            "success",
            lma_order_id=result.data[0]["id"],
            hub_id=hub_id,
        )
        return {"status": "created", "lma_order_id": result.data[0]["id"]}

    return {"status": "error", "reason": "insert failed"}


async def _handle_order_cancelled(data: dict) -> dict:
    """Cancel a delivery order when CJDQuick cancels it."""
    supabase = get_supabase()
    external_id = data.get("id") or data.get("orderNumber")
    if not external_id:
        return {"status": "skipped"}

    result = (
        supabase.table("delivery_orders")
        .update({"status": "cancelled"})
        .eq("external_order_id", external_id)
        .eq("external_source", "cjdquick")
        .in_("status", ["pending", "assigned"])
        .execute()
    )

    cancelled = len(result.data) if result.data else 0
    return {"status": "ok", "cancelled": cancelled}


async def _handle_return_approved(data: dict) -> dict:
    """Auto-create a reverse pickup when CJDQuick approves a return."""
    supabase = get_supabase()
    order_id = data.get("orderId")
    return_id = data.get("returnId") or data.get("id")
    if not order_id:
        return {"status": "skipped"}

    # Find the original delivery order
    original = (
        supabase.table("delivery_orders")
        .select("*")
        .eq("external_order_id", order_id)
        .eq("external_source", "cjdquick")
        .limit(1)
        .execute()
    )

    if not original.data:
        cjdquick._log_sync("inbound", "return_approved", order_id, "failed", "Original order not found")
        return {"status": "error", "reason": "original order not found"}

    order = original.data[0]

    # Check for duplicate reverse pickup
    existing = (
        supabase.table("reverse_pickups")
        .select("id")
        .eq("external_order_id", order_id)
        .eq("external_source", "cjdquick")
        .execute()
    )
    if existing.data:
        return {"status": "duplicate", "pickup_id": existing.data[0]["id"]}

    # Create reverse pickup from original order data
    pickup_dict = {
        "hub_id": order["hub_id"],
        "pickup_number": f"RP-{uuid.uuid4().hex[:8].upper()}",
        "original_order_id": order["id"],
        "source": "cjdquick",
        "external_order_id": order_id,
        "external_source": "cjdquick",
        "external_return_id": return_id,
        "return_reason": data.get("reason", "Customer return"),
        "return_notes": data.get("notes"),
        "customer_name": order.get("customer_name", ""),
        "customer_phone": order.get("customer_phone", ""),
        "customer_email": order.get("customer_email"),
        "pickup_address": order.get("delivery_address", ""),
        "pickup_city": order.get("delivery_city"),
        "pickup_state": order.get("delivery_state"),
        "pickup_postal_code": order.get("delivery_postal_code"),
        "pickup_latitude": order.get("delivery_latitude"),
        "pickup_longitude": order.get("delivery_longitude"),
        "product_description": order.get("product_description", "Return Item"),
        "product_sku": order.get("product_sku"),
        "package_count": order.get("package_count", 1),
        "total_weight_kg": order.get("total_weight_kg"),
    }

    result = supabase.table("reverse_pickups").insert(pickup_dict).execute()

    if result.data:
        cjdquick._log_sync(
            "inbound",
            "return_approved",
            order_id,
            "success",
            lma_order_id=result.data[0]["id"],
            hub_id=order["hub_id"],
        )
        return {"status": "pickup_created", "pickup_id": result.data[0]["id"]}

    return {"status": "error", "reason": "insert failed"}


async def _resolve_hub_id(location_id: Optional[str]) -> Optional[str]:
    """Resolve a CJDQuick locationId to an LMA hub_id."""
    supabase = get_supabase()

    if location_id:
        config = (
            supabase.table("integration_configs")
            .select("hub_id")
            .eq("provider", "cjdquick")
            .eq("location_id", location_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if config.data:
            return config.data[0]["hub_id"]

    # Fallback: first active hub with CJDQuick integration
    config = (
        supabase.table("integration_configs")
        .select("hub_id")
        .eq("provider", "cjdquick")
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if config.data:
        return config.data[0]["hub_id"]

    # Last resort: first hub
    hub = supabase.table("hubs").select("id").eq("is_active", True).limit(1).execute()
    return hub.data[0]["id"] if hub.data else None


# =====================================================
# MANUAL SYNC
# =====================================================


@router.post("/cjdquick/sync")
async def manual_sync(
    hub_id: str,
    current_user: Dict = Depends(
        require_role(["admin", "super_admin", "hub_manager"])
    ),
):
    """Poll CJDQuick for new orders and sync them into LMA."""
    supabase = get_supabase()

    # Get last sync time
    config = (
        supabase.table("integration_configs")
        .select("*")
        .eq("hub_id", hub_id)
        .eq("provider", "cjdquick")
        .single()
        .execute()
    )

    updated_since = None
    if config.data and config.data.get("last_synced_at"):
        updated_since = config.data["last_synced_at"]

    orders = await cjdquick.poll_new_orders(hub_id, updated_since)

    created = 0
    skipped = 0

    for cjd_order in orders:
        external_id = cjd_order.get("id") or cjd_order.get("orderNumber")
        if not external_id:
            skipped += 1
            continue

        # Duplicate check
        existing = (
            supabase.table("delivery_orders")
            .select("id")
            .eq("external_order_id", external_id)
            .eq("external_source", "cjdquick")
            .execute()
        )
        if existing.data:
            skipped += 1
            continue

        order_dict = cjdquick.map_cjdquick_order_to_lma(cjd_order, hub_id)
        order_dict["order_number"] = f"CJD-{uuid.uuid4().hex[:8].upper()}"

        result = supabase.table("delivery_orders").insert(order_dict).execute()
        if result.data:
            created += 1
            cjdquick._log_sync(
                "inbound",
                "poll_sync",
                external_id,
                "success",
                lma_order_id=result.data[0]["id"],
                hub_id=hub_id,
            )

    # Update last sync time
    now = datetime.utcnow().isoformat()
    if config.data:
        supabase.table("integration_configs").update(
            {"last_synced_at": now}
        ).eq("id", config.data["id"]).execute()

    return {
        "synced": created,
        "skipped": skipped,
        "total_fetched": len(orders),
        "synced_at": now,
    }


# =====================================================
# STATUS & CONFIG
# =====================================================


@router.get("/cjdquick/status")
async def get_sync_status(
    hub_id: str,
    current_user: Dict = Depends(
        require_role(["admin", "super_admin", "hub_manager"])
    ),
):
    """Get CJDQuick integration health and sync stats."""
    supabase = get_supabase()

    # Config
    config = (
        supabase.table("integration_configs")
        .select("*")
        .eq("hub_id", hub_id)
        .eq("provider", "cjdquick")
        .execute()
    )
    config_data = config.data[0] if config.data else None

    # Recent sync logs
    logs = (
        supabase.table("sync_log")
        .select("*")
        .eq("hub_id", hub_id)
        .eq("provider", "cjdquick")
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    # Counts
    total_synced = (
        supabase.table("delivery_orders")
        .select("id", count="exact")
        .eq("hub_id", hub_id)
        .eq("external_source", "cjdquick")
        .execute()
    )

    return {
        "configured": cjdquick.is_configured(),
        "is_active": config_data["is_active"] if config_data else False,
        "last_synced_at": config_data["last_synced_at"] if config_data else None,
        "total_synced_orders": total_synced.count if total_synced.count else 0,
        "recent_logs": logs.data or [],
    }


@router.get("/cjdquick/config")
async def get_integration_config(
    hub_id: str,
    current_user: Dict = Depends(
        require_role(["admin", "super_admin", "hub_manager"])
    ),
):
    """Get CJDQuick integration config for a hub."""
    supabase = get_supabase()

    result = (
        supabase.table("integration_configs")
        .select("*")
        .eq("hub_id", hub_id)
        .eq("provider", "cjdquick")
        .execute()
    )

    if not result.data:
        return {
            "hub_id": hub_id,
            "provider": "cjdquick",
            "is_active": False,
            "location_id": None,
            "last_synced_at": None,
        }

    config = result.data[0]
    # Don't expose full API key
    if config.get("api_key_encrypted"):
        config["api_key_encrypted"] = "****" + config["api_key_encrypted"][-4:]

    return config


@router.put("/cjdquick/config")
async def save_integration_config(
    hub_id: str,
    config_data: IntegrationConfigUpdate,
    current_user: Dict = Depends(
        require_role(["admin", "super_admin", "hub_manager"])
    ),
):
    """Create or update CJDQuick integration config for a hub."""
    supabase = get_supabase()

    existing = (
        supabase.table("integration_configs")
        .select("id")
        .eq("hub_id", hub_id)
        .eq("provider", "cjdquick")
        .execute()
    )

    update_dict = {}
    if config_data.api_key is not None:
        update_dict["api_key_encrypted"] = config_data.api_key
    if config_data.webhook_secret is not None:
        update_dict["webhook_secret"] = config_data.webhook_secret
    if config_data.location_id is not None:
        update_dict["location_id"] = config_data.location_id
    if config_data.is_active is not None:
        update_dict["is_active"] = config_data.is_active
    update_dict["updated_at"] = datetime.utcnow().isoformat()

    if existing.data:
        result = (
            supabase.table("integration_configs")
            .update(update_dict)
            .eq("id", existing.data[0]["id"])
            .execute()
        )
    else:
        update_dict.update(
            {
                "hub_id": hub_id,
                "provider": "cjdquick",
            }
        )
        result = (
            supabase.table("integration_configs").insert(update_dict).execute()
        )

    return {"message": "Config saved", "config": result.data[0] if result.data else {}}
