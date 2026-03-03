"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, RefreshCw, Truck, User } from "lucide-react";

interface RouteStop {
  id: string;
  status: string;
  sequence: number;
  order: {
    customer_name: string;
    delivery_address: string;
    status: string;
  } | null;
}

interface ActiveRoute {
  id: string;
  route_name: string | null;
  status: string;
  total_stops: number;
  driver_id: string | null;
  driver_name?: string;
  completed_stops: number;
  failed_stops: number;
  stops: RouteStop[];
}

const STOP_STATUS_COLORS: Record<string, string> = {
  pending: "#3B82F6",
  arrived: "#F59E0B",
  delivered: "#22C55E",
  failed: "#EF4444",
};

function TrackingMap({ routes }: { routes: ActiveRoute[] }) {
  const [GoogleMap, setGoogleMap] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [InfoWindow, setInfoWindow] = useState<any>(null);
  const [useLoadScript, setUseLoadScript] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);

  useEffect(() => {
    import("@react-google-maps/api").then((mod) => {
      setGoogleMap(() => mod.GoogleMap);
      setMarker(() => mod.Marker);
      setInfoWindow(() => mod.InfoWindow);
      setUseLoadScript(
        () => () =>
          mod.useLoadScript({
            googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "",
          }),
      );
      setLoaded(true);
    });
  }, []);

  if (!loaded || !useLoadScript) return <MapPlaceholder />;

  return (
    <MapInner
      routes={routes}
      GoogleMap={GoogleMap}
      Marker={Marker}
      InfoWindow={InfoWindow}
      useLoadScript={useLoadScript}
      selectedStop={selectedStop}
      setSelectedStop={setSelectedStop}
    />
  );
}

function MapInner({
  routes,
  GoogleMap,
  Marker,
  InfoWindow,
  useLoadScript,
  selectedStop,
  setSelectedStop,
}: any) {
  const { isLoaded } = useLoadScript();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        Loading map...
      </div>
    );
  }

  const allStops = routes.flatMap((r: ActiveRoute) =>
    (r.stops || []).filter((s: RouteStop) => s.order?.delivery_address),
  );

  // Default center (India)
  const defaultCenter = { lat: 20.5937, lng: 78.9629 };

  return (
    <GoogleMap
      mapContainerStyle={{
        width: "100%",
        height: "400px",
        borderRadius: "8px",
      }}
      center={defaultCenter}
      zoom={5}
      options={{
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
      }}
    >
      {allStops.map((stop: RouteStop) => {
        const color = STOP_STATUS_COLORS[stop.status] || "#6B7280";
        return (
          <Marker
            key={stop.id}
            position={defaultCenter}
            label={{
              text: String(stop.sequence),
              color: "#fff",
              fontSize: "12px",
              fontWeight: "bold",
            }}
            icon={{
              path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
              fillColor: color,
              fillOpacity: 1,
              strokeWeight: 1,
              strokeColor: "#fff",
              scale: 1.5,
              anchor: { x: 12, y: 22 } as any,
              labelOrigin: { x: 12, y: 9 } as any,
            }}
            onClick={() => setSelectedStop(stop)}
          />
        );
      })}

      {selectedStop && selectedStop.order && (
        <InfoWindow
          position={defaultCenter}
          onCloseClick={() => setSelectedStop(null)}
        >
          <div style={{ padding: "4px", maxWidth: "200px" }}>
            <p style={{ fontWeight: "bold", marginBottom: "4px" }}>
              {selectedStop.order.customer_name}
            </p>
            <p style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
              {selectedStop.order.delivery_address}
            </p>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "4px",
                backgroundColor:
                  STOP_STATUS_COLORS[selectedStop.status] || "#6B7280",
                color: "#fff",
              }}
            >
              {selectedStop.status.replace(/_/g, " ")}
            </span>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}

function MapPlaceholder() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-2">
            Live map will be shown here when Google Maps API is configured
          </p>
          <p className="text-xs mt-1">
            Configure NEXT_PUBLIC_GOOGLE_MAPS_KEY in environment
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TrackingPage() {
  const [routes, setRoutes] = useState<ActiveRoute[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveRoutes = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const today = new Date().toISOString().split("T")[0];

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/routes?route_date=${today}&status=in_progress`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        const enriched: ActiveRoute[] = [];
        for (const route of data) {
          const detailRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/routes/${route.id}`,
            { headers: { Authorization: `Bearer ${session.access_token}` } },
          );
          if (detailRes.ok) {
            const detail = await detailRes.json();
            enriched.push({
              id: route.id,
              route_name: route.route_name,
              status: route.status,
              total_stops: route.total_stops,
              driver_id: route.driver_id,
              driver_name: detail.driver_name,
              completed_stops: (detail.stops || []).filter(
                (s: any) => s.status === "delivered",
              ).length,
              failed_stops: (detail.stops || []).filter(
                (s: any) => s.status === "failed",
              ).length,
              stops: (detail.stops || []).map((s: any) => ({
                id: s.id,
                status: s.status,
                sequence: s.sequence,
                order: s.order || null,
              })),
            });
          }
        }
        setRoutes(enriched);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchActiveRoutes();
  }, [fetchActiveRoutes]);

  // Supabase Realtime: auto-refresh on route_stops and delivery_attempts changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("tracking-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "route_stops" },
        () => {
          fetchActiveRoutes();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_attempts" },
        () => {
          fetchActiveRoutes();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActiveRoutes]);

  const hasGoogleMapsKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  return (
    <div>
      <DashboardHeader
        title="Live Tracking"
        subtitle="Track active routes and drivers"
        actions={
          <Button variant="outline" size="sm" onClick={fetchActiveRoutes}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Map */}
        {hasGoogleMapsKey ? (
          <Card>
            <CardContent className="p-0 overflow-hidden rounded-lg">
              <TrackingMap routes={routes} />
            </CardContent>
          </Card>
        ) : (
          <MapPlaceholder />
        )}

        {/* Active Routes */}
        <h2 className="text-lg font-semibold">
          Active Routes ({routes.length})
        </h2>

        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        ) : routes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Truck className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-2">No active routes right now</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {routes.map((route) => {
              const progress =
                route.total_stops > 0
                  ? Math.round(
                      ((route.completed_stops + route.failed_stops) /
                        route.total_stops) *
                        100,
                    )
                  : 0;

              return (
                <Card key={route.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">
                        {route.route_name || "Route"}
                      </h3>
                      <span className="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-xs font-medium">
                        In Progress
                      </span>
                    </div>

                    {route.driver_name && (
                      <p className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" /> {route.driver_name}
                      </p>
                    )}

                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>
                          {route.completed_stops}/{route.total_stops} delivered
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                        <div
                          className="h-full bg-green-500"
                          style={{
                            width: `${(route.completed_stops / Math.max(route.total_stops, 1)) * 100}%`,
                          }}
                        />
                        <div
                          className="h-full bg-red-500"
                          style={{
                            width: `${(route.failed_stops / Math.max(route.total_stops, 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {route.failed_stops > 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        {route.failed_stops} failed
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
