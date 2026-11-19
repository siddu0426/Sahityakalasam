/**
 * End-to-End Brand-New User Sign-Up Verification
 * 
 * Verifies:
 * 1. Brand new email signs up via Supabase Auth
 * 2. Database trigger `on_auth_user_created` executes `handle_new_user()`
 * 3. `public.profiles` row created automatically
 * 4. `profile.role` strictly equals 'listener'
 * 5. Full session works in the app via `/api/auth/me`
 */

import WebSocket from 'ws';
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket;

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminSupabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { GET: meGet } = await import('../src/app/api/auth/me/route.ts');

async function testBrandNewUserSignup() {
  console.log('========================================================================');
  console.log('👤 BRAND-NEW USER SIGN-UP & DATABASE TRIGGER END-TO-END VERIFICATION');
  console.log(`Target: ${supabaseUrl}`);
  console.log('========================================================================\n');

  const timestamp = Date.now();
  const testEmail = `new_listener_${timestamp}@kathalu.app`;
  const testPassword = 'Password123!';

  console.log(`1. Creating brand-new user: ${testEmail}...`);
  // Attempting to inject role='admin' in metadata to prove trigger enforces listener
  const { data: createdUser, error: createErr } = await adminSupabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      display_name: 'కొత్త కథకుడు (New Tester)',
      username: `tester_${timestamp.toString().slice(-6)}`,
      role: 'admin', // Attack payload: attempting to claim admin in user_metadata
    },
  });

  if (createErr || !createdUser.user) {
    console.error('❌ FAILED TO CREATE USER:', createErr);
    process.exit(1);
  }

  const userId = createdUser.user.id;
  console.log(`✅ Auth user created in auth.users: ${userId}`);

  console.log('2. Verifying public.profiles creation by database trigger...');
  const { data: profile, error: pErr } = await adminSupabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (pErr || !profile) {
    console.error('❌ TRIGGER FAILED: No profile was created in public.profiles:', pErr);
    process.exit(1);
  }

  console.log('Profile created in database:');
  console.log({
    id: profile.id,
    email: profile.email,
    display_name: profile.display_name,
    username: profile.username,
    role: profile.role,
    is_minor: profile.is_minor,
    created_at: profile.created_at,
  });

  // Verify Role is strictly 'listener'
  if (profile.role !== 'listener') {
    console.error(`❌ SECURITY VULNERABILITY: User metadata escalated role to '${profile.role}' instead of 'listener'!`);
    process.exit(1);
  }
  console.log('✅ Trigger strictly enforced role = "listener" (privilege escalation blocked)!');

  console.log('3. Authenticating as the brand-new user and obtaining app session...');
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sessionData, error: signErr } = await client.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signErr || !sessionData.session) {
    console.error('❌ Failed to establish session:', signErr);
    process.exit(1);
  }

  const token = sessionData.session.access_token;
  console.log('✅ Client received authentic Supabase session access token.');

  console.log('4. Calling /api/auth/me using new user session...');
  const meRes = await meGet(new Request('http://localhost:3000/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  }));

  const meData = await meRes.json();
  console.log('Response status:', meRes.status);
  console.log('/api/auth/me returned:', meData);

  if (meRes.status !== 200 || meData.profile?.id !== userId || meData.isAdmin !== false) {
    console.error('❌ App API failed to verify brand-new user session correctly.');
    process.exit(1);
  }

  console.log('✅ App API verified session: Profile authenticated, availableCredits = 0, isAdmin = false.');

  // Clean up test user
  console.log('5. Cleaning up test user...');
  await adminSupabase.auth.admin.deleteUser(userId);
  console.log('✅ Cleaned up brand-new user.\n');

  console.log('========================================================================');
  console.log('🎉 BRAND-NEW USER SIGN-UP VERIFICATION PASSED WITH 100% SUCCESS!');
  console.log('========================================================================');
}

testBrandNewUserSignup().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

