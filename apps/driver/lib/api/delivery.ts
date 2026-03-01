import { apiClient } from './client';
import { supabase } from '../supabase';
import type { DeliveryRoute, FailureReason } from '../types/route';

export async function fetchMyRoute(): Promise<DeliveryRoute | null> {
  try {
    return await apiClient<DeliveryRoute>('/api/v1/delivery/my-route');
  } catch (error: any) {
    if (error.message?.includes('404') || error.message?.includes('No route')) {
      return null;
    }
    throw error;
  }
}

export async function arriveAtStop(stopId: string): Promise<void> {
  await apiClient(`/api/v1/delivery/stop/${stopId}/arrive`, {
    method: 'POST',
  });
}

export async function completeStop(
  stopId: string,
  statusValue: 'delivered' | 'failed',
): Promise<void> {
  await apiClient(
    `/api/v1/delivery/stop/${stopId}/complete?status_value=${statusValue}`,
    { method: 'POST' },
  );
}

export async function sendOtp(
  orderId: string,
  type: 'delivery' | 'return',
): Promise<{ message: string }> {
  return apiClient('/api/v1/delivery/otp/send', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, type }),
  });
}

export async function verifyOtp(
  orderId: string,
  code: string,
  type: 'delivery' | 'return',
): Promise<{ verified: boolean }> {
  return apiClient('/api/v1/delivery/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, code, type }),
  });
}

export interface RecordAttemptData {
  order_id: string;
  status: 'delivered' | 'failed';
  photo_urls?: string[];
  signature_url?: string | null;
  failure_reason?: FailureReason | null;
  failure_notes?: string | null;
  cod_collected?: boolean;
  cod_amount?: number | null;
  notes?: string | null;
}

export async function recordAttempt(data: RecordAttemptData): Promise<void> {
  await apiClient('/api/v1/delivery/attempt', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function returnToHub(orderId: string): Promise<void> {
  await apiClient(`/api/v1/delivery/return-to-hub?order_id=${orderId}`, {
    method: 'POST',
  });
}

export async function uploadPhoto(
  orderId: string,
  uri: string,
): Promise<string> {
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const filePath = `pod/${orderId}/${fileName}`;

  const response = await fetch(uri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('deliveries')
    .upload(filePath, blob, { contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from('deliveries').getPublicUrl(filePath);
  return data.publicUrl;
}
