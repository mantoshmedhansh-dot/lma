import { redirect } from 'next/navigation';
import { createClient, getMerchant } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

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
    .select('*')
    .eq('id', user.id)
    .single();

  // Get merchant
  const merchant = await getMerchant();

  if (!merchant) {
    redirect('/register');
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar merchant={merchant} />
      <div className="ml-64">
        <Header
          user={{
            email: profile?.email || user.email || '',
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
            avatar_url: profile?.avatar_url,
          }}
          merchant={merchant}
        />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
