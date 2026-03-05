from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


# =====================================================
# REVERSE PICKUP MODELS
# =====================================================

class PickupStatus(str, Enum):
    PICKUP_PENDING = "pickup_pending"
    ASSIGNED = "assigned"
    OUT_FOR_PICKUP = "out_for_pickup"
    PICKED_UP = "picked_up"
    RECEIVED_AT_HUB = "received_at_hub"
    CANCELLED = "cancelled"


class PickupSource(str, Enum):
    MANUAL = "manual"
    CJDQUICK = "cjdquick"
    API = "api"


class ItemCondition(str, Enum):
    GOOD = "good"
    DAMAGED = "damaged"
    OPENED = "opened"
    MISSING_PARTS = "missing_parts"


class PickupFailureReason(str, Enum):
    CUSTOMER_UNAVAILABLE = "customer_unavailable"
    REFUSED = "refused"
    WRONG_ADDRESS = "wrong_address"
    ITEM_NOT_READY = "item_not_ready"
    ACCESS_ISSUE = "access_issue"
    OTHER = "other"


class ReversePickupCreate(BaseModel):
    hub_id: str
    source: str = "manual"

    # Link to original order
    original_order_id: Optional[str] = None

    # External integration
    external_order_id: Optional[str] = None
    external_source: Optional[str] = None
    external_return_id: Optional[str] = None

    # Return reason
    return_reason: Optional[str] = None
    return_notes: Optional[str] = None

    # Customer info
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None

    # Pickup address
    pickup_address: str
    pickup_city: Optional[str] = None
    pickup_state: Optional[str] = None
    pickup_postal_code: Optional[str] = None
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None

    # Product info
    product_description: str
    product_sku: Optional[str] = None
    package_count: int = 1
    total_weight_kg: Optional[float] = None

    # Scheduling
    scheduled_date: Optional[date] = None
    pickup_slot: Optional[str] = None


class ReversePickupUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    pickup_address: Optional[str] = None
    pickup_city: Optional[str] = None
    pickup_state: Optional[str] = None
    pickup_postal_code: Optional[str] = None
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None
    product_description: Optional[str] = None
    product_sku: Optional[str] = None
    package_count: Optional[int] = None
    total_weight_kg: Optional[float] = None
    return_reason: Optional[str] = None
    return_notes: Optional[str] = None
    scheduled_date: Optional[date] = None
    pickup_slot: Optional[str] = None
    status: Optional[str] = None


class ReversePickupResponse(BaseModel):
    id: str
    hub_id: str
    pickup_number: str
    original_order_id: Optional[str] = None
    source: str
    external_order_id: Optional[str] = None
    external_source: Optional[str] = None
    external_return_id: Optional[str] = None
    return_reason: Optional[str] = None
    return_notes: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    pickup_address: str
    pickup_city: Optional[str] = None
    pickup_state: Optional[str] = None
    pickup_postal_code: Optional[str] = None
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None
    product_description: str
    product_sku: Optional[str] = None
    package_count: int = 1
    total_weight_kg: Optional[float] = None
    status: str = "pickup_pending"
    route_id: Optional[str] = None
    driver_id: Optional[str] = None
    scheduled_date: Optional[date] = None
    pickup_slot: Optional[str] = None
    created_at: datetime
    assigned_at: Optional[datetime] = None
    out_for_pickup_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    received_at_hub_at: Optional[datetime] = None
    updated_at: datetime

    class Config:
        from_attributes = True


# =====================================================
# PICKUP ATTEMPT MODELS
# =====================================================

class PickupAttemptCreate(BaseModel):
    pickup_id: str
    status: str  # 'picked_up' or 'failed'

    # OTP
    otp_verified: bool = False

    # Failure info
    failure_reason: Optional[str] = None
    failure_notes: Optional[str] = None

    # Item condition
    item_condition: Optional[str] = None
    item_condition_notes: Optional[str] = None
    condition_photo_urls: Optional[List[str]] = None

    # Proof
    photo_urls: Optional[List[str]] = None
    signature_url: Optional[str] = None
    recipient_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class PickupAttemptResponse(BaseModel):
    id: str
    pickup_id: str
    driver_id: Optional[str] = None
    attempt_number: int = 1
    status: str
    otp_verified: bool = False
    otp_verified_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    failure_notes: Optional[str] = None
    item_condition: Optional[str] = None
    item_condition_notes: Optional[str] = None
    condition_photo_urls: Optional[List[str]] = None
    photo_urls: Optional[List[str]] = None
    signature_url: Optional[str] = None
    recipient_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReversePickupDetailResponse(ReversePickupResponse):
    attempts: List[PickupAttemptResponse] = []
    driver_name: Optional[str] = None
    original_order_number: Optional[str] = None


# =====================================================
# OTP MODELS (reuse pattern from delivery)
# =====================================================

class PickupOtpSendRequest(BaseModel):
    pickup_id: str
    otp_type: str = "pickup"


class PickupOtpVerifyRequest(BaseModel):
    pickup_id: str
    otp_code: str
    otp_type: str = "pickup"
