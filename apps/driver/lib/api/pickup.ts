import { apiClient } from "./client";
import { supabase } from "../supabase";
import type {
  ReversePickup,
  PickupFailureReason,
  ItemCondition,
} from "../types/pickup";

export async function fetchMyPickups(): Promise<ReversePickup[]> {
  try {
    return await apiClient<ReversePickup[]>("/api/v1/delivery/my-pickups");
  } catch (error: any) {
    if (
      error.message?.includes("404") ||
      error.message?.includes("No pickups")
    ) {
      return [];
    }
    throw error;
  }
}

export async function arriveAtPickup(pickupId: string): Promise<void> {
  await apiClient(`/api/v1/delivery/pickup/${pickupId}/arrive`, {
    method: "POST",
  });
}

export async function sendPickupOtp(
  pickupId: string,
): Promise<{ message: string }> {
  return apiClient("/api/v1/delivery/pickup/otp/send", {
    method: "POST",
    body: JSON.stringify({ pickup_id: pickupId, otp_type: "pickup" }),
  });
}

export async function verifyPickupOtp(
  pickupId: string,
  code: string,
): Promise<{ verified: boolean }> {
  return apiClient("/api/v1/delivery/pickup/otp/verify", {
    method: "POST",
    body: JSON.stringify({
      pickup_id: pickupId,
      otp_code: code,
      otp_type: "pickup",
    }),
  });
}

export interface RecordPickupAttemptData {
  pickup_id: string;
  status: "picked_up" | "failed";
  otp_verified?: boolean;
  failure_reason?: PickupFailureReason | null;
  failure_notes?: string | null;
  item_condition?: ItemCondition | null;
  item_condition_notes?: string | null;
  condition_photo_urls?: string[];
  photo_urls?: string[];
  signature_url?: string | null;
  recipient_name?: string | null;
}

export async function recordPickupAttempt(
  data: RecordPickupAttemptData,
): Promise<void> {
  await apiClient("/api/v1/delivery/pickup/attempt", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function uploadPickupPhoto(
  pickupId: string,
  uri: string,
): Promise<string> {
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const filePath = `pickups/${pickupId}/${fileName}`;

  const response = await fetch(uri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from("deliveries")
    .upload(filePath, blob, { contentType: "image/jpeg" });

  if (error) throw error;

  const { data } = supabase.storage.from("deliveries").getPublicUrl(filePath);
  return data.publicUrl;
}
