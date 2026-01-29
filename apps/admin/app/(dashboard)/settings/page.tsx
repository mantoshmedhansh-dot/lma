'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import {
  Settings,
  Store,
  Clock,
  DollarSign,
  MapPin,
  Phone,
  Mail,
  Image as ImageIcon,
  Save,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface MerchantSettings {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  logo_url: string | null;
  cover_image_url: string | null;
  address: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  contact_phone: string | null;
  contact_email: string | null;
  preparation_time: number;
  minimum_order: number;
  delivery_fee: number;
  is_open: boolean;
  opening_hours: Record<string, { open: string; close: string; closed: boolean }>;
}

const defaultOpeningHours = {
  monday: { open: '09:00', close: '22:00', closed: false },
  tuesday: { open: '09:00', close: '22:00', closed: false },
  wednesday: { open: '09:00', close: '22:00', closed: false },
  thursday: { open: '09:00', close: '22:00', closed: false },
  friday: { open: '09:00', close: '22:00', closed: false },
  saturday: { open: '10:00', close: '23:00', closed: false },
  sunday: { open: '10:00', close: '22:00', closed: false },
};

const businessTypes = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'grocery', label: 'Grocery Store' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'convenience', label: 'Convenience Store' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'other', label: 'Other' },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [merchant, setMerchant] = useState<MerchantSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'hours' | 'delivery'>('general');
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchMerchant();
  }, []);

  const fetchMerchant = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('owner_id', user.id)
        .single();

      if (error) throw error;

      setMerchant({
        ...data,
        opening_hours: data.opening_hours || defaultOpeningHours,
        address: data.address || {
          street: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'India',
        },
      });
    } catch (error) {
      console.error('Error fetching merchant:', error);
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!merchant) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('merchants')
        .update({
          name: merchant.name,
          description: merchant.description,
          type: merchant.type,
          logo_url: merchant.logo_url,
          cover_image_url: merchant.cover_image_url,
          address: merchant.address,
          contact_phone: merchant.contact_phone,
          contact_email: merchant.contact_email,
          preparation_time: merchant.preparation_time,
          minimum_order: merchant.minimum_order,
          delivery_fee: merchant.delivery_fee,
          is_open: merchant.is_open,
          opening_hours: merchant.opening_hours,
        })
        .eq('id', merchant.id);

      if (error) throw error;

      toast({
        title: 'Settings saved',
        description: 'Your store settings have been updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    if (!merchant) return;
    setMerchant({ ...merchant, [field]: value });
  };

  const updateAddress = (field: string, value: string) => {
    if (!merchant) return;
    setMerchant({
      ...merchant,
      address: { ...merchant.address, [field]: value },
    });
  };

  const updateOpeningHours = (day: string, field: string, value: string | boolean) => {
    if (!merchant) return;
    setMerchant({
      ...merchant,
      opening_hours: {
        ...merchant.opening_hours,
        [day]: { ...merchant.opening_hours[day], [field]: value },
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Merchant not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your store settings
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['general', 'hours', 'delivery'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="bg-card rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Store className="w-4 h-4" />
                Store Information
              </h3>

              <div className="space-y-2">
                <label className="text-sm font-medium">Store Name</label>
                <Input
                  value={merchant.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Your store name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Business Type</label>
                <select
                  value={merchant.type}
                  onChange={(e) => updateField('type', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {businessTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={merchant.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Describe your store..."
                  className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Store Status</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateField('is_open', true)}
                    className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium ${
                      merchant.is_open
                        ? 'bg-green-100 border-green-300 text-green-800'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => updateField('is_open', false)}
                    className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium ${
                      !merchant.is_open
                        ? 'bg-red-100 border-red-300 text-red-800'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    Closed
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Images
              </h3>

              <div className="space-y-2">
                <label className="text-sm font-medium">Logo URL</label>
                <Input
                  value={merchant.logo_url || ''}
                  onChange={(e) => updateField('logo_url', e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Cover Image URL</label>
                <Input
                  value={merchant.cover_image_url || ''}
                  onChange={(e) => updateField('cover_image_url', e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Contact Information
              </h3>

              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={merchant.contact_phone || ''}
                  onChange={(e) => updateField('contact_phone', e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={merchant.contact_email || ''}
                  onChange={(e) => updateField('contact_email', e.target.value)}
                  placeholder="store@example.com"
                />
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Address
              </h3>

              <div className="space-y-2">
                <label className="text-sm font-medium">Street Address</label>
                <Input
                  value={merchant.address.street}
                  onChange={(e) => updateAddress('street', e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">City</label>
                  <Input
                    value={merchant.address.city}
                    onChange={(e) => updateAddress('city', e.target.value)}
                    placeholder="Mumbai"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">State</label>
                  <Input
                    value={merchant.address.state}
                    onChange={(e) => updateAddress('state', e.target.value)}
                    placeholder="Maharashtra"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Postal Code</label>
                <Input
                  value={merchant.address.postal_code}
                  onChange={(e) => updateAddress('postal_code', e.target.value)}
                  placeholder="400001"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Opening Hours */}
      {activeTab === 'hours' && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4" />
            Opening Hours
          </h3>

          <div className="space-y-3">
            {Object.entries(merchant.opening_hours).map(([day, hours]) => (
              <div key={day} className="flex items-center gap-4">
                <span className="w-24 font-medium capitalize">{day}</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!hours.closed}
                    onChange={(e) => updateOpeningHours(day, 'closed', !e.target.checked)}
                    className="rounded border-input"
                  />
                  <span className="text-sm">Open</span>
                </label>
                {!hours.closed && (
                  <>
                    <Input
                      type="time"
                      value={hours.open}
                      onChange={(e) => updateOpeningHours(day, 'open', e.target.value)}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={hours.close}
                      onChange={(e) => updateOpeningHours(day, 'close', e.target.value)}
                      className="w-32"
                    />
                  </>
                )}
                {hours.closed && (
                  <span className="text-muted-foreground">Closed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery Settings */}
      {activeTab === 'delivery' && (
        <div className="bg-card rounded-lg border p-4 space-y-4 max-w-lg">
          <h3 className="font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Delivery Settings
          </h3>

          <div className="space-y-2">
            <label className="text-sm font-medium">Preparation Time (minutes)</label>
            <Input
              type="number"
              value={merchant.preparation_time}
              onChange={(e) => updateField('preparation_time', parseInt(e.target.value) || 0)}
              placeholder="30"
            />
            <p className="text-xs text-muted-foreground">
              Average time to prepare an order
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Minimum Order Amount (₹)</label>
            <Input
              type="number"
              value={merchant.minimum_order}
              onChange={(e) => updateField('minimum_order', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Set to 0 for no minimum
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Delivery Fee (₹)</label>
            <Input
              type="number"
              value={merchant.delivery_fee}
              onChange={(e) => updateField('delivery_fee', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Set to 0 for free delivery
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
