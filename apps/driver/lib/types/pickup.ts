export interface ReversePickup {
  id: string;
  hub_id: string;
  pickup_number: string;
  original_order_id: string | null;
  source: string;
  external_order_id: string | null;
  external_source: string | null;
  return_reason: string | null;
  return_notes: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  pickup_address: string;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_postal_code: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  product_description: string;
  product_sku: string | null;
  package_count: number;
  total_weight_kg: number | null;
  status: string;
  route_id: string | null;
  driver_id: string | null;
  scheduled_date: string | null;
  pickup_slot: string | null;
  created_at: string;
  assigned_at: string | null;
  out_for_pickup_at: string | null;
  picked_up_at: string | null;
  received_at_hub_at: string | null;
}

export type PickupFailureReason =
  | "customer_unavailable"
  | "refused"
  | "wrong_address"
  | "item_not_ready"
  | "access_issue"
  | "other";

export const PICKUP_FAILURE_REASONS: {
  value: PickupFailureReason;
  label: string;
}[] = [
  { value: "customer_unavailable", label: "Customer Unavailable" },
  { value: "refused", label: "Customer Refused" },
  { value: "wrong_address", label: "Wrong Address" },
  { value: "item_not_ready", label: "Item Not Ready" },
  { value: "access_issue", label: "Access Issue" },
  { value: "other", label: "Other" },
];

export type ItemCondition = "good" | "damaged" | "opened" | "missing_parts";

export const ITEM_CONDITIONS: { value: ItemCondition; label: string }[] = [
  { value: "good", label: "Good Condition" },
  { value: "damaged", label: "Damaged" },
  { value: "opened", label: "Opened / Used" },
  { value: "missing_parts", label: "Missing Parts" },
];
