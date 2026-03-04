"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RefreshCw,
  Save,
  Plug,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface IntegrationConfig {
  hub_id: string;
  provider: string;
  is_active: boolean;
  api_key_encrypted?: string;
  webhook_secret?: string;
  location_id?: string;
  last_synced_at?: string;
}

interface SyncStatus {
  configured: boolean;
  is_active: boolean;
  last_synced_at: string | null;
  total_synced_orders: number;
  recent_logs: Array<{
    id: string;
    direction: string;
    event_type: string;
    external_id: string;
    status: string;
    error_message: string | null;
    created_at: string;
  }>;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function IntegrationsPage() {
  const [hubId, setHubId] = useState<string>("");
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Form state
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [locationId, setLocationId] = useState("");
  const [isActive, setIsActive] = useState(false);

  const getToken = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || "";
  }, []);

  const fetchHubAndConfig = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) return;

    try {
      // Get hub
      const hubRes = await fetch(`${API}/api/v1/hubs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!hubRes.ok) return;
      const hubs = await hubRes.json();
      if (!hubs.length) return;
      const hId = hubs[0].id;
      setHubId(hId);

      // Get config
      const configRes = await fetch(
        `${API}/api/v1/integrations/cjdquick/config?hub_id=${hId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (configRes.ok) {
        const cfg = await configRes.json();
        setConfig(cfg);
        setLocationId(cfg.location_id || "");
        setIsActive(cfg.is_active || false);
      }

      // Get status
      const statusRes = await fetch(
        `${API}/api/v1/integrations/cjdquick/status?hub_id=${hId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (statusRes.ok) {
        setSyncStatus(await statusRes.json());
      }
    } catch (err) {
      console.error("Failed to load integration config:", err);
    }
    setLoading(false);
  }, [getToken]);

  useEffect(() => {
    fetchHubAndConfig();
  }, [fetchHubAndConfig]);

  const handleSave = async () => {
    setSaving(true);
    const token = await getToken();

    try {
      const body: Record<string, unknown> = {
        is_active: isActive,
        location_id: locationId,
      };
      if (apiKey) body.api_key = apiKey;
      if (webhookSecret) body.webhook_secret = webhookSecret;

      const res = await fetch(
        `${API}/api/v1/integrations/cjdquick/config?hub_id=${hubId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (res.ok) {
        setApiKey("");
        setWebhookSecret("");
        await fetchHubAndConfig();
      }
    } catch (err) {
      console.error("Failed to save config:", err);
    }
    setSaving(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    const token = await getToken();

    try {
      const res = await fetch(
        `${API}/api/v1/integrations/cjdquick/sync?hub_id=${hubId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const data = await res.json();
        alert(
          `Sync complete: ${data.synced} orders synced, ${data.skipped} skipped`,
        );
        await fetchHubAndConfig();
      }
    } catch (err) {
      console.error("Sync failed:", err);
    }
    setSyncing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const webhookUrl = `${API}/api/v1/integrations/cjdquick/webhook`;

  return (
    <div>
      <DashboardHeader
        title="CJDQuick OMS Integration"
        subtitle="Connect your hub to CJDQuick Order Management System"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing || !isActive}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6 max-w-3xl">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Settings
        </Link>

        {/* Status Banner */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Plug className="h-5 w-5" />
                <div>
                  <p className="font-medium">CJDQuick OMS</p>
                  <p className="text-xs text-muted-foreground">
                    Order sync & delivery status updates
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isActive ? (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <XCircle className="h-4 w-4" /> Inactive
                  </span>
                )}
              </div>
            </div>
            {syncStatus && (
              <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">
                    Total Synced Orders
                  </p>
                  <p className="font-medium">
                    {syncStatus.total_synced_orders}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Last Synced</p>
                  <p className="font-medium">
                    {syncStatus.last_synced_at
                      ? new Date(syncStatus.last_synced_at).toLocaleString()
                      : "Never"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">
                    API Configured
                  </p>
                  <p className="font-medium">
                    {syncStatus.configured ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Label className="w-24">Enabled</Label>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  isActive ? "bg-green-500" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
                    isActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div>
              <Label>API Key</Label>
              <Input
                className="mt-1 font-mono text-sm"
                type="password"
                placeholder={
                  config?.api_key_encrypted
                    ? config.api_key_encrypted
                    : "Enter CJDQuick API key"
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Bearer token for authenticating with CJDQuick API
              </p>
            </div>

            <div>
              <Label>Webhook Secret</Label>
              <Input
                className="mt-1 font-mono text-sm"
                type="password"
                placeholder="Enter HMAC webhook secret"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                HMAC-SHA256 secret for verifying incoming webhooks
              </p>
            </div>

            <div>
              <Label>CJDQuick Location ID</Label>
              <Input
                className="mt-1 font-mono text-sm"
                placeholder="Warehouse/location UUID in CJDQuick"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maps this hub to a CJDQuick warehouse location
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Webhook URL */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook Endpoint</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Register this URL in CJDQuick to receive order events:
            </p>
            <code className="block bg-muted rounded-md px-3 py-2 text-sm font-mono break-all">
              {webhookUrl}
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              Subscribe to events: order.created, order.confirmed,
              order.cancelled, return.approved
            </p>
          </CardContent>
        </Card>

        {/* Sync Log */}
        {syncStatus && syncStatus.recent_logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Sync Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {syncStatus.recent_logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {log.status === "success" ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {log.direction === "inbound" ? "IN" : "OUT"}
                      </span>
                      <span>{log.event_type}</span>
                      {log.external_id && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {log.external_id.slice(0, 12)}...
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
