import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/explore';

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if user profile exists, create if not
      const { data: existingProfile } = await supabase
        .from('users')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (!existingProfile) {
        // Create profile from OAuth data
        await supabase.from('users').insert({
          id: data.user.id,
          email: data.user.email,
          first_name: data.user.user_metadata?.full_name?.split(' ')[0] || 'User',
          last_name: data.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
          avatar_url: data.user.user_metadata?.avatar_url,
          role: 'customer',
          is_email_verified: true,
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with some instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`);
}
