import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User,
  MapPin,
  CreditCard,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Package,
  Heart,
  Settings,
} from 'lucide-react';

export const metadata = {
  title: 'Profile',
  description: 'Manage your account settings',
};

const menuItems = [
  {
    title: 'Account',
    items: [
      { label: 'Personal Information', icon: User, href: '/profile/edit' },
      { label: 'Saved Addresses', icon: MapPin, href: '/profile/addresses' },
      { label: 'Payment Methods', icon: CreditCard, href: '/profile/payments' },
    ],
  },
  {
    title: 'Activity',
    items: [
      { label: 'Order History', icon: Package, href: '/orders' },
      { label: 'Favorites', icon: Heart, href: '/favorites' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { label: 'Notifications', icon: Bell, href: '/profile/notifications' },
      { label: 'App Settings', icon: Settings, href: '/profile/settings' },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Help Center', icon: HelpCircle, href: '/help' },
      { label: 'Privacy & Security', icon: Shield, href: '/privacy' },
    ],
  },
];

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/profile');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  // Get order stats
  const { count: totalOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', user.id);

  return (
    <div className="container py-8 max-w-2xl">
      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="text-2xl">
                {profile?.first_name?.[0]}{profile?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">
                {profile?.first_name} {profile?.last_name}
              </h1>
              <p className="text-muted-foreground">{profile?.email}</p>
              {profile?.phone && (
                <p className="text-sm text-muted-foreground">{profile.phone}</p>
              )}
            </div>
            <Link href="/profile/edit">
              <Button variant="outline">Edit Profile</Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold">{totalOrders || 0}</p>
              <p className="text-sm text-muted-foreground">Orders</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Favorites</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Reviews</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu Sections */}
      {menuItems.map((section) => (
        <Card key={section.title} className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {section.items.map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors ${
                  index !== section.items.length - 1 ? 'border-b' : ''
                }`}
              >
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Sign Out */}
      <Card>
        <CardContent className="p-0">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-3 px-6 py-3 w-full text-left text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </button>
          </form>
        </CardContent>
      </Card>

      {/* App Info */}
      <div className="text-center mt-8 text-sm text-muted-foreground">
        <p>LMA v0.1.0</p>
        <p className="mt-1">Made with care for fast deliveries</p>
      </div>
    </div>
  );
}
