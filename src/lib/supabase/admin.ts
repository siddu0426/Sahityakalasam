import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

if (typeof window !== 'undefined') {
  throw new Error('CRITICAL SECURITY ERROR: supabase/admin cannot be imported in client-side code.');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let cachedAdminClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  cachedAdminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedAdminClient;
}

export const supabaseAdmin = supabaseUrl && serviceRoleKey ? getAdminClient() : null!;

