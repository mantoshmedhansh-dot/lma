'use client';

import { useEffect, useState } from 'react';

interface LiveStats {
  totalActive: number;
  byStatus: Record<string, number>;
  avgWaitTime: number;
  oldestPendingMinutes: number;
  recentlyCompleted: number;
  recentlyCancelled: number;
}

interface DriverStats {
  totalOnline: number;
  totalOnDelivery: number;
  totalIdle: number;
  totalOffline: number;
}

interface LiveStatusPanelProps {
  orderStats: LiveStats;
  driverStats: DriverStats;
  onRefresh?: () => void;
  autoRefreshInterval?: number;
}

export function LiveStatusPanel({
  orderStats,
  driverStats,
  onRefresh,
  autoRefreshInterval = 30000,
}: LiveStatusPanelProps) {
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    if (!onRefresh) return;

    const interval = setInterval(() => {
      onRefresh();
      setLastUpdate(new Date());
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [onRefresh, autoRefreshInterval]);

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    preparing: 'bg-purple-100 text-purple-800',
    ready_for_pickup: 'bg-indigo-100 text-indigo-800',
    driver_assigned: 'bg-cyan-100 text-cyan-800',
    picked_up: 'bg-teal-100 text-teal-800',
    in_transit: 'bg-orange-100 text-orange-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <span className="relative flex h-3 w-3 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <h3 className="text-lg font-semibold text-gray-900">Live Status</h3>
        </div>
        <span className="text-xs text-gray-500">
          Updated {lastUpdate.toLocaleTimeString()}
        </span>
      </div>

      {/* Order Stats */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Active Orders</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-3xl font-bold text-gray-900">{orderStats.totalActive}</p>
            <p className="text-sm text-gray-500">Total Active</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-3xl font-bold text-gray-900">{orderStats.avgWaitTime}<span className="text-base font-normal text-gray-500">m</span></p>
            <p className="text-sm text-gray-500">Avg Wait Time</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(orderStats.byStatus).map(([status, count]) => (
            <span
              key={status}
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                statusColors[status] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {formatStatus(status)}: {count}
            </span>
          ))}
        </div>

        {orderStats.oldestPendingMinutes > 30 && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ Oldest pending order: {orderStats.oldestPendingMinutes} minutes
            </p>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Last 5 Minutes</h4>
        <div className="flex gap-4">
          <div className="flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            <span className="text-sm text-gray-600">
              {orderStats.recentlyCompleted} completed
            </span>
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
            <span className="text-sm text-gray-600">
              {orderStats.recentlyCancelled} cancelled
            </span>
          </div>
        </div>
      </div>

      {/* Driver Stats */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Driver Status</h4>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{driverStats.totalOnline}</p>
            <p className="text-xs text-gray-500">Online</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{driverStats.totalOnDelivery}</p>
            <p className="text-xs text-gray-500">Delivering</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">{driverStats.totalIdle}</p>
            <p className="text-xs text-gray-500">Idle</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-400">{driverStats.totalOffline}</p>
            <p className="text-xs text-gray-500">Offline</p>
          </div>
        </div>

        {/* Utilization Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Driver Utilization</span>
            <span>
              {Math.round(
                (driverStats.totalOnDelivery /
                  Math.max(driverStats.totalOnline + driverStats.totalOnDelivery, 1)) *
                  100
              )}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${
                  (driverStats.totalOnDelivery /
                    Math.max(driverStats.totalOnline + driverStats.totalOnDelivery, 1)) *
                  100
                }%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
