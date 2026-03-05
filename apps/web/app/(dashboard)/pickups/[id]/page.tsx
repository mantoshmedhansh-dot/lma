"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Package,
  User,
  Clock,
  Camera,
  CheckCircle,
} from "lucide-react";

interface PickupDetail {
  id: string;
  pickup_number: string;
  hub_id: string;
  original_order_id: string | null;
  source: string;
  external_order_id: string | null;
  external_source: string | null;
  external_return_id: string | null;
  return_reason: string | null;
  return_notes: string | null;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  pickup_address: string;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_postal_code: string | null;
  product_description: string;
  product_sku: string | null;
  package_count: number;
  total_weight_kg: number | null;
  scheduled_date: string | null;
  pickup_slot: string | null;
  driver_name: string | null;
  original_order_number: string | null;
  created_at: string;
  assigned_at: string | null;
  out_for_pickup_at: string | null;
  picked_up_at: string | null;
  received_at_hub_at: string | null;
  attempts: PickupAttempt[];
}

interface PickupAttempt {
  id: string;
  attempt_number: number;
  status: string;
  otp_verified: boolean;
  failure_reason: string | null;
  failure_notes: string | null;
  item_condition: string | null;
  item_condition_notes: string | null;
  condition_photo_urls: string[] | null;
  photo_urls: string[] | null;
  signature_url: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pickup_pending: "bg-yellow-100 text-yellow-800",
  assigned: "bg-blue-100 text-blue-800",
  out_for_pickup: "bg-indigo-100 text-indigo-800",
  picked_up: "bg-green-100 text-green-800",
  received_at_hub: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const CONDITION_COLORS: Record<string, string> = {
  good: "bg-green-100 text-green-800",
  damaged: "bg-red-100 text-red-800",
  opened: "bg-orange-100 text-orange-800",
  missing_parts: "bg-yellow-100 text-yellow-800",
};

export default function PickupDetailPage() {
  const params = useParams();
  const [pickup, setPickup] = useState<PickupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(false);

  const fetchPickup = async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/reverse-pickups/${params.id}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (res.ok) {
        setPickup(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch pickup:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPickup();
  }, [params.id]);

  const handleReceiveAtHub = async () => {
    if (!pickup) return;
    setReceiving(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/reverse-pickups/${pickup.id}/receive`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (res.ok) {
        await fetchPickup();
      }
    } catch (err) {
      console.error("Failed to receive at hub:", err);
    }
    setReceiving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading pickup...</p>
      </div>
    );
  }

  if (!pickup) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Pickup not found</p>
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader
        title={`Pickup ${pickup.pickup_number}`}
        actions={
          <div className="flex gap-2">
            <Link href="/pickups">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Pickups
              </Button>
            </Link>
            {pickup.status === "picked_up" && (
              <Button
                size="sm"
                onClick={handleReceiveAtHub}
                disabled={receiving}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {receiving ? "Processing..." : "Confirm Receipt at Hub"}
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Status Banner */}
        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div className="flex items-center gap-4">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[pickup.status] || "bg-gray-100"}`}
            >
              {pickup.status.replace(/_/g, " ").toUpperCase()}
            </span>
            {pickup.return_reason && (
              <span className="text-sm text-muted-foreground">
                Reason: {pickup.return_reason}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                pickup.source === "cjdquick"
                  ? "bg-purple-100 text-purple-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {pickup.source === "cjdquick"
                ? "CJDQuick"
                : pickup.source.toUpperCase()}
            </span>
            {pickup.original_order_number && (
              <span className="font-mono text-xs">
                Original: {pickup.original_order_number}
              </span>
            )}
            {pickup.external_order_id && (
              <span className="font-mono text-xs">
                Ref: {pickup.external_order_id}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{pickup.customer_name}</p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" /> {pickup.customer_phone}
                </p>
                {pickup.customer_email && (
                  <p className="text-sm text-muted-foreground">
                    {pickup.customer_email}
                  </p>
                )}
              </div>
              <div>
                <p className="flex items-center gap-1 text-sm font-medium">
                  <MapPin className="h-3 w-3" /> Pickup Address
                </p>
                <p className="text-sm text-muted-foreground">
                  {pickup.pickup_address}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[
                    pickup.pickup_city,
                    pickup.pickup_state,
                    pickup.pickup_postal_code,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Product */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" /> Product Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{pickup.product_description}</p>
              {pickup.product_sku && (
                <p className="text-sm text-muted-foreground">
                  SKU: {pickup.product_sku}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="rounded border p-2 text-center">
                  <p className="text-xs text-muted-foreground">Packages</p>
                  <p className="font-medium">{pickup.package_count}</p>
                </div>
                <div className="rounded border p-2 text-center">
                  <p className="text-xs text-muted-foreground">Weight</p>
                  <p className="font-medium">
                    {pickup.total_weight_kg
                      ? `${pickup.total_weight_kg} kg`
                      : "-"}
                  </p>
                </div>
              </div>
              {pickup.return_notes && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Notes: {pickup.return_notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" /> Assignment & Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pickup.driver_name && (
                <p className="text-sm">
                  Driver:{" "}
                  <span className="font-medium">{pickup.driver_name}</span>
                </p>
              )}
              {pickup.scheduled_date && (
                <p className="text-sm">
                  Scheduled:{" "}
                  <span className="font-medium">{pickup.scheduled_date}</span>
                </p>
              )}
              {pickup.pickup_slot && (
                <p className="text-sm">
                  Slot:{" "}
                  <span className="font-medium">{pickup.pickup_slot}</span>
                </p>
              )}

              <div className="pt-3 border-t space-y-1">
                <p className="text-xs text-muted-foreground">
                  Created: {new Date(pickup.created_at).toLocaleString()}
                </p>
                {pickup.assigned_at && (
                  <p className="text-xs text-muted-foreground">
                    Assigned: {new Date(pickup.assigned_at).toLocaleString()}
                  </p>
                )}
                {pickup.out_for_pickup_at && (
                  <p className="text-xs text-muted-foreground">
                    Out for pickup:{" "}
                    {new Date(pickup.out_for_pickup_at).toLocaleString()}
                  </p>
                )}
                {pickup.picked_up_at && (
                  <p className="text-xs text-green-600">
                    Picked up:{" "}
                    {new Date(pickup.picked_up_at).toLocaleString()}
                  </p>
                )}
                {pickup.received_at_hub_at && (
                  <p className="text-xs text-emerald-600">
                    Received at hub:{" "}
                    {new Date(pickup.received_at_hub_at).toLocaleString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Attempts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-4 w-4" /> Pickup Attempts (
                {pickup.attempts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pickup.attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pickup attempts yet
                </p>
              ) : (
                <div className="space-y-4">
                  {pickup.attempts.map((attempt) => (
                    <div key={attempt.id} className="rounded border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Attempt #{attempt.attempt_number}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            attempt.status === "picked_up"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {attempt.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Item Condition */}
                      {attempt.item_condition && (
                        <div className="mt-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              CONDITION_COLORS[attempt.item_condition] ||
                              "bg-gray-100"
                            }`}
                          >
                            Condition: {attempt.item_condition.replace(/_/g, " ")}
                          </span>
                          {attempt.item_condition_notes && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {attempt.item_condition_notes}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Condition Photos */}
                      {attempt.condition_photo_urls &&
                        attempt.condition_photo_urls.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground mb-1">
                              Condition Photos:
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              {attempt.condition_photo_urls.map(
                                (url, idx) => (
                                  <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <img
                                      src={url}
                                      alt={`Condition ${idx + 1}`}
                                      className="h-16 w-16 rounded object-cover border"
                                    />
                                  </a>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                      {attempt.failure_reason && (
                        <p className="text-sm text-red-600 mt-1">
                          Reason:{" "}
                          {attempt.failure_reason.replace(/_/g, " ")}
                        </p>
                      )}
                      {attempt.failure_notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {attempt.failure_notes}
                        </p>
                      )}
                      {attempt.otp_verified && (
                        <p className="text-xs text-green-600 mt-1">
                          OTP Verified
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(attempt.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
