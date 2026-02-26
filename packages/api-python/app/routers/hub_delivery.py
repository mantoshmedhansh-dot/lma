from fastapi import APIRouter, HTTPException, status, Depends
from typing import Dict, Optional
from datetime import datetime, timedelta
import random
import string

from app.core.supabase import get_supabase
from app.core.security import get_current_user, require_role
from app.models.delivery_order import (
    OtpSendRequest,
    OtpVerifyRequest,
    OtpResponse,
    DeliveryAttemptCreate,
    DeliveryAttemptResponse,
)
from app.models.hub import RouteDetailResponse, RouteStopResponse, DeliveryOrderBrief, VehicleResponse

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

    # TODO: Send SMS via Twilio/MSG91
    # For now, return success (OTP visible in DB for testing)

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
