"""CJDQuick OMS Integration Service.

Handles communication between LMA and CJDQuick OMS API:
- Push delivery status updates to CJDQuick
- Pull orders from CJDQuick for delivery
- Create returns/RTO in CJDQuick
- Verify webhook signatures
"""

import hashlib
import hmac
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings
from app.core.supabase import get_supabase

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    """Check if CJDQuick integration is configured."""
    return bool(settings.CJDQUICK_API_KEY)


def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.CJDQUICK_API_KEY}",
        "Content-Type": "application/json",
    }


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify HMAC-SHA256 webhook signature from CJDQuick."""
    if not settings.CJDQUICK_WEBHOOK_SECRET:
        logger.warning("CJDQUICK_WEBHOOK_SECRET not set, skipping verification")
        return True

    expected = hmac.new(
        settings.CJDQUICK_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


# =====================================================
# OUTBOUND: LMA → CJDQuick
# =====================================================


async def update_order_status(
    external_order_id: str,
    status: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """Update order status in CJDQuick OMS."""
    if not is_configured() or not external_order_id:
        return False

    url = f"{settings.CJDQUICK_API_URL}/orders/{external_order_id}"
    body: Dict[str, Any] = {"status": status}
    if metadata:
        body["metadata"] = metadata

    try:
        async with httpx.AsyncClient() as client:
            res = await client.patch(url, json=body, headers=_headers(), timeout=10)
            res.raise_for_status()
            _log_sync("outbound", "status_update", external_order_id, status)
            return True
    except Exception as e:
        logger.warning(f"CJDQuick status update failed for {external_order_id}: {e}")
        _log_sync(
            "outbound", "status_update", external_order_id, "failed", str(e)
        )
        return False


async def create_return(
    external_order_id: str,
    reason: str,
    items: List[Dict[str, Any]],
) -> bool:
    """Create an RTO return in CJDQuick when delivery fails and returns to hub."""
    if not is_configured() or not external_order_id:
        return False

    url = f"{settings.CJDQUICK_API_URL}/returns"
    body = {
        "type": "RTO",
        "orderId": external_order_id,
        "reason": reason,
        "items": items,
    }

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=body, headers=_headers(), timeout=10)
            res.raise_for_status()
            _log_sync("outbound", "return_created", external_order_id, "success")
            return True
    except Exception as e:
        logger.warning(f"CJDQuick return creation failed for {external_order_id}: {e}")
        _log_sync(
            "outbound", "return_created", external_order_id, "failed", str(e)
        )
        return False


async def create_shipment(
    external_order_id: str,
    route_name: str,
    driver_name: Optional[str] = None,
) -> bool:
    """Notify CJDQuick that an order has been shipped (route dispatched)."""
    if not is_configured() or not external_order_id:
        return False

    url = f"{settings.CJDQUICK_API_URL}/orders/{external_order_id}"
    body: Dict[str, Any] = {
        "status": "SHIPPED",
        "metadata": {
            "awb_number": route_name,
            "carrier": "LMA Last-Mile",
        },
    }
    if driver_name:
        body["metadata"]["driver_name"] = driver_name

    try:
        async with httpx.AsyncClient() as client:
            res = await client.patch(url, json=body, headers=_headers(), timeout=10)
            res.raise_for_status()
            _log_sync("outbound", "shipment_created", external_order_id, "success")
            return True
    except Exception as e:
        logger.warning(f"CJDQuick shipment update failed for {external_order_id}: {e}")
        _log_sync(
            "outbound", "shipment_created", external_order_id, "failed", str(e)
        )
        return False


# =====================================================
# INBOUND: CJDQuick → LMA
# =====================================================


async def poll_new_orders(
    hub_id: str,
    updated_since: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Poll CJDQuick for new/updated orders to sync into LMA."""
    if not is_configured():
        return []

    url = f"{settings.CJDQUICK_API_URL}/orders"
    params: Dict[str, Any] = {"limit": 100, "status": "CONFIRMED"}
    if updated_since:
        params["updated_since"] = updated_since
    if settings.CJDQUICK_LOCATION_ID:
        params["locationId"] = settings.CJDQUICK_LOCATION_ID

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                url, params=params, headers=_headers(), timeout=15
            )
            res.raise_for_status()
            return res.json()
    except Exception as e:
        logger.warning(f"CJDQuick order polling failed: {e}")
        return []


def map_cjdquick_order_to_lma(
    cjd_order: Dict[str, Any],
    hub_id: str,
) -> Dict[str, Any]:
    """Map a CJDQuick order payload to LMA delivery_orders schema."""
    shipping = cjd_order.get("shippingAddress") or {}
    items = cjd_order.get("items") or []
    amounts = cjd_order.get("amounts") or {}

    product_desc = ", ".join(
        f"{item.get('skuId', 'Item')} x{item.get('quantity', 1)}"
        for item in items
    )
    product_sku = items[0].get("skuId") if items else None
    total_weight = sum(item.get("weight", 0) for item in items) or None

    payment_mode = (cjd_order.get("paymentMode") or "").upper()
    is_cod = payment_mode == "COD"
    cod_amount = amounts.get("totalAmount", 0) if is_cod else 0

    return {
        "hub_id": hub_id,
        "source": "cjdquick",
        "external_order_id": cjd_order.get("id") or cjd_order.get("orderNumber"),
        "external_source": "cjdquick",
        "seller_order_ref": cjd_order.get("orderNumber"),
        "marketplace": cjd_order.get("channel"),
        "customer_name": cjd_order.get("customerName", ""),
        "customer_phone": cjd_order.get("customerPhone", ""),
        "delivery_address": shipping.get("address1", ""),
        "delivery_city": shipping.get("city"),
        "delivery_state": shipping.get("state"),
        "delivery_postal_code": shipping.get("pincode"),
        "product_description": product_desc or "CJDQuick Order",
        "product_sku": product_sku,
        "total_weight_kg": total_weight,
        "is_cod": is_cod,
        "cod_amount": cod_amount,
        "declared_value": amounts.get("totalAmount"),
        "priority": "normal",
    }


# =====================================================
# STATUS MAPPING
# =====================================================

LMA_TO_CJDQUICK_STATUS = {
    "assigned": "PROCESSING",
    "out_for_delivery": "SHIPPED",
    "delivered": "DELIVERED",
    "failed": "CANCELLED",
    "returned_to_hub": "RTO",
    "cancelled": "CANCELLED",
}


def get_cjdquick_status(lma_status: str) -> Optional[str]:
    """Map LMA order status to CJDQuick OMS status."""
    return LMA_TO_CJDQUICK_STATUS.get(lma_status)


# =====================================================
# SYNC LOG HELPER
# =====================================================


def _log_sync(
    direction: str,
    event_type: str,
    external_id: str,
    status: str,
    error_message: Optional[str] = None,
    lma_order_id: Optional[str] = None,
    hub_id: Optional[str] = None,
) -> None:
    """Write a sync log entry to the database."""
    try:
        supabase = get_supabase()
        supabase.table("sync_log").insert(
            {
                "hub_id": hub_id,
                "provider": "cjdquick",
                "direction": direction,
                "event_type": event_type,
                "external_id": external_id,
                "lma_order_id": lma_order_id,
                "status": status,
                "error_message": error_message,
            }
        ).execute()
    except Exception as e:
        logger.debug(f"Failed to write sync log: {e}")
