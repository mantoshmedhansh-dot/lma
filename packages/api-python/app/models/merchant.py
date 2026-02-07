from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, time
from enum import Enum


class MerchantStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CLOSED = "closed"


class MerchantType(str, Enum):
    RESTAURANT = "restaurant"
    GROCERY = "grocery"
    PHARMACY = "pharmacy"
    RETAIL = "retail"
    OTHER = "other"


class DayOfWeek(str, Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class MerchantBase(BaseModel):
    business_name: str
    description: Optional[str] = None
    merchant_type: MerchantType
    phone: str
    email: EmailStr
    website: Optional[str] = None
    address_line_1: str
    address_line_2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    country: str = "India"
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class MerchantCreate(MerchantBase):
    pass


class MerchantUpdate(BaseModel):
    business_name: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    min_order_amount: Optional[float] = None
    estimated_prep_time: Optional[int] = None
    delivery_radius_km: Optional[float] = None


class MerchantResponse(MerchantBase):
    id: str
    user_id: str
    slug: str
    logo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    status: MerchantStatus
    average_rating: float = 0
    total_ratings: int = 0
    min_order_amount: float = 0
    estimated_prep_time: int = 30
    delivery_radius_km: float = 10
    is_featured: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MerchantHoursBase(BaseModel):
    day_of_week: DayOfWeek
    open_time: str  # HH:MM format
    close_time: str
    is_closed: bool = False


class MerchantHoursResponse(MerchantHoursBase):
    id: str
    merchant_id: str

    class Config:
        from_attributes = True


class ProductCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    display_order: int = 0


class ProductCategoryResponse(ProductCategoryBase):
    id: str
    merchant_id: str
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    compare_at_price: Optional[float] = None
    category_id: Optional[str] = None
    is_vegetarian: bool = False
    is_vegan: bool = False
    is_gluten_free: bool = False
    spice_level: Optional[int] = None
    prep_time: Optional[int] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    is_available: Optional[bool] = None
    is_featured: Optional[bool] = None


class ProductResponse(ProductBase):
    id: str
    merchant_id: str
    image_url: Optional[str] = None
    is_available: bool = True
    is_featured: bool = False
    display_order: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
