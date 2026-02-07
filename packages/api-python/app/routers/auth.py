from fastapi import APIRouter, HTTPException, status, Depends
from typing import Dict, Any

from app.core.supabase import get_supabase
from app.core.security import get_current_user, create_access_token
from app.models.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """Register a new user."""
    supabase = get_supabase()

    try:
        # Create user in Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "data": {
                    "first_name": user_data.first_name,
                    "last_name": user_data.last_name,
                }
            }
        })

        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user"
            )

        # Create user profile in our users table
        user_profile = supabase.table("users").insert({
            "id": auth_response.user.id,
            "email": user_data.email,
            "first_name": user_data.first_name,
            "last_name": user_data.last_name,
            "phone": user_data.phone,
            "role": user_data.role.value,
        }).execute()

        user = user_profile.data[0] if user_profile.data else None

        return TokenResponse(
            access_token=auth_response.session.access_token if auth_response.session else "",
            user=UserResponse(**user) if user else None
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login with email and password."""
    supabase = get_supabase()

    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password,
        })

        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        # Get user profile
        user_profile = supabase.table("users").select("*").eq(
            "id", auth_response.user.id
        ).single().execute()

        # Update last login
        supabase.table("users").update({
            "last_login_at": "now()"
        }).eq("id", auth_response.user.id).execute()

        return TokenResponse(
            access_token=auth_response.session.access_token if auth_response.session else "",
            user=UserResponse(**user_profile.data) if user_profile.data else None
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )


@router.post("/logout")
async def logout(current_user: Dict = Depends(get_current_user)):
    """Logout the current user."""
    supabase = get_supabase()

    try:
        supabase.auth.sign_out()
        return {"message": "Successfully logged out"}
    except Exception:
        return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: Dict = Depends(get_current_user)):
    """Get the current user's profile."""
    supabase = get_supabase()

    user_profile = supabase.table("users").select("*").eq(
        "id", current_user["id"]
    ).single().execute()

    if not user_profile.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse(**user_profile.data)


@router.post("/refresh")
async def refresh_token(current_user: Dict = Depends(get_current_user)):
    """Refresh the access token."""
    supabase = get_supabase()

    try:
        response = supabase.auth.refresh_session()
        return {
            "access_token": response.session.access_token if response.session else "",
            "token_type": "bearer"
        }
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not refresh token"
        )


@router.post("/forgot-password")
async def forgot_password(email: str):
    """Send password reset email."""
    supabase = get_supabase()

    try:
        supabase.auth.reset_password_email(email)
        return {"message": "Password reset email sent"}
    except Exception:
        # Don't reveal if email exists
        return {"message": "If the email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(token: str, new_password: str):
    """Reset password with token."""
    supabase = get_supabase()

    try:
        supabase.auth.update_user({"password": new_password})
        return {"message": "Password updated successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token"
        )
