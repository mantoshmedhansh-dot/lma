'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Package,
  Route,
  Truck,
  MapPin,
  BarChart3,
  Settings,
  Upload,
  Users,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/orders', label: 'Orders', icon: Package },
  { href: '/orders/import', label: 'Import Orders', icon: Upload },
  { href: '/routes', label: 'Routes', icon: Route },
  { href: '/routes/plan', label: 'Route Planning', icon: LayoutDashboard },
  { href: '/fleet', label: 'Vehicles', icon: Truck },
  { href: '/fleet/drivers', label: 'Drivers', icon: Users },
  { href: '/tracking', label: 'Live Tracking', icon: MapPin },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  hubName?: string;
  userEmail?: string;
}

export function Sidebar({ hubName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/orders" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            DH
          </div>
          <span className="text-lg font-bold">Delivery Hub</span>
        </Link>
      </div>

      {/* Hub name */}
      {hubName && (
        <div className="border-b px-6 py-3">
          <p className="text-xs text-muted-foreground">Current Hub</p>
          <p className="text-sm font-medium truncate">{hubName}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t p-4">
        {userEmail && (
          <p className="mb-2 truncate text-xs text-muted-foreground">{userEmail}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
