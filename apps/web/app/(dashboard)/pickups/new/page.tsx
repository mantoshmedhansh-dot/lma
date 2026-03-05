"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Search, Package, User, MapPin } from "lucide-react";

export default function NewPickupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lookupOrderId, setLookupOrderId] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    original_order_id: "",
    return_reason: "",
    return_notes: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    pickup_address: "",
    pickup_city: "",
    pickup_state: "",
    pickup_postal_code: "",
    product_description: "",
    product_sku: "",
    package_count: "1",
    total_weight_kg: "",
    scheduled_date: "",
    pickup_slot: "",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLookupOrder = async () => {
    if (!lookupOrderId.trim()) return;
    setLookingUp(true);
    setLookupResult(null);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      // Search by order number or ID
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/hub-orders?search=${encodeURIComponent(lookupOrderId)}&page_size=1`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (res.ok) {
        const orders = await res.json();
        if (orders.length > 0) {
          const order = orders[0];
          setForm({
            original_order_id: order.id,
            return_reason: "",
            return_notes: "",
            customer_name: order.customer_name || "",
            customer_phone: order.customer_phone || "",
            customer_email: order.customer_email || "",
            pickup_address: order.delivery_address || "",
            pickup_city: order.delivery_city || "",
            pickup_state: order.delivery_state || "",
            pickup_postal_code: order.delivery_postal_code || "",
            product_description: order.product_description || "",
            product_sku: order.product_sku || "",
            package_count: String(order.package_count || 1),
            total_weight_kg: order.total_weight_kg
              ? String(order.total_weight_kg)
              : "",
            scheduled_date: "",
            pickup_slot: "",
          });
          setLookupResult(
            `Found order ${order.order_number} - fields auto-filled`,
          );
        } else {
          setLookupResult("No order found with that number");
        }
      }
    } catch (err) {
      setLookupResult("Failed to lookup order");
    }
    setLookingUp(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    // Get user's hub
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single();

    let hubId: string | null = null;
    if (profile?.role === "hub_manager") {
      const { data: hub } = await supabase
        .from("hubs")
        .select("id")
        .eq("manager_id", session.user.id)
        .limit(1)
        .single();
      hubId = hub?.id || null;
    }

    if (!hubId) {
      alert("Could not determine hub. Please contact admin.");
      setLoading(false);
      return;
    }

    try {
      const body: Record<string, any> = {
        hub_id: hubId,
        source: "manual",
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        pickup_address: form.pickup_address,
        product_description: form.product_description,
      };

      if (form.original_order_id) body.original_order_id = form.original_order_id;
      if (form.return_reason) body.return_reason = form.return_reason;
      if (form.return_notes) body.return_notes = form.return_notes;
      if (form.customer_email) body.customer_email = form.customer_email;
      if (form.pickup_city) body.pickup_city = form.pickup_city;
      if (form.pickup_state) body.pickup_state = form.pickup_state;
      if (form.pickup_postal_code) body.pickup_postal_code = form.pickup_postal_code;
      if (form.product_sku) body.product_sku = form.product_sku;
      if (form.package_count) body.package_count = parseInt(form.package_count);
      if (form.total_weight_kg) body.total_weight_kg = parseFloat(form.total_weight_kg);
      if (form.scheduled_date) body.scheduled_date = form.scheduled_date;
      if (form.pickup_slot) body.pickup_slot = form.pickup_slot;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/reverse-pickups`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (res.ok) {
        const created = await res.json();
        router.push(`/pickups/${created.id}`);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Failed to create pickup");
      }
    } catch (err) {
      console.error("Failed to create pickup:", err);
      alert("Failed to create pickup");
    }
    setLoading(false);
  };

  return (
    <div>
      <DashboardHeader
        title="New Reverse Pickup"
        actions={
          <Link href="/pickups">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Pickups
            </Button>
          </Link>
        }
      />

      <div className="p-6 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order Lookup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4" /> Lookup Original Order (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Enter an order number to auto-fill customer and product details
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Order number (e.g. DH-XXXXX)"
                  value={lookupOrderId}
                  onChange={(e) => setLookupOrderId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleLookupOrder())}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLookupOrder}
                  disabled={lookingUp}
                >
                  {lookingUp ? "Looking..." : "Lookup"}
                </Button>
              </div>
              {lookupResult && (
                <p className="text-sm text-muted-foreground">{lookupResult}</p>
              )}
            </CardContent>
          </Card>

          {/* Return Reason */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Return Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Return Reason</Label>
                <select
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.return_reason}
                  onChange={(e) => updateField("return_reason", e.target.value)}
                >
                  <option value="">Select reason...</option>
                  <option value="Defective product">Defective product</option>
                  <option value="Wrong item delivered">Wrong item delivered</option>
                  <option value="Customer changed mind">Customer changed mind</option>
                  <option value="Size/fit issue">Size/fit issue</option>
                  <option value="Quality not as expected">Quality not as expected</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <Label>Notes</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                  placeholder="Additional notes about the return..."
                  value={form.return_notes}
                  onChange={(e) => updateField("return_notes", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Customer Name *</Label>
                  <Input
                    required
                    className="mt-1"
                    value={form.customer_name}
                    onChange={(e) =>
                      updateField("customer_name", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input
                    required
                    className="mt-1"
                    value={form.customer_phone}
                    onChange={(e) =>
                      updateField("customer_phone", e.target.value)
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  className="mt-1"
                  value={form.customer_email}
                  onChange={(e) =>
                    updateField("customer_email", e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Pickup Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" /> Pickup Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Address *</Label>
                <Input
                  required
                  className="mt-1"
                  value={form.pickup_address}
                  onChange={(e) =>
                    updateField("pickup_address", e.target.value)
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>City</Label>
                  <Input
                    className="mt-1"
                    value={form.pickup_city}
                    onChange={(e) => updateField("pickup_city", e.target.value)}
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <Input
                    className="mt-1"
                    value={form.pickup_state}
                    onChange={(e) =>
                      updateField("pickup_state", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Postal Code</Label>
                  <Input
                    className="mt-1"
                    value={form.pickup_postal_code}
                    onChange={(e) =>
                      updateField("pickup_postal_code", e.target.value)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" /> Product Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Product Description *</Label>
                <Input
                  required
                  className="mt-1"
                  value={form.product_description}
                  onChange={(e) =>
                    updateField("product_description", e.target.value)
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>SKU</Label>
                  <Input
                    className="mt-1"
                    value={form.product_sku}
                    onChange={(e) =>
                      updateField("product_sku", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Packages</Label>
                  <Input
                    type="number"
                    min="1"
                    className="mt-1"
                    value={form.package_count}
                    onChange={(e) =>
                      updateField("package_count", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    className="mt-1"
                    value={form.total_weight_kg}
                    onChange={(e) =>
                      updateField("total_weight_kg", e.target.value)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scheduling */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scheduling</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Scheduled Date</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={form.scheduled_date}
                    onChange={(e) =>
                      updateField("scheduled_date", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Pickup Slot</Label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.pickup_slot}
                    onChange={(e) =>
                      updateField("pickup_slot", e.target.value)
                    }
                  >
                    <option value="">Any time</option>
                    <option value="9:00-12:00">Morning (9:00-12:00)</option>
                    <option value="12:00-15:00">Afternoon (12:00-15:00)</option>
                    <option value="15:00-18:00">Evening (15:00-18:00)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Reverse Pickup"}
            </Button>
            <Link href="/pickups">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
