'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Settings,
  DollarSign,
  Percent,
  Clock,
  Bell,
  Shield,
  Globe,
  Truck,
  Save,
} from 'lucide-react';

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    platformName: 'LMA',
    defaultCommission: 15,
    minOrderAmount: 100,
    maxDeliveryDistance: 10,
    deliveryFeePerKm: 5,
    baseDeliveryFee: 20,
    orderTimeout: 30,
    driverAssignmentRadius: 5,
    supportEmail: 'support@lma.com',
    supportPhone: '+91 98765 43210',
  });

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
  };

  const updateSetting = (key: string, value: string | number) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <div>
      <Header title="Settings" description="Configure platform settings" />

      <div className="p-6 space-y-6">
        {/* Platform Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              <CardTitle>Platform Settings</CardTitle>
            </div>
            <CardDescription>General platform configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Platform Name</label>
                <Input
                  value={settings.platformName}
                  onChange={(e) => updateSetting('platformName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Support Email</label>
                <Input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => updateSetting('supportEmail', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Support Phone</label>
                <Input
                  value={settings.supportPhone}
                  onChange={(e) => updateSetting('supportPhone', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Commission Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              <CardTitle>Commission Settings</CardTitle>
            </div>
            <CardDescription>Configure merchant commission rates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Commission (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.defaultCommission}
                  onChange={(e) => updateSetting('defaultCommission', parseFloat(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Applied to new merchants. Individual rates can be set per merchant.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Minimum Order Amount (₹)</label>
                <Input
                  type="number"
                  min="0"
                  value={settings.minOrderAmount}
                  onChange={(e) => updateSetting('minOrderAmount', parseFloat(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Global minimum order value for all merchants.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              <CardTitle>Delivery Settings</CardTitle>
            </div>
            <CardDescription>Configure delivery parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Delivery Distance (km)</label>
                <Input
                  type="number"
                  min="1"
                  value={settings.maxDeliveryDistance}
                  onChange={(e) => updateSetting('maxDeliveryDistance', parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Base Delivery Fee (₹)</label>
                <Input
                  type="number"
                  min="0"
                  value={settings.baseDeliveryFee}
                  onChange={(e) => updateSetting('baseDeliveryFee', parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Delivery Fee per km (₹)</label>
                <Input
                  type="number"
                  min="0"
                  value={settings.deliveryFeePerKm}
                  onChange={(e) => updateSetting('deliveryFeePerKm', parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Driver Assignment Radius (km)</label>
                <Input
                  type="number"
                  min="1"
                  value={settings.driverAssignmentRadius}
                  onChange={(e) => updateSetting('driverAssignmentRadius', parseFloat(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum distance to search for available drivers.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <CardTitle>Order Settings</CardTitle>
            </div>
            <CardDescription>Configure order timeouts and limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Order Confirmation Timeout (minutes)</label>
                <Input
                  type="number"
                  min="1"
                  value={settings.orderTimeout}
                  onChange={(e) => updateSetting('orderTimeout', parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Time merchants have to confirm or reject an order.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <CardTitle>Notification Settings</CardTitle>
            </div>
            <CardDescription>Configure system notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Order Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Send push notifications for order updates
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Marketing Emails</p>
                  <p className="text-sm text-muted-foreground">
                    Allow promotional emails to users
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Admin Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts for critical system events
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle>Security Settings</CardTitle>
            </div>
            <CardDescription>Security and access configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    Require 2FA for admin accounts
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Session Timeout</p>
                  <p className="text-sm text-muted-foreground">
                    Auto-logout after inactivity (30 minutes)
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">IP Whitelisting</p>
                  <p className="text-sm text-muted-foreground">
                    Restrict admin access to specific IPs
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
