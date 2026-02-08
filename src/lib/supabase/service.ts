/**
 * Supabase Service Role Client
 * Use this client for server-side admin operations that bypass RLS.
 * Only use in trusted server contexts (cron jobs, webhooks, etc.)
 */

import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
