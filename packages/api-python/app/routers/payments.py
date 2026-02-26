import stripe
from fastapi import APIRouter, HTTPException, status, Depends, Request
from typing import Dict

from app.core.config import settings
from app.core.supabase import get_supabase
from app.core.security import get_current_user, require_role
from app.models.order import (
    CreatePaymentIntentRequest,
    PaymentIntentResponse,
    PaymentStatusResponse,
    RefundRequest,
    RefundResponse,
)

router = APIRouter(prefix="/payments", tags=["Payments"])

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


@router.post("/create-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(
    payload: CreatePaymentIntentRequest,
    current_user: Dict = Depends(get_current_user),
):
    """Create a Stripe PaymentIntent for an order."""
    supabase = get_supabase()

    # Verify order exists and belongs to user
    order = supabase.table("orders").select("*").eq("id", payload.order_id).single().execute()
    if not order.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if order.data["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Reject cash payments
    if payload.payment_method.value == "cash":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cash payments do not require a payment intent",
        )

    # Fetch pending payment record for this order
    payment = (
        supabase.table("payments")
        .select("*")
        .eq("order_id", payload.order_id)
        .in_("status", ["pending", "processing"])
        .single()
        .execute()
    )
    if not payment.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending payment found for this order",
        )

    # If a PaymentIntent already exists (idempotent retry), retrieve it
    if payment.data.get("gateway_payment_id"):
        try:
            existing_intent = stripe.PaymentIntent.retrieve(payment.data["gateway_payment_id"])
            return PaymentIntentResponse(
                client_secret=existing_intent.client_secret,
                payment_intent_id=existing_intent.id,
                payment_id=payment.data["id"],
            )
        except stripe.error.StripeError:
            pass  # Fall through to create a new intent

    # Create Stripe PaymentIntent (amount in paise)
    amount_paise = int(round(order.data["total_amount"] * 100))

    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_paise,
            currency="inr",
            payment_method_types=["card"],
            metadata={
                "order_id": payload.order_id,
                "payment_id": payment.data["id"],
                "customer_id": current_user["id"],
            },
        )
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Stripe error: {str(e)}",
        )

    # Update payment record with intent info
    supabase.table("payments").update({
        "gateway_payment_id": intent.id,
        "gateway_provider": "stripe",
        "status": "processing",
    }).eq("id", payment.data["id"]).execute()

    return PaymentIntentResponse(
        client_secret=intent.client_secret,
        payment_intent_id=intent.id,
        payment_id=payment.data["id"],
    )


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events. No auth — Stripe calls this directly."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    supabase = get_supabase()

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        payment_id = intent["metadata"].get("payment_id")
        order_id = intent["metadata"].get("order_id")

        if not payment_id or not order_id:
            return {"status": "ignored", "reason": "missing metadata"}

        # Extract card details if available
        card_brand = None
        card_last4 = None
        if intent.get("charges") and intent["charges"]["data"]:
            charge = intent["charges"]["data"][0]
            pm_details = charge.get("payment_method_details", {})
            card_info = pm_details.get("card", {})
            card_brand = card_info.get("brand")
            card_last4 = card_info.get("last4")

        # Update payment to completed
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()

        supabase.table("payments").update({
            "status": "completed",
            "paid_at": now,
            "card_brand": card_brand,
            "card_last_four": card_last4,
        }).eq("id", payment_id).execute()

        # Update order to confirmed
        supabase.table("orders").update({
            "status": "confirmed",
            "confirmed_at": now,
        }).eq("id", order_id).execute()

        # Log status history
        supabase.table("order_status_history").insert({
            "order_id": order_id,
            "status": "confirmed",
            "notes": f"Payment confirmed via Stripe ({intent['id']})",
        }).execute()

    elif event["type"] == "payment_intent.payment_failed":
        intent = event["data"]["object"]
        payment_id = intent["metadata"].get("payment_id")

        if payment_id:
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).isoformat()

            supabase.table("payments").update({
                "status": "failed",
                "failed_at": now,
            }).eq("id", payment_id).execute()

    return {"status": "ok"}


@router.get("/{order_id}", response_model=PaymentStatusResponse)
async def get_payment_status(
    order_id: str,
    current_user: Dict = Depends(get_current_user),
):
    """Get payment status for an order."""
    supabase = get_supabase()

    # Fetch payment
    payment = (
        supabase.table("payments")
        .select("*")
        .eq("order_id", order_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not payment.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    pay = payment.data[0]

    # Access control: customer can only see their own, admin/super_admin can see all
    user_role = current_user.get("role", "customer")
    if user_role == "customer" and pay.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    return PaymentStatusResponse(**pay)


@router.post("/{payment_id}/refund", response_model=RefundResponse)
async def refund_payment(
    payment_id: str,
    payload: RefundRequest,
    current_user: Dict = Depends(require_role(["admin", "super_admin"])),
):
    """Refund a payment (admin/super_admin only)."""
    supabase = get_supabase()

    # Fetch payment
    payment = supabase.table("payments").select("*").eq("id", payment_id).single().execute()
    if not payment.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    pay = payment.data
    if pay["status"] != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only completed payments can be refunded",
        )

    if not pay.get("gateway_payment_id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No gateway payment ID — cannot refund cash payments via Stripe",
        )

    # Determine refund amount (paise)
    refund_amount = payload.amount if payload.amount else pay["amount"]
    amount_paise = int(round(refund_amount * 100))

    try:
        refund_params = {
            "payment_intent": pay["gateway_payment_id"],
            "amount": amount_paise,
        }
        if payload.reason:
            refund_params["reason"] = "requested_by_customer"
            refund_params["metadata"] = {"reason": payload.reason}

        refund = stripe.Refund.create(**refund_params)
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Stripe refund error: {str(e)}",
        )

    # Update payment status
    new_status = "refunded" if refund_amount >= pay["amount"] else "completed"
    supabase.table("payments").update({
        "status": new_status,
    }).eq("id", payment_id).execute()

    # Update order status if full refund
    if refund_amount >= pay["amount"]:
        supabase.table("orders").update({
            "status": "refunded",
        }).eq("id", pay["order_id"]).execute()

        supabase.table("order_status_history").insert({
            "order_id": pay["order_id"],
            "status": "refunded",
            "changed_by": current_user["id"],
            "notes": f"Refund {refund.id} — {payload.reason or 'No reason provided'}",
        }).execute()

    return RefundResponse(
        refund_id=refund.id,
        payment_id=payment_id,
        amount=refund_amount,
        status=refund.status,
    )
