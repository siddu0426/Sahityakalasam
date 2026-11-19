import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient, User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase/admin';
import { Profile } from './types';

export interface AuthenticatedCaller {
  user: User;
  profile: Profile;
  role: 'listener' | 'narrator' | 'admin';
  token: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Extracts and verifies the caller's identity strictly from:
 * 1. `Authorization: Bearer <token>` header
 * 2. OR Supabase auth cookies via `@supabase/ssr`
 *
 * ZERO TRUST: Completely ignores `x-user-id`, `x-admin-id`, `kathalu_user_id`,
 * or any client-supplied body parameter.
 * Role is strictly derived from `public.profiles.role` in PostgreSQL.
 */
export async function getAuthenticatedUser(request?: Request): Promise<AuthenticatedCaller | null> {
  try {
    let token: string | null = null;

    // 1. Check Authorization Bearer header
    if (request) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.slice(7).trim();
      }
    }

    let user: User | null = null;

    if (token) {
      // Verify token with Supabase Auth
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (!error && data?.user) {
          user = data.user;
        }
      } else {
        // Fallback for non-admin client
        const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await client.auth.getUser(token);
        if (!error && data?.user) {
          user = data.user;
        }
      }
    } else {
      // 2. Check cookies via `@supabase/ssr`
      try {
        const cookieStore = cookies();
        const ssrClient = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() {},
            remove() {},
          },
        });
        const { data, error } = await ssrClient.auth.getUser();
        if (!error && data?.user) {
          user = data.user;
          // Retrieve session token from cookie store if available
          const sessionRes = await ssrClient.auth.getSession();
          token = sessionRes.data?.session?.access_token || '';
        }
      } catch {
        // cookies() may throw in certain edge environments without cookie context
      }
    }

    if (!user) {
      return null;
    }

    // Role MUST come from public.profiles table in the database
    let profile: Profile | null = null;

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data) {
        profile = data as Profile;
      }
    }

    // If profile row doesn't exist yet, construct base listener profile
    if (!profile) {
      profile = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
        username: user.user_metadata?.username || `user_${user.id.slice(0, 8)}`,
        avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.id}`,
        role: 'listener',
        show_age_city: false,
        is_minor: false,
        guardian_consent: false,
        created_at: user.created_at,
        updated_at: user.updated_at || user.created_at,
      };
    }

    const verifiedProfile: Profile = profile;
    const verifiedRole = (verifiedProfile.role as 'listener' | 'narrator' | 'admin') || 'listener';

    return {
      user,
      profile: verifiedProfile,
      role: verifiedRole,
      token: token || '',
    };
  } catch (err) {
    console.error('[getAuthenticatedUser error]:', err);
    return null;
  }
}

/**
 * Enforces that caller is authenticated. Returns 401 response if unauthenticated.
 */
export async function requireAuth(
  request?: Request
): Promise<{ caller: AuthenticatedCaller; response?: never } | { caller: null; response: NextResponse }> {
  const caller = await getAuthenticatedUser(request);
  if (!caller) {
    return {
      caller: null,
      response: NextResponse.json(
        { error: 'Unauthorized: Valid Supabase session or Bearer token required' },
        { status: 401 }
      ),
    };
  }
  return { caller };
}

/**
 * Enforces that caller is authenticated AND has role === 'admin'.
 * Returns 401 if unauthenticated, 403 if authenticated but not admin.
 */
export async function requireAdmin(
  request?: Request
): Promise<{ caller: AuthenticatedCaller; response?: never } | { caller: null; response: NextResponse }> {
  const caller = await getAuthenticatedUser(request);
  if (!caller) {
    return {
      caller: null,
      response: NextResponse.json(
        { error: 'Unauthorized: Valid Supabase session or Bearer token required' },
        { status: 401 }
      ),
    };
  }
  if (caller.role !== 'admin') {
    return {
      caller: null,
      response: NextResponse.json(
        { error: 'Forbidden: Administrator privileges required' },
        { status: 403 }
      ),
    };
  }
  return { caller };
}

/**
 * Creates a user-scoped Supabase client configured with the caller's JWT.
 * Postgres RLS and auth.uid() will evaluate to this user.
 */
export function createUserClient(token: string) {
  if (!token) {
    throw new Error('createUserClient requires a non-empty user JWT');
  }
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Generates signed playback/cover URLs for private storage buckets.
 */
export async function getSignedStorageUrl(
  bucket: 'story-audio' | 'story-covers',
  pathOrUrl: string,
  expiresIn = 3600
): Promise<string> {
  if (!pathOrUrl) return '';

  // Public asset or sample URL (e.g. /samples/..., https://...)
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const signMarker = `/storage/v1/object/sign/${bucket}/`;
    if (pathOrUrl.includes(signMarker)) return pathOrUrl; // already signed
    if (pathOrUrl.includes(marker)) {
      const relativePath = pathOrUrl.split(marker)[1];
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(relativePath, expiresIn);
        if (!error && data?.signedUrl) return data.signedUrl;
      }
    }
    return pathOrUrl;
  }

  // Local static asset
  if (pathOrUrl.startsWith('/') && !pathOrUrl.startsWith('/uploads')) {
    return pathOrUrl;
  }

  // Storage bucket path
  const cleanPath = pathOrUrl
    .replace(new RegExp(`^${bucket}/`), '')
    .replace(/^\/+/, '');

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(cleanPath, expiresIn);
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  }

  return pathOrUrl;
}

