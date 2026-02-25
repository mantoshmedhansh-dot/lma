'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Bell, Package, Tag, Shield, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const PREF_KEY = 'lma_notification_prefs';

const defaultPrefs = {
  order_updates: true,
  promotions: true,
  account_alerts: true,
};

export default function NotificationsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState(defaultPrefs);

  useEffect(() => {
    const saved = localStorage.getItem(PREF_KEY);
    if (saved) {
      try { setPrefs(JSON.parse(saved)); } catch {}
    }
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?redirect=/profile/notifications');
      return;
    }

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setNotifications(data || []);
    setLoading(false);
  };

  const togglePref = (key: keyof typeof defaultPrefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    localStorage.setItem(PREF_KEY, JSON.stringify(updated));
    toast({ title: 'Preferences updated' });
  };

  const markAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'order':
        return Package;
      case 'promotion':
        return Tag;
      case 'account':
        return Shield;
      default:
        return Bell;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const prefItems = [
    { key: 'order_updates' as const, label: 'Order Updates', desc: 'Status changes for your orders', icon: Package },
    { key: 'promotions' as const, label: 'Promotions', desc: 'Deals and offers from merchants', icon: Tag },
    { key: 'account_alerts' as const, label: 'Account Alerts', desc: 'Security and account activity', icon: Shield },
  ];

  return (
    <div className="container py-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/profile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Notifications</h1>
      </div>

      {/* Preferences */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {prefItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <button
                onClick={() => togglePref(item.key)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  prefs[item.key] ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    prefs[item.key] ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notification List */}
      <h2 className="text-lg font-semibold mb-4">Recent</h2>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const Icon = getTypeIcon(notif.type);
            return (
              <Card
                key={notif.id}
                className={`cursor-pointer transition-colors ${
                  !notif.is_read ? 'border-primary/30 bg-primary/5' : ''
                }`}
                onClick={() => !notif.is_read && markAsRead(notif.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`text-sm ${!notif.is_read ? 'font-semibold' : 'font-medium'}`}>
                          {notif.title}
                        </h3>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(notif.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {notif.body}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No notifications yet</h3>
            <p className="text-sm text-muted-foreground">
              You&apos;ll see order updates, promotions, and alerts here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
