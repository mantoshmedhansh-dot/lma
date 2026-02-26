import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/dashboard/sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('role, email, first_name, last_name')
    .eq('id', user.id)
    .single();

  const role = profile?.role;

  // Only allow hub_manager, admin, super_admin
  if (role && !['hub_manager', 'admin', 'super_admin'].includes(role)) {
    redirect('/login?message=Access denied. Hub manager or admin role required.');
  }

  // Get hub name for hub managers
  let hubName: string | undefined;
  if (role === 'hub_manager') {
    const { data: hub } = await supabase
      .from('hubs')
      .select('name')
      .eq('manager_id', user.id)
      .limit(1)
      .single();
    hubName = hub?.name;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar hubName={hubName} userEmail={profile?.email || user.email} />
      <main className="flex-1 overflow-y-auto bg-muted/30">
        {children}
      </main>
    </div>
  );
}
