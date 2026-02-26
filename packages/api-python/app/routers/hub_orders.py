from fastapi import APIRouter, HTTPException, status, Depends, Query, UploadFile, File
from typing import List, Optional, Dict
from datetime import datetime, date
import csv
import io
import uuid

from app.core.supabase import get_supabase
from app.core.security import get_current_user, require_role
from app.models.delivery_order import (
    DeliveryOrderCreate,
    DeliveryOrderUpdate,
    DeliveryOrderResponse,
    DeliveryOrderDetailResponse,
    DeliveryAttemptResponse,
    OrderImportResponse,
)

router = APIRouter(prefix="/hub-orders", tags=["Hub Orders"])


def get_user_hub_id(current_user: Dict) -> Optional[str]:
    """Get the hub_id the user has access to."""
    role = current_user.get("role")
    if role in ("admin", "super_admin"):
        return None  # Admin can access all hubs
    if role == "hub_manager":
        supabase = get_supabase()
        hub = supabase.table("hubs").select("id").eq("manager_id", current_user["id"]).limit(1).execute()
        if hub.data:
            return hub.data[0]["id"]
    return None


@router.post("", response_model=DeliveryOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: DeliveryOrderCreate,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Create a single delivery order manually."""
    supabase = get_supabase()

    order_dict = order_data.model_dump()
    # Generate order number
    order_dict["order_number"] = f"DH-{uuid.uuid4().hex[:8].upper()}"
    # Convert date to string
    if order_dict.get("scheduled_date"):
        order_dict["scheduled_date"] = order_dict["scheduled_date"].isoformat()

    result = supabase.table("delivery_orders").insert(order_dict).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create order")

    return DeliveryOrderResponse(**result.data[0])


@router.get("", response_model=List[DeliveryOrderResponse])
async def list_orders(
    hub_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    source: Optional[str] = None,
    priority: Optional[str] = None,
    scheduled_date: Optional[str] = None,
    route_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """List delivery orders with filters."""
    supabase = get_supabase()
    role = current_user.get("role")

    query = supabase.table("delivery_orders").select("*")

    # Hub filtering
    if role == "hub_manager":
        user_hub_id = get_user_hub_id(current_user)
        if user_hub_id:
            query = query.eq("hub_id", user_hub_id)
        else:
            return []
    elif hub_id:
        query = query.eq("hub_id", hub_id)

    # Apply filters
    if status_filter:
        query = query.eq("status", status_filter)
    if source:
        query = query.eq("source", source)
    if priority:
        query = query.eq("priority", priority)
    if scheduled_date:
        query = query.eq("scheduled_date", scheduled_date)
    if route_id:
        query = query.eq("route_id", route_id)
    if search:
        query = query.or_(
            f"order_number.ilike.%{search}%,customer_name.ilike.%{search}%,customer_phone.ilike.%{search}%"
        )

    # Pagination
    offset = (page - 1) * page_size
    result = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()

    return [DeliveryOrderResponse(**o) for o in result.data]


@router.get("/imports", response_model=List[OrderImportResponse])
async def list_imports(
    hub_id: Optional[str] = None,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """List order import batches."""
    supabase = get_supabase()
    role = current_user.get("role")

    query = supabase.table("order_imports").select("*")

    if role == "hub_manager":
        user_hub_id = get_user_hub_id(current_user)
        if user_hub_id:
            query = query.eq("hub_id", user_hub_id)
        else:
            return []
    elif hub_id:
        query = query.eq("hub_id", hub_id)

    result = query.order("created_at", desc=True).limit(50).execute()
    return [OrderImportResponse(**i) for i in result.data]


@router.get("/imports/{import_id}", response_model=OrderImportResponse)
async def get_import_detail(
    import_id: str,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Get import batch detail with errors."""
    supabase = get_supabase()

    result = supabase.table("order_imports").select("*").eq("id", import_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Import batch not found")

    return OrderImportResponse(**result.data)


@router.get("/{order_id}", response_model=DeliveryOrderDetailResponse)
async def get_order_detail(
    order_id: str,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager", "driver"]))
):
    """Get order detail with attempt history."""
    supabase = get_supabase()

    result = supabase.table("delivery_orders").select("*").eq("id", order_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    # Get delivery attempts
    attempts = supabase.table("delivery_attempts").select("*").eq(
        "order_id", order_id
    ).order("attempt_number").execute()

    # Get route name if assigned
    route_name = None
    driver_name = None
    if result.data.get("route_id"):
        route = supabase.table("delivery_routes").select("route_name").eq(
            "id", result.data["route_id"]
        ).single().execute()
        if route.data:
            route_name = route.data.get("route_name")

    if result.data.get("driver_id"):
        driver = supabase.table("drivers").select("user_id").eq(
            "id", result.data["driver_id"]
        ).single().execute()
        if driver.data:
            user = supabase.table("users").select("first_name, last_name").eq(
                "id", driver.data["user_id"]
            ).single().execute()
            if user.data:
                driver_name = f"{user.data['first_name']} {user.data['last_name']}"

    return DeliveryOrderDetailResponse(
        **result.data,
        attempts=[DeliveryAttemptResponse(**a) for a in (attempts.data or [])],
        route_name=route_name,
        driver_name=driver_name,
    )


@router.patch("/{order_id}", response_model=DeliveryOrderResponse)
async def update_order(
    order_id: str,
    order_data: DeliveryOrderUpdate,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Update order details."""
    supabase = get_supabase()

    update_data = order_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Convert date to string
    if "scheduled_date" in update_data and update_data["scheduled_date"]:
        update_data["scheduled_date"] = update_data["scheduled_date"].isoformat()

    result = supabase.table("delivery_orders").update(update_data).eq("id", order_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    return DeliveryOrderResponse(**result.data[0])


@router.delete("/{order_id}")
async def cancel_order(
    order_id: str,
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Cancel an order."""
    supabase = get_supabase()

    # Check current status
    order = supabase.table("delivery_orders").select("status").eq("id", order_id).single().execute()
    if not order.data:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.data["status"] in ("delivered", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel order with status: {order.data['status']}")

    result = supabase.table("delivery_orders").update({
        "status": "cancelled",
    }).eq("id", order_id).execute()

    return {"message": "Order cancelled", "order_id": order_id}


@router.post("/upload-csv")
async def upload_csv(
    hub_id: str = Query(...),
    file: UploadFile = File(...),
    current_user: Dict = Depends(require_role(["admin", "super_admin", "hub_manager"]))
):
    """Upload CSV to bulk create delivery orders."""
    supabase = get_supabase()

    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    # Read file content
    content = await file.read()
    text = content.decode("utf-8")

    # Create import record
    import_record = supabase.table("order_imports").insert({
        "hub_id": hub_id,
        "uploaded_by": current_user["id"],
        "source": "csv",
        "file_name": file.filename,
        "status": "processing",
    }).execute()

    import_id = import_record.data[0]["id"]

    # Parse CSV
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    total_records = len(rows)
    processed = 0
    failed = 0
    errors = []

    # Required fields mapping (case-insensitive)
    field_map = {
        "customer_name": ["customer_name", "customer name", "name", "recipient_name", "recipient name"],
        "customer_phone": ["customer_phone", "customer phone", "phone", "mobile", "contact"],
        "delivery_address": ["delivery_address", "delivery address", "address", "drop_address", "drop address"],
        "product_description": ["product_description", "product description", "product", "item", "items", "description"],
    }

    optional_map = {
        "customer_email": ["customer_email", "customer email", "email"],
        "customer_alt_phone": ["customer_alt_phone", "alt_phone", "alternate phone"],
        "delivery_city": ["delivery_city", "city"],
        "delivery_state": ["delivery_state", "state"],
        "delivery_postal_code": ["delivery_postal_code", "postal_code", "pincode", "zip"],
        "seller_name": ["seller_name", "seller", "vendor"],
        "seller_order_ref": ["seller_order_ref", "order_ref", "awb", "reference", "order_id"],
        "marketplace": ["marketplace", "channel", "source_marketplace"],
        "product_sku": ["product_sku", "sku"],
        "product_category": ["product_category", "category"],
        "package_count": ["package_count", "packages", "qty", "quantity"],
        "total_weight_kg": ["total_weight_kg", "weight", "weight_kg"],
        "total_volume_cft": ["total_volume_cft", "volume", "volume_cft"],
        "is_cod": ["is_cod", "cod", "payment_mode"],
        "cod_amount": ["cod_amount", "cod_value"],
        "declared_value": ["declared_value", "value", "order_value"],
        "priority": ["priority"],
        "scheduled_date": ["scheduled_date", "delivery_date", "date"],
        "delivery_slot": ["delivery_slot", "slot", "time_slot"],
    }

    def find_field(row: dict, aliases: list) -> Optional[str]:
        """Find a field value from row using multiple possible column names."""
        row_lower = {k.lower().strip(): v for k, v in row.items()}
        for alias in aliases:
            if alias.lower() in row_lower:
                return row_lower[alias.lower()]
        return None

    for i, row in enumerate(rows, 1):
        try:
            # Extract required fields
            customer_name = find_field(row, field_map["customer_name"])
            customer_phone = find_field(row, field_map["customer_phone"])
            delivery_address = find_field(row, field_map["delivery_address"])
            product_description = find_field(row, field_map["product_description"])

            if not customer_name:
                raise ValueError("Missing customer_name")
            if not customer_phone:
                raise ValueError("Missing customer_phone")
            if not delivery_address:
                raise ValueError("Missing delivery_address")
            if not product_description:
                raise ValueError("Missing product_description")

            order_data = {
                "hub_id": hub_id,
                "order_number": f"DH-{uuid.uuid4().hex[:8].upper()}",
                "source": "csv",
                "import_batch_id": import_id,
                "customer_name": customer_name.strip(),
                "customer_phone": customer_phone.strip(),
                "delivery_address": delivery_address.strip(),
                "product_description": product_description.strip(),
            }

            # Extract optional fields
            for field_name, aliases in optional_map.items():
                value = find_field(row, aliases)
                if value and value.strip():
                    value = value.strip()
                    if field_name == "is_cod":
                        order_data[field_name] = value.lower() in ("true", "yes", "1", "cod")
                    elif field_name in ("package_count",):
                        order_data[field_name] = int(value)
                    elif field_name in ("total_weight_kg", "total_volume_cft", "cod_amount", "declared_value"):
                        order_data[field_name] = float(value)
                    else:
                        order_data[field_name] = value

            supabase.table("delivery_orders").insert(order_data).execute()
            processed += 1

        except Exception as e:
            failed += 1
            errors.append({"row": i, "error": str(e)})

    # Update import record
    supabase.table("order_imports").update({
        "total_records": total_records,
        "processed": processed,
        "failed": failed,
        "error_log": errors if errors else None,
        "status": "completed" if failed == 0 else ("completed" if processed > 0 else "failed"),
        "completed_at": datetime.utcnow().isoformat(),
    }).eq("id", import_id).execute()

    return {
        "import_id": import_id,
        "total_records": total_records,
        "processed": processed,
        "failed": failed,
        "errors": errors[:20],  # Return first 20 errors
    }
