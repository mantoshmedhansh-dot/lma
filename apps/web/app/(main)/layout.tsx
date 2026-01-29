import { Header } from '@/components/layout/header';
import { createClient } from '@/lib/supabase/server';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, avatar_url')
      .eq('id', user.id)
      .single();
    profile = data;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={profile} />
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 bg-muted/30">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} LMA. All rights reserved.
            </p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <a href="/terms" className="hover:text-foreground">Terms</a>
              <a href="/privacy" className="hover:text-foreground">Privacy</a>
              <a href="/help" className="hover:text-foreground">Help</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
