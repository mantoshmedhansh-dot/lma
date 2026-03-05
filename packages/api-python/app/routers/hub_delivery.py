from fastapi import APIRouter, HTTPException, status, Depends
from typing import Dict, Optional
from datetime import datetime, timedelta
import random
import string

from app.core.supabase import get_supabase
from app.core.security import get_current_user, require_role
from app.core.config import settings
from app.models.delivery_order import (
    OtpSendRequest,
    OtpVerifyRequest,
    OtpResponse,
    DeliveryAttemptCreate,
    DeliveryAttemptResponse,
)
from app.models.reverse_pickup import (
    PickupAttemptCreate,
    PickupAttemptResponse,
    PickupOtpSendRequest,
    PickupOtpVerifyRequest,
    ReversePickupResponse,
)
from app.models.hub import RouteDetailResponse, RouteStopResponse, DeliveryOrderBrief, VehicleResponse
from app.services import cjdquick as cjdquick_svc

router = APIRouter(prefix="/delivery", tags=["Delivery"])


def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


# =====================================================
# OTP
# =====================================================

@router.post("/otp/send", response_model=OtpResponse)
async def send_otp(
    otp_data: OtpSendRequest,
    current_user: Dict = Depends(require_role(["driver", "admin", "super_admin", "hub_manager"]))
):
    """Generate and send OTP to customer for delivery verification."""
    supabase = get_supabase()

    order = supabase.table("delivery_orders").select("customer_phone, customer_name").eq(
        "id", otp_data.order_id
    ).single().execute()

    if not order.data:
        raise HTTPException(status_code=404, detail="Order not found")

    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Invalidate previous OTPs for this order/type
    supabase.table("otp_tokens").update({
        "is_verified": True,
    }).eq("order_id", otp_data.order_id).eq("otp_type", otp_data.otp_type).eq("is_verified", False).execute()

    # Create new OTP
    supabase.table("otp_tokens").insert({
        "order_id": otp_data.order_id,
        "otp_code": otp_code,
        "otp_type": otp_data.otp_type,
        "sent_to": order.data["customer_phone"],
        "expires_at": expires_at.isoformat(),
    }).execute()

    # Send SMS via Twilio (if configured)
    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER:
        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            client.messages.create(
                body=f"Your LMA delivery OTP is: {otp_code}. Valid for 10 minutes.",
                from_=settings.TWILIO_FROM_NUMBER,
                to=order.data["customer_phone"],
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to send SMS: {e}")
    else:
        import logging
        logging.getLogger(__name__).info(f"Twilio not configured. OTP {otp_code} for order {otp_data.order_id} stored in DB.")

    return OtpResponse(
        success=True,
        message=f"OTP sent to {order.data['customer_phone'][-4:].rjust(len(order.data['customer_phone']), '*')}",
        expires_at=expires_at,
    )


@router.post("/otp/verify", response_model=OtpResponse)
async def verify_otp(
    otp_data: OtpVerifyRequest,
    current_user: Dict = Depends(require_role(["driver", "admin", "super_admin", "hub_manager"]))
):
    """Verify OTP entered by driver."""
    supabase = get_supabase()

    result = supabase.table("otp_tokens").select("*").eq(
        "order_id", otp_data.order_id
    ).eq("otp_type", otp_data.otp_type).eq("is_verified", False).order(
        "created_at", desc=True
    ).limit(1).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="No active OTP found")

    token = result.data[0]

    if token["otp_code"] != otp_data.otp_code:
        return OtpResponse(success=False, message="Invalid OTP")

    if datetime.fromisoformat(token["expires_at"].replace("Z", "+00:00")) < datetime.utcnow().replace(tzinfo=None):
        return OtpResponse(success=False, message="OTP has expired")

    # Mark verified
    supabase.table("otp_tokens").update({
        "is_verified": True,
    }).eq("id", token["id"]).execute()

    return OtpResponse(success=True, message="OTP verified successfully")


@router.post("/return-otp/send", response_model=OtpResponse)
async def send_return_otp(
    otp_data: OtpSendRequest,
    current_user: Dict = Depends(require_role(["driver", "admin", "super_admin", "hub_manager"]))
):
    """Generate return OTP for failed delivery (sent to seller/hub)."""
    otp_data.otp_type = "return"
    return await send_otp(otp_data, current_user)


@router.post("/return-otp/verify", response_model=OtpResponse)
async def verify_return_otp(
    otp_data: OtpVerifyRequest,
    current_user: Dict = Depends(require_role(["driver", "admin", "super_admin", "hub_manager"]))
):
    """Verify return OTP for failed delivery."""
    otp_data.otp_type = "return"
    return await verify_otp(otp_data, current_user)


# =====================================================
# DELIVERY ATTEMPTS
# =====================================================

@router.post("/attempt", response_model=DeliveryAttemptResponse)
async def record_attempt(
    attempt_data: DeliveryAttemptCreate,
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Record a delivery attempt (success or failure)."""
    supabase = get_supabase()

    # Get driver id
    driver = supabase.table("drivers").select("id").eq("user_id", current_user["id"]).single().execute()
    if not driver.data:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    driver_id = driver.data["id"]

    # Get attempt number
    prev_attempts = supabase.table("delivery_attempts").select("attempt_number").eq(
        "order_id", attempt_data.order_id
    ).order("attempt_number", desc=True).limit(1).execute()

    attempt_number = 1
    if prev_attempts.data:
        attempt_number = prev_attempts.data[0]["attempt_number"] + 1

    attempt_dict = {
        "order_id": attempt_data.order_id,
        "route_stop_id": attempt_data.route_stop_id,
        "driver_id": driver_id,
        "attempt_number": attempt_number,
        "status": attempt_data.status,
        "failure_reason": attempt_data.failure_reason,
        "failure_notes": attempt_data.failure_notes,
        "photo_urls": attempt_data.photo_urls,
        "signature_url": attempt_data.signature_url,
        "recipient_name": attempt_data.recipient_name,
        "cod_collected": attempt_data.cod_collected,
        "cod_amount": attempt_data.cod_amount,
        "latitude": attempt_data.latitude,
        "longitude": attempt_data.longitude,
    }

    result = supabase.table("delivery_attempts").insert(attempt_dict).execute()

    # Update order status
    now = datetime.utcnow().isoformat()
    if attempt_data.status == "delivered":
        supabase.table("delivery_orders").update({
            "status": "delivered",
            "delivered_at": now,
        }).eq("id", attempt_data.order_id).execute()
    elif attempt_data.status == "failed":
        supabase.table("delivery_orders").update({
            "status": "failed",
            "failed_at": now,
        }).eq("id", attempt_data.order_id).execute()

    # Update route stop status
    if attempt_data.route_stop_id:
        supabase.table("route_stops").update({
            "status": attempt_data.status,
            "actual_departure": now,
        }).eq("id", attempt_data.route_stop_id).execute()

    # Sync status to CJDQuick OMS
    try:
        order_row = supabase.table("delivery_orders").select(
            "external_order_id, external_source"
        ).eq("id", attempt_data.order_id).single().execute()
        if order_row.data and order_row.data.get("external_source") == "cjdquick":
            ext_id = order_row.data["external_order_id"]
            cjd_status = cjdquick_svc.get_cjdquick_status(attempt_data.status)
            if cjd_status:
                await cjdquick_svc.update_order_status(ext_id, cjd_status)
    except Exception:
        pass  # Don't fail delivery recording if sync fails

    return DeliveryAttemptResponse(**result.data[0])


@router.post("/return-to-hub")
async def return_to_hub(
    order_id: str,
    current_user: Dict = Depends(require_role(["driver", "admin", "super_admin", "hub_manager"]))
):
    """Mark failed order as returned to hub."""
    supabase = get_supabase()

    result = supabase.table("delivery_orders").update({
        "status": "returned_to_hub",
        "returned_at": datetime.utcnow().isoformat(),
    }).eq("id", order_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    # Create RTO return in CJDQuick
    try:
        order_data = result.data[0]
        if order_data.get("external_source") == "cjdquick" and order_data.get("external_order_id"):
            await cjdquick_svc.create_return(
                external_order_id=order_data["external_order_id"],
                reason="Delivery failed - returned to hub",
                items=[{"skuId": order_data.get("product_sku", ""), "quantity": 1}],
            )
    except Exception:
        pass  # Don't fail return if sync fails

    return {"message": "Order marked as returned to hub", "order_id": order_id}


# =====================================================
# DRIVER ROUTE VIEW
# =====================================================

@router.get("/my-route")
async def get_my_route(
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Get driver's current route with all stops."""
    supabase = get_supabase()

    driver = supabase.table("drivers").select("id").eq("user_id", current_user["id"]).single().execute()
    if not driver.data:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    driver_id = driver.data["id"]
    today = datetime.utcnow().date().isoformat()

    # Get today's route
    route = supabase.table("delivery_routes").select("*").eq(
        "driver_id", driver_id
    ).eq("route_date", today).in_(
        "status", ["assigned", "in_progress"]
    ).order("created_at", desc=True).limit(1).execute()

    if not route.data:
        return {"route": None, "message": "No route assigned for today"}

    route_data = route.data[0]

    # Get stops
    stops_result = supabase.table("route_stops").select("*").eq(
        "route_id", route_data["id"]
    ).order("sequence").execute()

    stops = []
    for stop in (stops_result.data or []):
        order = supabase.table("delivery_orders").select(
            "id, order_number, customer_name, customer_phone, delivery_address, product_description, status, is_cod, cod_amount"
        ).eq("id", stop["order_id"]).single().execute()

        stops.append({
            **stop,
            "order": order.data if order.data else None,
        })

    # Get vehicle
    vehicle = None
    if route_data.get("vehicle_id"):
        v = supabase.table("hub_vehicles").select("*").eq("id", route_data["vehicle_id"]).single().execute()
        vehicle = v.data

    return {
        "route": {**route_data, "stops": stops, "vehicle": vehicle},
    }


@router.post("/stop/{stop_id}/arrive")
async def arrive_at_stop(
    stop_id: str,
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Mark arrival at a stop."""
    supabase = get_supabase()

    result = supabase.table("route_stops").update({
        "status": "arrived",
        "actual_arrival": datetime.utcnow().isoformat(),
    }).eq("id", stop_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Stop not found")

    return {"message": "Arrived at stop", "stop_id": stop_id}


@router.post("/stop/{stop_id}/complete")
async def complete_stop(
    stop_id: str,
    status_value: str = "delivered",
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Complete a stop (delivered or failed)."""
    supabase = get_supabase()

    result = supabase.table("route_stops").update({
        "status": status_value,
        "actual_departure": datetime.utcnow().isoformat(),
    }).eq("id", stop_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Stop not found")

    return {"message": f"Stop marked as {status_value}", "stop_id": stop_id}


# =====================================================
# DRIVER PICKUP ENDPOINTS
# =====================================================


@router.get("/my-pickups", response_model=list[ReversePickupResponse])
async def get_my_pickups(
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Get driver's assigned pickups for today."""
    supabase = get_supabase()

    driver = supabase.table("drivers").select("id").eq("user_id", current_user["id"]).single().execute()
    if not driver.data:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    driver_id = driver.data["id"]
    today = datetime.utcnow().date().isoformat()

    result = supabase.table("reverse_pickups").select("*").eq(
        "driver_id", driver_id
    ).in_(
        "status", ["assigned", "out_for_pickup"]
    ).execute()

    return [ReversePickupResponse(**p) for p in (result.data or [])]


@router.post("/pickup/{pickup_id}/arrive")
async def arrive_at_pickup(
    pickup_id: str,
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Mark arrival at pickup location."""
    supabase = get_supabase()

    now = datetime.utcnow().isoformat()
    result = supabase.table("reverse_pickups").update({
        "status": "out_for_pickup",
        "out_for_pickup_at": now,
        "updated_at": now,
    }).eq("id", pickup_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Pickup not found")

    return {"message": "Arrived at pickup location", "pickup_id": pickup_id}


@router.post("/pickup/otp/send", response_model=OtpResponse)
async def send_pickup_otp(
    otp_data: PickupOtpSendRequest,
    current_user: Dict = Depends(require_role(["driver", "admin", "super_admin", "hub_manager"]))
):
    """Send OTP to customer for pickup verification."""
    supabase = get_supabase()

    pickup = supabase.table("reverse_pickups").select("customer_phone, customer_name").eq(
        "id", otp_data.pickup_id
    ).single().execute()

    if not pickup.data:
        raise HTTPException(status_code=404, detail="Pickup not found")

    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Invalidate previous OTPs for this pickup
    supabase.table("otp_tokens").update({
        "is_verified": True,
    }).eq("order_id", otp_data.pickup_id).eq("otp_type", "pickup").eq("is_verified", False).execute()

    # Create new OTP (reuse order_id column for pickup_id)
    supabase.table("otp_tokens").insert({
        "order_id": otp_data.pickup_id,
        "otp_code": otp_code,
        "otp_type": "pickup",
        "sent_to": pickup.data["customer_phone"],
        "expires_at": expires_at.isoformat(),
    }).execute()

    # Send SMS via Twilio (if configured)
    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER:
        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            client.messages.create(
                body=f"Your LMA pickup verification OTP is: {otp_code}. Valid for 10 minutes.",
                from_=settings.TWILIO_FROM_NUMBER,
                to=pickup.data["customer_phone"],
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to send SMS: {e}")
    else:
        import logging
        logging.getLogger(__name__).info(f"Twilio not configured. OTP {otp_code} for pickup {otp_data.pickup_id} stored in DB.")

    return OtpResponse(
        success=True,
        message=f"OTP sent to {pickup.data['customer_phone'][-4:].rjust(len(pickup.data['customer_phone']), '*')}",
        expires_at=expires_at,
    )


@router.post("/pickup/otp/verify", response_model=OtpResponse)
async def verify_pickup_otp(
    otp_data: PickupOtpVerifyRequest,
    current_user: Dict = Depends(require_role(["driver", "admin", "super_admin", "hub_manager"]))
):
    """Verify OTP for pickup."""
    supabase = get_supabase()

    result = supabase.table("otp_tokens").select("*").eq(
        "order_id", otp_data.pickup_id
    ).eq("otp_type", "pickup").eq("is_verified", False).order(
        "created_at", desc=True
    ).limit(1).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="No active OTP found")

    token = result.data[0]

    if token["otp_code"] != otp_data.otp_code:
        return OtpResponse(success=False, message="Invalid OTP")

    if datetime.fromisoformat(token["expires_at"].replace("Z", "+00:00")) < datetime.utcnow().replace(tzinfo=None):
        return OtpResponse(success=False, message="OTP has expired")

    # Mark verified
    supabase.table("otp_tokens").update({
        "is_verified": True,
    }).eq("id", token["id"]).execute()

    return OtpResponse(success=True, message="OTP verified successfully")


@router.post("/pickup/attempt", response_model=PickupAttemptResponse)
async def record_pickup_attempt(
    attempt_data: PickupAttemptCreate,
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Record a pickup attempt (success or failure) with item condition."""
    supabase = get_supabase()

    # Get driver id
    driver = supabase.table("drivers").select("id").eq("user_id", current_user["id"]).single().execute()
    if not driver.data:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    driver_id = driver.data["id"]

    # Validate condition photos for successful pickups
    if attempt_data.status == "picked_up":
        if not attempt_data.condition_photo_urls or len(attempt_data.condition_photo_urls) < 2:
            raise HTTPException(
                status_code=400,
                detail="At least 2 item condition photos are required for successful pickups"
            )
        if not attempt_data.item_condition:
            raise HTTPException(
                status_code=400,
                detail="Item condition is required for successful pickups"
            )

    # Get attempt number
    prev_attempts = supabase.table("pickup_attempts").select("attempt_number").eq(
        "pickup_id", attempt_data.pickup_id
    ).order("attempt_number", desc=True).limit(1).execute()

    attempt_number = 1
    if prev_attempts.data:
        attempt_number = prev_attempts.data[0]["attempt_number"] + 1

    attempt_dict = {
        "pickup_id": attempt_data.pickup_id,
        "driver_id": driver_id,
        "attempt_number": attempt_number,
        "status": attempt_data.status,
        "otp_verified": attempt_data.otp_verified,
        "otp_verified_at": datetime.utcnow().isoformat() if attempt_data.otp_verified else None,
        "failure_reason": attempt_data.failure_reason,
        "failure_notes": attempt_data.failure_notes,
        "item_condition": attempt_data.item_condition,
        "item_condition_notes": attempt_data.item_condition_notes,
        "condition_photo_urls": attempt_data.condition_photo_urls,
        "photo_urls": attempt_data.photo_urls,
        "signature_url": attempt_data.signature_url,
        "recipient_name": attempt_data.recipient_name,
        "latitude": attempt_data.latitude,
        "longitude": attempt_data.longitude,
    }

    result = supabase.table("pickup_attempts").insert(attempt_dict).execute()

    # Update pickup status
    now = datetime.utcnow().isoformat()
    if attempt_data.status == "picked_up":
        supabase.table("reverse_pickups").update({
            "status": "picked_up",
            "picked_up_at": now,
            "updated_at": now,
        }).eq("id", attempt_data.pickup_id).execute()

        # Notify CJDQuick if applicable
        try:
            pickup_row = supabase.table("reverse_pickups").select(
                "external_order_id, external_source, external_return_id"
            ).eq("id", attempt_data.pickup_id).single().execute()
            if pickup_row.data and pickup_row.data.get("external_source") == "cjdquick":
                ext_id = pickup_row.data["external_order_id"]
                return_id = pickup_row.data.get("external_return_id")
                await cjdquick_svc.notify_pickup_completed(ext_id, return_id)
        except Exception:
            pass  # Don't fail pickup recording if sync fails

    elif attempt_data.status == "failed":
        supabase.table("reverse_pickups").update({
            "updated_at": now,
        }).eq("id", attempt_data.pickup_id).execute()

    return PickupAttemptResponse(**result.data[0])


# =====================================================
# DRIVER DOCUMENTS
# =====================================================

@router.get("/my-documents")
async def get_my_documents(
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Get driver's uploaded documents."""
    supabase = get_supabase()
    driver = supabase.table("drivers").select("id, documents").eq(
        "user_id", current_user["id"]
    ).single().execute()

    if not driver.data:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    return {"documents": driver.data.get("documents") or {}}


@router.post("/documents")
async def upload_document(
    doc_data: dict,
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Save document metadata after upload to storage."""
    supabase = get_supabase()
    driver = supabase.table("drivers").select("id, documents").eq(
        "user_id", current_user["id"]
    ).single().execute()

    if not driver.data:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    documents = driver.data.get("documents") or {}
    documents[doc_data["doc_type"]] = {
        "url": doc_data["url"],
        "status": "uploaded",
        "uploaded_at": datetime.utcnow().isoformat(),
    }

    supabase.table("drivers").update({
        "documents": documents,
    }).eq("id", driver.data["id"]).execute()

    return {"message": "Document saved", "doc_type": doc_data["doc_type"]}


# =====================================================
# DRIVER PAYMENT INFO
# =====================================================

@router.get("/payment-info")
async def get_payment_info(
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Get driver's payment information."""
    supabase = get_supabase()
    driver = supabase.table("drivers").select("id, payment_info").eq(
        "user_id", current_user["id"]
    ).single().execute()

    if not driver.data:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    return {"payment_info": driver.data.get("payment_info")}


@router.put("/payment-info")
async def update_payment_info(
    payment_data: dict,
    current_user: Dict = Depends(require_role(["driver"]))
):
    """Update driver's payment information."""
    supabase = get_supabase()
    driver = supabase.table("drivers").select("id").eq(
        "user_id", current_user["id"]
    ).single().execute()

    if not driver.data:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    supabase.table("drivers").update({
        "payment_info": {
            "bank_name": payment_data.get("bank_name", ""),
            "account_number": payment_data.get("account_number", ""),
            "ifsc_code": payment_data.get("ifsc_code", ""),
            "account_holder_name": payment_data.get("account_holder_name", ""),
            "upi_id": payment_data.get("upi_id"),
        },
    }).eq("id", driver.data["id"]).execute()

    return {"message": "Payment info updated"}
