"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard/header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RotateCcw,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

interface Pickup {
  id: string;
  pickup_number: string;
  original_order_id: string | null;
  source: string;
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  pickup_city: string | null;
  product_description: string;
  total_weight_kg: number | null;
  status: string;
  return_reason: string | null;
  driver_id: string | null;
  scheduled_date: string | null;
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

export default function PickupsPage() {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    out_for_pickup: 0,
    picked_up: 0,
    received: 0,
  });

  const fetchPickups = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "50",
      });
      if (statusFilter) params.set("status", statusFilter);
      if (sourceFilter) params.set("source", sourceFilter);
      if (search) params.set("search", search);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/reverse-pickups?${params}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setPickups(data);

        // Compute stats from all pickups (unfiltered)
        if (!statusFilter && !sourceFilter && !search) {
          setStats({
            total: data.length,
            pending: data.filter(
              (p: Pickup) => p.status === "pickup_pending",
            ).length,
            out_for_pickup: data.filter(
              (p: Pickup) => p.status === "out_for_pickup",
            ).length,
            picked_up: data.filter(
              (p: Pickup) => p.status === "picked_up",
            ).length,
            received: data.filter(
              (p: Pickup) => p.status === "received_at_hub",
            ).length,
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch pickups:", err);
    }
    setLoading(false);
  }, [page, statusFilter, sourceFilter, search]);

  useEffect(() => {
    fetchPickups();
  }, [fetchPickups]);

  // Realtime updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("pickups-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reverse_pickups" },
        () => {
          fetchPickups();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPickups]);

  return (
    <div>
      <DashboardHeader
        title="Reverse Pickups"
        subtitle="Manage customer returns and pickups"
        actions={
          <Link href="/pickups/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Pickup
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Pending" value={stats.pending} />
          <StatCard label="Out for Pickup" value={stats.out_for_pickup} />
          <StatCard
            label="Picked Up"
            value={stats.picked_up}
            className="border-green-200"
          />
          <StatCard
            label="Received at Hub"
            value={stats.received}
            className="border-emerald-200"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by pickup #, name, phone..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchPickups()}
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="pickup_pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="out_for_pickup">Out for Pickup</option>
            <option value="picked_up">Picked Up</option>
            <option value="received_at_hub">Received at Hub</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Sources</option>
            <option value="cjdquick">CJDQuick</option>
            <option value="manual">Manual</option>
            <option value="api">API</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchPickups}>
            <Filter className="mr-2 h-4 w-4" />
            Apply
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">
                    Pickup #
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Address</th>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Reason</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Source</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Loading pickups...
                    </td>
                  </tr>
                ) : pickups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      <RotateCcw className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                      <p>No reverse pickups found</p>
                      <p className="text-xs mt-1">
                        Create a pickup manually or wait for CJDQuick returns
                      </p>
                    </td>
                  </tr>
                ) : (
                  pickups.map((pickup) => (
                    <tr
                      key={pickup.id}
                      className="border-b hover:bg-muted/30 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/pickups/${pickup.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {pickup.pickup_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">
                            {pickup.customer_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pickup.customer_phone}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">
                        {pickup.pickup_address}
                      </td>
                      <td className="px-4 py-3 max-w-[150px] truncate">
                        {pickup.product_description}
                      </td>
                      <td className="px-4 py-3 max-w-[120px] truncate text-muted-foreground">
                        {pickup.return_reason || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[pickup.status] || "bg-gray-100"}`}
                        >
                          {pickup.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(pickup.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {pickups.length} pickups
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pickups.length < 50}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
