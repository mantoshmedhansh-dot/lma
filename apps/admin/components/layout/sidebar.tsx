'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  BarChart3,
  Settings,
  Store,
  Bell,
  HelpCircle,
} from 'lucide-react';

const navItems = [
  {
    title: 'Orders',
    href: '/orders',
    icon: ShoppingBag,
  },
  {
    title: 'Menu',
    href: '/menu',
    icon: UtensilsCrossed,
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

interface SidebarProps {
  merchant: {
    business_name: string;
    logo_url: string | null;
  };
}

export function Sidebar({ merchant }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            {merchant.logo_url ? (
              <img
                src={merchant.logo_url}
                alt={merchant.business_name}
                className="h-full w-full rounded-lg object-cover"
              />
            ) : (
              merchant.business_name[0]
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{merchant.business_name}</p>
            <p className="text-xs text-muted-foreground">Merchant Dashboard</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        {/* Footer Links */}
        <div className="border-t p-4 space-y-1">
          <Link
            href="/help"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <HelpCircle className="h-5 w-5" />
            Help & Support
          </Link>
        </div>
      </div>
    </aside>
  );
}
