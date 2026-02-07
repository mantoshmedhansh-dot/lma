from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from enum import Enum


class VehicleType(str, Enum):
    BICYCLE = "bicycle"
    MOTORCYCLE = "motorcycle"
    CAR = "car"
    VAN = "van"
    TRUCK = "truck"


class DriverStatus(str, Enum):
    OFFLINE = "offline"
    ONLINE = "online"
    BUSY = "busy"
    ON_DELIVERY = "on_delivery"


class DriverBase(BaseModel):
    vehicle_type: VehicleType
    vehicle_number: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    license_number: str
    license_expiry: date


class DriverCreate(DriverBase):
    pass


class DriverUpdate(BaseModel):
    vehicle_type: Optional[VehicleType] = None
    vehicle_number: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    status: Optional[DriverStatus] = None


class DriverResponse(DriverBase):
    id: str
    user_id: str
    status: DriverStatus = DriverStatus.OFFLINE
    is_verified: bool = False
    is_active: bool = True
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    last_location_update: Optional[datetime] = None
    average_rating: float = 0
    total_ratings: int = 0
    total_deliveries: int = 0
    wallet_balance: float = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DriverLocationUpdate(BaseModel):
    latitude: float
    longitude: float


class DriverEarningsResponse(BaseModel):
    id: str
    driver_id: str
    order_id: str
    delivery_fee: float
    tip_amount: float
    bonus_amount: float
    total_earnings: float
    platform_fee: float
    net_earnings: float
    is_paid: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DriverPayoutResponse(BaseModel):
    id: str
    driver_id: str
    amount: float
    status: str
    transaction_id: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
