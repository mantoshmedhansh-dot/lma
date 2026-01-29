import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Admin client with service role key (bypasses RLS)
export const supabaseAdmin = createClient(env.supabase.url, env.supabase.serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Create a client for a specific user (respects RLS)
export function createUserClient(accessToken: string) {
  return createClient(env.supabase.url, env.supabase.serviceKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
