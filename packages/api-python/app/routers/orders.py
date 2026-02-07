from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional, Dict
from datetime import datetime

from app.core.supabase import get_supabase
from app.core.security import get_current_user, require_role
from app.models.order import (
    OrderCreate,
    OrderResponse,
    OrderStatusUpdate,
    OrderCancellation,
    OrderStatus,
)

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("/", response_model=List[OrderResponse])
async def list_orders(
    status_filter: Optional[OrderStatus] = None,
    limit: int = Query(default=20, le=100),
    offset: int = 0,
    current_user: Dict = Depends(get_current_user)
):
    """List orders for the current user."""
    supabase = get_supabase()

    user_role = current_user.get("role", "customer")

    # Build query based on role
    if user_role == "customer":
        query = supabase.table("orders").select("*").eq("customer_id", current_user["id"])
    elif user_role == "driver":
        # Get driver ID
        driver = supabase.table("drivers").select("id").eq("user_id", current_user["id"]).single().execute()
        if driver.data:
            query = supabase.table("orders").select("*").eq("driver_id", driver.data["id"])
        else:
            return []
    elif user_role == "merchant":
        # Get merchant ID
        merchant = supabase.table("merchants").select("id").eq("user_id", current_user["id"]).single().execute()
        if merchant.data:
            query = supabase.table("orders").select("*").eq("merchant_id", merchant.data["id"])
        else:
            return []
    else:
        # Admin - see all orders
        query = supabase.table("orders").select("*")

    if status_filter:
        query = query.eq("status", status_filter.value)

    query = query.range(offset, offset + limit - 1).order("created_at", desc=True)

    result = query.execute()

    # Get order items for each order
    orders = []
    for order_data in result.data:
        items = supabase.table("order_items").select("*").eq("order_id", order_data["id"]).execute()
        order_data["items"] = items.data or []
        orders.append(OrderResponse(**order_data))

    return orders


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get a specific order."""
    supabase = get_supabase()

    result = supabase.table("orders").select("*").eq("id", order_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Verify access
    order = result.data
    user_role = current_user.get("role", "customer")

    if user_role == "customer" and order["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Get order items
    items = supabase.table("order_items").select("*").eq("order_id", order_id).execute()
    order["items"] = items.data or []

    return OrderResponse(**order)


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new order."""
    supabase = get_supabase()

    # Get merchant details
    merchant = supabase.table("merchants").select("*").eq("id", order_data.merchant_id).single().execute()
    if not merchant.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")

    # Get delivery address
    address = supabase.table("addresses").select("*").eq("id", order_data.delivery_address_id).single().execute()
    if not address.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery address not found")

    # Calculate order totals
    subtotal = 0
    order_items = []

    for item in order_data.items:
        product = supabase.table("products").select("*").eq("id", item.product_id).single().execute()
        if not product.data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Product {item.product_id} not found")

        item_total = product.data["price"] * item.quantity
        subtotal += item_total

        order_items.append({
            "product_id": item.product_id,
            "product_name": product.data["name"],
            "variant_id": item.variant_id,
            "unit_price": product.data["price"],
            "quantity": item.quantity,
            "total_price": item_total,
            "special_instructions": item.special_instructions,
        })

    # Calculate fees
    delivery_fee = 30.00  # Base fee, can be calculated based on distance
    service_fee = round(subtotal * 0.05, 2)  # 5% service fee
    tax_amount = round(subtotal * 0.05, 2)  # 5% tax
    discount_amount = 0

    # Apply coupon if provided
    if order_data.coupon_code:
        coupon = supabase.table("coupons").select("*").eq("code", order_data.coupon_code).single().execute()
        if coupon.data and coupon.data["is_active"]:
            if coupon.data["discount_type"] == "percentage":
                discount_amount = round(subtotal * (coupon.data["discount_value"] / 100), 2)
                if coupon.data.get("max_discount_amount"):
                    discount_amount = min(discount_amount, coupon.data["max_discount_amount"])
            else:
                discount_amount = coupon.data["discount_value"]

    total_amount = subtotal + delivery_fee + service_fee + tax_amount - discount_amount + order_data.tip_amount

    # Create order
    order = {
        "customer_id": current_user["id"],
        "merchant_id": order_data.merchant_id,
        "status": "pending",
        "delivery_address_id": order_data.delivery_address_id,
        "delivery_address_snapshot": address.data,
        "delivery_latitude": address.data.get("latitude"),
        "delivery_longitude": address.data.get("longitude"),
        "delivery_instructions": order_data.delivery_instructions,
        "pickup_address_snapshot": {
            "address_line_1": merchant.data["address_line_1"],
            "city": merchant.data["city"],
            "state": merchant.data["state"],
            "postal_code": merchant.data["postal_code"],
        },
        "pickup_latitude": merchant.data.get("latitude"),
        "pickup_longitude": merchant.data.get("longitude"),
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "service_fee": service_fee,
        "tax_amount": tax_amount,
        "discount_amount": discount_amount,
        "tip_amount": order_data.tip_amount,
        "total_amount": total_amount,
        "coupon_code": order_data.coupon_code,
        "estimated_prep_time": merchant.data.get("estimated_prep_time", 30),
        "scheduled_for": order_data.scheduled_for.isoformat() if order_data.scheduled_for else None,
        "customer_notes": order_data.delivery_instructions,
    }

    result = supabase.table("orders").insert(order).execute()

    if not result.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create order")

    order_id = result.data[0]["id"]

    # Create order items
    for item in order_items:
        item["order_id"] = order_id
        supabase.table("order_items").insert(item).execute()

    # Get complete order
    final_order = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    items = supabase.table("order_items").select("*").eq("order_id", order_id).execute()
    final_order.data["items"] = items.data or []

    return OrderResponse(**final_order.data)


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str,
    status_update: OrderStatusUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Update order status."""
    supabase = get_supabase()

    # Get order
    order = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not order.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Verify authorization based on role and status transition
    user_role = current_user.get("role", "customer")
    current_status = order.data["status"]
    new_status = status_update.status.value

    # Define allowed transitions
    allowed_transitions = {
        "merchant": ["confirmed", "preparing", "ready_for_pickup"],
        "driver": ["picked_up", "in_transit", "arrived", "delivered"],
        "admin": list(OrderStatus),
        "super_admin": list(OrderStatus),
    }

    if user_role not in ["admin", "super_admin"]:
        if new_status not in allowed_transitions.get(user_role, []):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this status change")

    # Update status
    update_data = {"status": new_status}

    # Set timestamps based on status
    timestamp_map = {
        "confirmed": "confirmed_at",
        "preparing": "preparing_at",
        "ready_for_pickup": "ready_at",
        "picked_up": "picked_up_at",
        "delivered": "delivered_at",
        "cancelled": "cancelled_at",
    }

    if new_status in timestamp_map:
        update_data[timestamp_map[new_status]] = datetime.utcnow().isoformat()

    result = supabase.table("orders").update(update_data).eq("id", order_id).execute()

    # Log status change
    supabase.table("order_status_history").insert({
        "order_id": order_id,
        "status": new_status,
        "changed_by": current_user["id"],
        "notes": status_update.notes,
    }).execute()

    # Get updated order with items
    updated_order = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    items = supabase.table("order_items").select("*").eq("order_id", order_id).execute()
    updated_order.data["items"] = items.data or []

    return OrderResponse(**updated_order.data)


@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: str,
    cancellation: OrderCancellation,
    current_user: Dict = Depends(get_current_user)
):
    """Cancel an order."""
    supabase = get_supabase()

    # Get order
    order = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not order.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Verify authorization
    if order.data["customer_id"] != current_user["id"] and current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Check if order can be cancelled
    non_cancellable = ["picked_up", "in_transit", "arrived", "delivered", "cancelled", "refunded"]
    if order.data["status"] in non_cancellable:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order cannot be cancelled at this stage")

    # Cancel order
    result = supabase.table("orders").update({
        "status": "cancelled",
        "cancelled_at": datetime.utcnow().isoformat(),
        "cancellation_reason": cancellation.reason,
        "cancelled_by": current_user["id"],
    }).eq("id", order_id).execute()

    # Get updated order with items
    updated_order = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    items = supabase.table("order_items").select("*").eq("order_id", order_id).execute()
    updated_order.data["items"] = items.data or []

    return OrderResponse(**updated_order.data)


@router.get("/{order_id}/tracking")
async def track_order(
    order_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get real-time tracking info for an order."""
    supabase = get_supabase()

    # Get order
    order = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not order.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Verify access
    if order.data["customer_id"] != current_user["id"] and current_user.get("role") not in ["admin", "super_admin", "driver"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    tracking_info = {
        "order_id": order_id,
        "order_number": order.data["order_number"],
        "status": order.data["status"],
        "estimated_delivery_time": order.data.get("estimated_delivery_time"),
        "driver_location": None,
    }

    # Get driver location if assigned
    if order.data.get("driver_id"):
        driver = supabase.table("drivers").select(
            "current_latitude", "current_longitude", "last_location_update"
        ).eq("id", order.data["driver_id"]).single().execute()

        if driver.data:
            tracking_info["driver_location"] = {
                "latitude": driver.data.get("current_latitude"),
                "longitude": driver.data.get("current_longitude"),
                "updated_at": driver.data.get("last_location_update"),
            }

    # Get status history
    history = supabase.table("order_status_history").select("*").eq(
        "order_id", order_id
    ).order("created_at", desc=True).execute()

    tracking_info["status_history"] = history.data or []

    return tracking_info
