import { createClient } from "./supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function apiAuthFetch<T = any>(path: string): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.detail || body.message || "API request failed");
  }

  return res.json();
}
