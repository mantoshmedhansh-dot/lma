from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY_FOR_PICKUP = "ready_for_pickup"
    DRIVER_ASSIGNED = "driver_assigned"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    ARRIVED = "arrived"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentMethod(str, Enum):
    CARD = "card"
    WALLET = "wallet"
    CASH = "cash"
    UPI = "upi"
    NET_BANKING = "net_banking"


class OrderItemCreate(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    quantity: int
    special_instructions: Optional[str] = None
    addon_ids: Optional[List[str]] = None


class OrderCreate(BaseModel):
    merchant_id: str
    delivery_address_id: str
    items: List[OrderItemCreate]
    payment_method: PaymentMethod = PaymentMethod.CARD
    delivery_instructions: Optional[str] = None
    scheduled_for: Optional[datetime] = None
    coupon_code: Optional[str] = None
    tip_amount: float = 0


class OrderItemResponse(BaseModel):
    id: str
    product_id: str
    product_name: str
    variant_name: Optional[str] = None
    unit_price: float
    quantity: int
    total_price: float
    special_instructions: Optional[str] = None

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: str
    order_number: str
    customer_id: str
    merchant_id: str
    driver_id: Optional[str] = None
    status: OrderStatus
    delivery_address_snapshot: Dict[str, Any]
    pickup_address_snapshot: Dict[str, Any]
    subtotal: float
    delivery_fee: float
    service_fee: float
    tax_amount: float
    discount_amount: float
    tip_amount: float
    total_amount: float
    coupon_code: Optional[str] = None
    estimated_prep_time: Optional[int] = None
    estimated_delivery_time: Optional[int] = None
    scheduled_for: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    preparing_at: Optional[datetime] = None
    ready_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    customer_notes: Optional[str] = None
    items: List[OrderItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    notes: Optional[str] = None


class OrderCancellation(BaseModel):
    reason: str


class PaymentCreate(BaseModel):
    order_id: str
    amount: float
    payment_method: PaymentMethod
    currency: str = "INR"


class PaymentResponse(BaseModel):
    id: str
    order_id: str
    user_id: str
    amount: float
    currency: str
    payment_method: PaymentMethod
    status: PaymentStatus
    gateway_payment_id: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Stripe Payment Models ---

class CreatePaymentIntentRequest(BaseModel):
    order_id: str
    payment_method: PaymentMethod


class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    payment_id: str


class PaymentStatusResponse(BaseModel):
    id: str
    order_id: str
    user_id: str
    amount: float
    currency: str
    payment_method: PaymentMethod
    status: PaymentStatus
    gateway_provider: Optional[str] = None
    gateway_payment_id: Optional[str] = None
    card_brand: Optional[str] = None
    card_last4: Optional[str] = None
    paid_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RefundRequest(BaseModel):
    reason: Optional[str] = None
    amount: Optional[float] = None  # Partial refund amount; None = full refund


class RefundResponse(BaseModel):
    refund_id: str
    payment_id: str
    amount: float
    status: str
