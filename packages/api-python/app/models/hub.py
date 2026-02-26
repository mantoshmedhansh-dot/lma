from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


# =====================================================
# HUB MODELS
# =====================================================

class HubBase(BaseModel):
    name: str
    code: str
    address_line_1: str
    address_line_2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: Optional[str] = None


class HubCreate(HubBase):
    manager_id: Optional[str] = None


class HubUpdate(BaseModel):
    name: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    manager_id: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class HubResponse(HubBase):
    id: str
    manager_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HubStats(BaseModel):
    total_orders_today: int = 0
    pending_orders: int = 0
    out_for_delivery: int = 0
    delivered_today: int = 0
    failed_today: int = 0
    completion_rate: float = 0.0
    active_drivers: int = 0
    active_routes: int = 0


# =====================================================
# VEHICLE MODELS
# =====================================================

class VehicleType(str, Enum):
    BIKE = "bike"
    THREE_WHEELER = "three_wheeler"
    MINI_TRUCK = "mini_truck"
    ONE_TONNER = "one_tonner"
    TWO_TONNER = "two_tonner"


class VehicleStatus(str, Enum):
    AVAILABLE = "available"
    ON_ROUTE = "on_route"
    MAINTENANCE = "maintenance"
    INACTIVE = "inactive"


class VehicleBase(BaseModel):
    vehicle_type: str
    plate_number: str
    capacity_kg: Optional[float] = None
    capacity_volume_cft: Optional[float] = None
    make_model: Optional[str] = None


class VehicleCreate(VehicleBase):
    hub_id: str


class VehicleUpdate(BaseModel):
    vehicle_type: Optional[str] = None
    plate_number: Optional[str] = None
    capacity_kg: Optional[float] = None
    capacity_volume_cft: Optional[float] = None
    make_model: Optional[str] = None
    status: Optional[str] = None
    assigned_driver_id: Optional[str] = None
    is_active: Optional[bool] = None


class VehicleResponse(VehicleBase):
    id: str
    hub_id: str
    status: str = "available"
    assigned_driver_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


# =====================================================
# DELIVERY ROUTE MODELS
# =====================================================

class RouteStatus(str, Enum):
    PLANNED = "planned"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class RouteCreate(BaseModel):
    hub_id: str
    route_name: Optional[str] = None
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    route_date: date
    order_ids: List[str] = []


class RouteUpdate(BaseModel):
    route_name: Optional[str] = None
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    route_date: Optional[date] = None
    status: Optional[str] = None


class RouteAssign(BaseModel):
    driver_id: str
    vehicle_id: str


class RouteResponse(BaseModel):
    id: str
    hub_id: str
    route_name: Optional[str] = None
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    route_date: date
    status: str = "planned"
    total_stops: int = 0
    total_distance_km: Optional[float] = None
    estimated_duration_mins: Optional[int] = None
    total_weight_kg: Optional[float] = None
    total_volume_cft: Optional[float] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RouteDetailResponse(RouteResponse):
    stops: List["RouteStopResponse"] = []
    vehicle: Optional[VehicleResponse] = None
    driver_name: Optional[str] = None


# =====================================================
# ROUTE STOP MODELS
# =====================================================

class RouteStopResponse(BaseModel):
    id: str
    route_id: str
    order_id: str
    sequence: int
    status: str = "pending"
    planned_eta: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    actual_departure: Optional[datetime] = None
    distance_from_prev_km: Optional[float] = None
    duration_from_prev_mins: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime
    order: Optional["DeliveryOrderBrief"] = None

    class Config:
        from_attributes = True


class DeliveryOrderBrief(BaseModel):
    id: str
    order_number: str
    customer_name: str
    customer_phone: str
    delivery_address: str
    product_description: str
    status: str
    is_cod: bool = False
    cod_amount: Optional[float] = 0

    class Config:
        from_attributes = True


# =====================================================
# AUTO-PLAN MODELS
# =====================================================

class AutoPlanRequest(BaseModel):
    hub_id: str
    route_date: date
    vehicle_ids: Optional[List[str]] = None


class AutoPlanResponse(BaseModel):
    routes_created: int
    total_orders_assigned: int
    unassigned_orders: int
    routes: List[RouteResponse] = []
