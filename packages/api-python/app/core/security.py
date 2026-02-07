from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings
from app.core.supabase import get_supabase

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.API_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and verify a JWT token."""
    try:
        payload = jwt.decode(token, settings.API_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Get the current authenticated user from the token."""
    token = credentials.credentials

    try:
        # Verify with Supabase
        supabase = get_supabase()
        user_response = supabase.auth.get_user(token)

        if user_response and user_response.user:
            # Get additional user data from our users table
            user_data = supabase.table("users").select("*").eq("id", user_response.user.id).single().execute()

            user_dict = user_data.data if user_data.data else {}
            return {
                "id": user_response.user.id,
                "email": user_response.user.email,
                "role": user_dict.get("role", "customer"),
                **user_dict
            }
    except Exception:
        pass

    # Fallback to custom JWT
    payload = decode_token(token)
    return payload


async def get_current_active_user(current_user: Dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Ensure the current user is active."""
    if current_user.get("is_active") is False:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_role(allowed_roles: list):
    """Decorator to require specific roles."""
    async def role_checker(current_user: Dict = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = current_user.get("role", "customer")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker
