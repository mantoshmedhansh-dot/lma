export interface DeliveryRoute {
  id: string;
  hub_id: string;
  route_name: string | null;
  route_date: string;
  status: 'planned' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  total_stops: number;
  total_distance_km: number | null;
  estimated_duration_mins: number | null;
  driver_id: string | null;
  vehicle_id: string | null;
  start_time: string | null;
  end_time: string | null;
  stops: RouteStop[];
  vehicle: RouteVehicle | null;
}

export interface RouteStop {
  id: string;
  route_id: string;
  order_id: string;
  sequence: number;
  status: 'pending' | 'arrived' | 'delivered' | 'failed' | 'skipped';
  planned_eta: string | null;
  actual_arrival: string | null;
  actual_departure: string | null;
  order: DeliveryOrder | null;
}

export interface DeliveryOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  product_description: string;
  is_cod: boolean;
  cod_amount: number;
  status: string;
}

export interface RouteVehicle {
  id: string;
  vehicle_type: string;
  plate_number: string;
  capacity_kg: number | null;
}

export type FailureReason =
  | 'customer_unavailable'
  | 'customer_rejected'
  | 'wrong_address'
  | 'access_issue'
  | 'damaged_package'
  | 'reschedule_requested'
  | 'other';

export const FAILURE_REASONS: { value: FailureReason; label: string }[] = [
  { value: 'customer_unavailable', label: 'Customer Unavailable' },
  { value: 'customer_rejected', label: 'Customer Rejected' },
  { value: 'wrong_address', label: 'Wrong Address' },
  { value: 'access_issue', label: 'Access Issue' },
  { value: 'damaged_package', label: 'Damaged Package' },
  { value: 'reschedule_requested', label: 'Reschedule Requested' },
  { value: 'other', label: 'Other' },
];
