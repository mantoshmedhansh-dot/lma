"""Push notification service using Expo Push API."""

import logging
from typing import List, Optional

import httpx

from app.core.supabase import get_supabase

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push(
    user_id: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> bool:
    """Send a push notification to a user via Expo Push API."""
    supabase = get_supabase()

    # Get user's device tokens
    result = supabase.table("user_devices").select("push_token").eq(
        "user_id", user_id
    ).execute()

    tokens = [d["push_token"] for d in (result.data or []) if d.get("push_token")]

    if not tokens:
        logger.info(f"No push tokens found for user {user_id}")
        return False

    # Build messages
    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            "data": data or {},
        }
        for token in tokens
    ]

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            logger.info(f"Push sent to {len(tokens)} device(s) for user {user_id}")
            return True
    except Exception as e:
        logger.warning(f"Failed to send push notification: {e}")
        return False


async def notify_route_assigned(driver_user_id: str, route_name: str) -> bool:
    """Notify driver that a route has been assigned."""
    return await send_push(
        user_id=driver_user_id,
        title="Route Assigned",
        body=f"Route \"{route_name}\" has been assigned to you.",
        data={"type": "route_assigned"},
    )


async def notify_route_dispatched(driver_user_id: str, route_name: str) -> bool:
    """Notify driver that their route has been dispatched."""
    return await send_push(
        user_id=driver_user_id,
        title="Route Dispatched",
        body=f"Route \"{route_name}\" is now dispatched. Start your deliveries!",
        data={"type": "route_dispatched"},
    )


async def notify_new_order_on_route(
    driver_user_id: str, route_name: str, order_number: str,
) -> bool:
    """Notify driver that a new order was added to their route."""
    return await send_push(
        user_id=driver_user_id,
        title="New Stop Added",
        body=f"Order #{order_number} added to route \"{route_name}\".",
        data={"type": "order_added"},
    )
