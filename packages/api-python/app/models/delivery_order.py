from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime, date
from enum import Enum


# =====================================================
# DELIVERY ORDER MODELS
# =====================================================

class OrderStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETURNED_TO_HUB = "returned_to_hub"
    CANCELLED = "cancelled"


class OrderPriority(str, Enum):
    URGENT = "urgent"
    NORMAL = "normal"
    LOW = "low"


class OrderSource(str, Enum):
    CSV = "csv"
    API = "api"
    MANUAL = "manual"


class DeliveryOrderCreate(BaseModel):
    hub_id: str
    source: str = "manual"

    # Seller info
    seller_name: Optional[str] = None
    seller_order_ref: Optional[str] = None
    marketplace: Optional[str] = None

    # Customer info
    customer_name: str
    customer_phone: str
    customer_alt_phone: Optional[str] = None
    customer_email: Optional[str] = None

    # Delivery address
    delivery_address: str
    delivery_city: Optional[str] = None
    delivery_state: Optional[str] = None
    delivery_postal_code: Optional[str] = None
    delivery_latitude: Optional[float] = None
    delivery_longitude: Optional[float] = None

    # Product info
    product_description: str
    product_sku: Optional[str] = None
    product_category: Optional[str] = None
    package_count: int = 1
    total_weight_kg: Optional[float] = None
    total_volume_cft: Optional[float] = None

    # Payment
    is_cod: bool = False
    cod_amount: Optional[float] = 0
    declared_value: Optional[float] = None

    # Scheduling
    priority: str = "normal"
    scheduled_date: Optional[date] = None
    delivery_slot: Optional[str] = None


class DeliveryOrderUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_alt_phone: Optional[str] = None
    customer_email: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_state: Optional[str] = None
    delivery_postal_code: Optional[str] = None
    delivery_latitude: Optional[float] = None
    delivery_longitude: Optional[float] = None
    product_description: Optional[str] = None
    product_sku: Optional[str] = None
    product_category: Optional[str] = None
    package_count: Optional[int] = None
    total_weight_kg: Optional[float] = None
    total_volume_cft: Optional[float] = None
    is_cod: Optional[bool] = None
    cod_amount: Optional[float] = None
    declared_value: Optional[float] = None
    priority: Optional[str] = None
    scheduled_date: Optional[date] = None
    delivery_slot: Optional[str] = None
    status: Optional[str] = None


class DeliveryOrderResponse(BaseModel):
    id: str
    hub_id: str
    order_number: str
    source: str
    import_batch_id: Optional[str] = None

    seller_name: Optional[str] = None
    seller_order_ref: Optional[str] = None
    marketplace: Optional[str] = None

    customer_name: str
    customer_phone: str
    customer_alt_phone: Optional[str] = None
    customer_email: Optional[str] = None

    delivery_address: str
    delivery_city: Optional[str] = None
    delivery_state: Optional[str] = None
    delivery_postal_code: Optional[str] = None
    delivery_latitude: Optional[float] = None
    delivery_longitude: Optional[float] = None

    product_description: str
    product_sku: Optional[str] = None
    product_category: Optional[str] = None
    package_count: int = 1
    total_weight_kg: Optional[float] = None
    total_volume_cft: Optional[float] = None

    is_cod: bool = False
    cod_amount: Optional[float] = 0
    declared_value: Optional[float] = None

    status: str = "pending"
    priority: str = "normal"

    route_id: Optional[str] = None
    driver_id: Optional[str] = None

    scheduled_date: Optional[date] = None
    delivery_slot: Optional[str] = None

    created_at: datetime
    assigned_at: Optional[datetime] = None
    out_for_delivery_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    returned_at: Optional[datetime] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class DeliveryOrderDetailResponse(DeliveryOrderResponse):
    attempts: List["DeliveryAttemptResponse"] = []
    route_name: Optional[str] = None
    driver_name: Optional[str] = None


# =====================================================
# ORDER IMPORT MODELS
# =====================================================

class OrderImportResponse(BaseModel):
    id: str
    hub_id: str
    uploaded_by: str
    source: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    total_records: int = 0
    processed: int = 0
    failed: int = 0
    error_log: Optional[Any] = None
    status: str = "processing"
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# =====================================================
# DELIVERY ATTEMPT MODELS
# =====================================================

class FailureReason(str, Enum):
    CUSTOMER_UNAVAILABLE = "customer_unavailable"
    CUSTOMER_REJECTED = "customer_rejected"
    WRONG_ADDRESS = "wrong_address"
    ACCESS_ISSUE = "access_issue"
    OTHER = "other"


class DeliveryAttemptCreate(BaseModel):
    order_id: str
    route_stop_id: Optional[str] = None
    status: str  # 'delivered' or 'failed'
    failure_reason: Optional[str] = None
    failure_notes: Optional[str] = None
    photo_urls: Optional[List[str]] = None
    signature_url: Optional[str] = None
    recipient_name: Optional[str] = None
    cod_collected: bool = False
    cod_amount: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class DeliveryAttemptResponse(BaseModel):
    id: str
    order_id: str
    route_stop_id: Optional[str] = None
    driver_id: str
    attempt_number: int = 1
    status: str
    delivery_otp: Optional[str] = None
    return_otp: Optional[str] = None
    otp_verified: bool = False
    otp_sent_at: Optional[datetime] = None
    otp_verified_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    failure_notes: Optional[str] = None
    photo_urls: Optional[List[str]] = None
    signature_url: Optional[str] = None
    recipient_name: Optional[str] = None
    cod_collected: bool = False
    cod_amount: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


# =====================================================
# OTP MODELS
# =====================================================

class OtpSendRequest(BaseModel):
    order_id: str
    otp_type: str = "delivery"  # 'delivery' or 'return'


class OtpVerifyRequest(BaseModel):
    order_id: str
    otp_code: str
    otp_type: str = "delivery"


class OtpResponse(BaseModel):
    success: bool
    message: str
    expires_at: Optional[datetime] = None
