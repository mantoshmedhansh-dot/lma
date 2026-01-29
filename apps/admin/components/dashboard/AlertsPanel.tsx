'use client';

import { useState } from 'react';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
}

interface AlertsPanelProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
  loading?: boolean;
  maxVisible?: number;
}

export function AlertsPanel({
  alerts,
  onAcknowledge,
  loading = false,
  maxVisible = 5,
}: AlertsPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const visibleAlerts = showAll ? alerts : alerts.slice(0, maxVisible);
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  const severityConfig = {
    info: {
      icon: InformationCircleIcon,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-500',
      textColor: 'text-blue-800',
    },
    warning: {
      icon: ExclamationTriangleIcon,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-500',
      textColor: 'text-yellow-800',
    },
    critical: {
      icon: XCircleIcon,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-500',
      textColor: 'text-red-800',
    },
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-5 w-32 bg-gray-200 rounded mb-4"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="mb-3 p-4 bg-gray-50 rounded-lg">
              <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center">
          <h3 className="text-lg font-semibold text-gray-900">Alerts</h3>
          {unacknowledgedCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
              {unacknowledgedCount} new
            </span>
          )}
        </div>
        {alerts.length > maxVisible && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showAll ? 'Show Less' : `View All (${alerts.length})`}
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {visibleAlerts.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <CheckCircleIcon className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500">No active alerts</p>
          </div>
        ) : (
          visibleAlerts.map((alert) => {
            const config = severityConfig[alert.severity];
            const Icon = config.icon;

            return (
              <div
                key={alert.id}
                className={`px-6 py-4 ${alert.acknowledged ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start">
                  <div
                    className={`p-2 rounded-lg ${config.bgColor} mr-4 flex-shrink-0`}
                  >
                    <Icon className={`h-5 w-5 ${config.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${config.textColor}`}>
                        {alert.title}
                      </p>
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                        {formatTime(alert.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                    {alert.data && Object.keys(alert.data).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(alert.data).map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
                          >
                            {formatKey(key)}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                    {!alert.acknowledged && (
                      <button
                        onClick={() => onAcknowledge(alert.id)}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return new Date(date).toLocaleDateString();
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
