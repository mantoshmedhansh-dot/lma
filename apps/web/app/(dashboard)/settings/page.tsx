'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Save } from 'lucide-react';

interface Hub {
  id: string;
  name: string;
  code: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
}

export default function SettingsPage() {
  const [hub, setHub] = useState<Hub | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchHub() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/hubs`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (res.ok) {
          const hubs = await res.json();
          if (hubs.length > 0) setHub(hubs[0]);
        }
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    fetchHub();
  }, []);

  const handleSave = useCallback(async () => {
    if (!hub) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/hubs/${hub.id}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: hub.name,
            address_line_1: hub.address_line_1,
            address_line_2: hub.address_line_2,
            city: hub.city,
            state: hub.state,
            postal_code: hub.postal_code,
            phone: hub.phone,
          }),
        }
      );
      if (res.ok) {
        alert('Hub settings saved');
      } else {
        alert('Failed to save');
      }
    } catch (err) { alert('Failed to save'); }
    setSaving(false);
  }, [hub]);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (!hub) {
    return (
      <div>
        <DashboardHeader title="Settings" />
        <div className="p-6">
          <p className="text-muted-foreground">No hub assigned. Contact an admin to set up your hub.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader
        title="Hub Settings"
        subtitle={`${hub.name} (${hub.code})`}
        actions={
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        }
      />

      <div className="p-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" /> Hub Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hub Name</Label>
                <Input
                  className="mt-1"
                  value={hub.name}
                  onChange={(e) => setHub({ ...hub, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Hub Code</Label>
                <Input className="mt-1" value={hub.code} disabled />
              </div>
            </div>
            <div>
              <Label>Address Line 1</Label>
              <Input
                className="mt-1"
                value={hub.address_line_1}
                onChange={(e) => setHub({ ...hub, address_line_1: e.target.value })}
              />
            </div>
            <div>
              <Label>Address Line 2</Label>
              <Input
                className="mt-1"
                value={hub.address_line_2 || ''}
                onChange={(e) => setHub({ ...hub, address_line_2: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>City</Label>
                <Input
                  className="mt-1"
                  value={hub.city}
                  onChange={(e) => setHub({ ...hub, city: e.target.value })}
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  className="mt-1"
                  value={hub.state}
                  onChange={(e) => setHub({ ...hub, state: e.target.value })}
                />
              </div>
              <div>
                <Label>Postal Code</Label>
                <Input
                  className="mt-1"
                  value={hub.postal_code}
                  onChange={(e) => setHub({ ...hub, postal_code: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                className="mt-1"
                value={hub.phone || ''}
                onChange={(e) => setHub({ ...hub, phone: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
