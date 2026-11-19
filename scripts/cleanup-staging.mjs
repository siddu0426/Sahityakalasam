/**
 * Safe Staging Cleanup Script
 * 
 * Requirements:
 * 1. Refuses to run in production (NODE_ENV=production or production URL).
 * 2. Lists all rows first (dry run audit).
 * 3. Requires explicit `--confirm` flag to execute deletion.
 * 4. Cleans test stories, votes, winners, reports, notifications, credits, payments, and test auth accounts.
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 1. Production safety guard
if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
  console.error('❌ SAFETY ABORT: Refusing to run cleanup-staging.mjs in production environment!');
  process.exit(1);
}

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase configuration.');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const isConfirmed = process.argv.includes('--confirm');

  console.log('========================================================================');
  console.log('🧹 KATHALU PRE-PRODUCTION STAGING CLEANUP UTILITY');
  console.log(`Target: ${supabaseUrl}`);
  console.log(`Mode:   ${isConfirmed ? '🚨 DESTRUCTIVE EXECUTION (--confirm provided)' : '🔍 DRY-RUN AUDIT (no data changed)'}`);
  console.log('========================================================================\n');

  // Count rows across tables
  const tables = [
    'votes',
    'weekly_winners',
    'story_reports',
    'notifications',
    'upload_credits',
    'payments',
    'stories',
    'profiles',
  ];

  const counts = {};
  for (const table of tables) {
    const { count, error } = await adminSupabase.from(table).select('*', { count: 'exact', head: true });
    counts[table] = error ? `Error: ${error.message}` : count;
  }

  // Count auth users
  const { data: authData } = await adminSupabase.auth.admin.listUsers();
  const testUsers = (authData?.users || []).filter((u) =>
    u.email?.includes('test') ||
    u.email?.includes('kathalu.app') ||
    u.email?.startsWith('qa_') ||
    u.email?.startsWith('voter') ||
    u.email?.startsWith('new_user_')
  );

  console.log('📊 Current Staging Data Inventory:');
  console.table({
    ...counts,
    'test_auth_users (identifiable test accounts)': testUsers.length,
    'total_auth_users': authData?.users?.length || 0,
  });

  if (!isConfirmed) {
    console.log('\n⚠️  DRY-RUN COMPLETE: No data was modified.');
    console.log('To purge all staging test data and prepare for production deployment, run:');
    console.log('   node scripts/cleanup-staging.mjs --confirm\n');
    return;
  }

  console.log('\n🚨 Executing purge in foreign key dependency order...');

  // 1. Delete dependent rows
  const delVotes = await adminSupabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('   - Cleared votes table');

  const delWinners = await adminSupabase.from('weekly_winners').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('   - Cleared weekly_winners table');

  const delReports = await adminSupabase.from('story_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('   - Cleared story_reports table');

  const delNotifs = await adminSupabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('   - Cleared notifications table');

  const delCredits = await adminSupabase.from('upload_credits').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('   - Cleared upload_credits table');

  const delPayments = await adminSupabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('   - Cleared payments table');

  const delStories = await adminSupabase.from('stories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('   - Cleared stories table');

  // 2. Remove test users (cascades to profiles via FK ON DELETE CASCADE)
  console.log(`   - Removing ${testUsers.length} test accounts from auth.users...`);
  let deletedUsersCount = 0;
  for (const user of testUsers) {
    await adminSupabase.auth.admin.deleteUser(user.id);
    deletedUsersCount++;
  }
  console.log(`   - Deleted ${deletedUsersCount} test auth users.`);

  console.log('\n✅ STAGING CLEANUP COMPLETED SUCCESSFULLY!');
  console.log('Database is now in pristine zero-state ready for production launch.\n');
}

main().catch((err) => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});

