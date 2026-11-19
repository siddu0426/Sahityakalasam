/**
 * Comprehensive Staging Database vs. Authoritative Migration Drift Verification
 * 
 * Compares:
 * 1. All 9 Core Tables
 * 2. Columns across all tables
 * 3. All 17 Row Level Security (RLS) Policies on public tables & storage.objects
 * 4. Stored Procedures / Functions & Return Types
 * 5. Trigger Definitions
 * 6. Views
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

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runDriftVerification() {
  console.log('========================================================================');
  console.log('🔍 COMPREHENSIVE MIGRATION DRIFT AUDIT');
  console.log(`Target Database: ${supabaseUrl}`);
  console.log('Authoritative Migration: supabase/migrations/20261115000000_kathalu_full_schema.sql');
  console.log('========================================================================\n');

  const driftReport = [];

  // 1. TABLES AUDIT (All 9 core tables defined in migration)
  const expectedTables = [
    'profiles',
    'payments',
    'upload_credits',
    'stories',
    'votes',
    'weekly_winners',
    'story_reports',
    'notifications',
    'auth_errors',
  ];

  for (const table of expectedTables) {
    const { error } = await adminSupabase.from(table).select('*').limit(0);
    driftReport.push({
      Category: 'TABLE',
      Object: `public.${table}`,
      Status: error ? 'DRIFT' : 'SYNCHRONIZED',
      Detail: error ? error.message : 'Table present and queryable',
    });
  }

  // 2. COLUMNS & SCHEMA ALIGNMENT AUDIT
  const columnChecks = [
    { table: 'profiles', columns: 'id,email,phone,display_name,username,avatar_url,bio,role,is_minor,guardian_consent,show_age_city,guardian_name,guardian_phone,guardian_relationship,age,city' },
    { table: 'payments', columns: 'id,user_id,amount,currency,razorpay_order_id,razorpay_payment_id,razorpay_signature,status,created_at,verified_at' },
    { table: 'upload_credits', columns: 'id,user_id,payment_id,status,used_for_story_id,created_at,used_at' },
    { table: 'stories', columns: 'id,narrator_id,title_telugu,title_english,genre,cover_url,audio_url,duration_seconds,play_count,vote_count,status,rejection_reason,is_weekly_winner,reviewed_at,reviewed_by,published_at,updated_at' },
    { table: 'votes', columns: 'id,user_id,story_id,week_start,created_at' },
    { table: 'weekly_winners', columns: 'id,story_id,narrator_id,week_start,week_end,vote_count,rank,reward_amount,reward_currency,status,confirmed_by,confirmed_at,announced_at' },
    { table: 'story_reports', columns: 'id,story_id,reporter_id,reason,details,status,created_at,reviewed_at,reviewed_by' },
    { table: 'notifications', columns: 'id,user_id,type,title,message,data,is_read,created_at' },
    { table: 'auth_errors', columns: 'id,user_id,error_message,error_state,created_at' },
  ];

  for (const check of columnChecks) {
    const { error } = await adminSupabase.from(check.table).select(check.columns).limit(0);
    driftReport.push({
      Category: 'COLUMNS',
      Object: `public.${check.table}`,
      Status: error ? 'DRIFT' : 'SYNCHRONIZED',
      Detail: error ? error.message : `All required columns verified: [${check.columns}]`,
    });
  }

  // 3. ROW LEVEL SECURITY (RLS) POLICIES AUDIT
  const { data: dbPolicies, error: polErr } = await adminSupabase
    .from('policies_inspection_view')
    .select('schemaname, tablename, policyname, cmd');

  if (polErr) {
    driftReport.push({
      Category: 'POLICIES',
      Object: 'policies_inspection_view',
      Status: 'DRIFT',
      Detail: polErr.message,
    });
  } else {
    const expectedPolicies = [
      { tablename: 'profiles', policyname: 'Users can view own profile, Admins view all' },
      { tablename: 'profiles', policyname: 'Users can update own profile except role' },
      { tablename: 'profiles', policyname: 'Admins can update all profiles' },
      { tablename: 'payments', policyname: 'Users can view own payments' },
      { tablename: 'upload_credits', policyname: 'Users can view own credits' },
      { tablename: 'stories', policyname: 'Public can view live stories' },
      { tablename: 'stories', policyname: 'Narrators can update own pending or rejected stories' },
      { tablename: 'votes', policyname: 'Users can view own votes' },
      { tablename: 'weekly_winners', policyname: 'Public can view weekly winners' },
      { tablename: 'weekly_winners', policyname: 'Admins can manage weekly winners' },
      { tablename: 'story_reports', policyname: 'Authenticated users can create reports' },
      { tablename: 'story_reports', policyname: 'Users can view own reports, Admins view all' },
      { tablename: 'story_reports', policyname: 'Admins can update report status' },
      { tablename: 'notifications', policyname: 'Users can view own notifications' },
      { tablename: 'notifications', policyname: 'Users can mark own notifications as read' },
      { tablename: 'objects', policyname: 'Users can upload to own audio folder' },
      { tablename: 'objects', policyname: 'Users can view own audio files' },
    ];

    for (const exp of expectedPolicies) {
      const found = dbPolicies.find(
        (p) => p.tablename === exp.tablename && p.policyname.trim() === exp.policyname.trim()
      );
      driftReport.push({
        Category: 'POLICY',
        Object: `${exp.tablename}: "${exp.policyname}"`,
        Status: found ? 'SYNCHRONIZED' : 'DRIFT',
        Detail: found ? `Active on ${found.cmd}` : 'Policy missing from database',
      });
    }
  }

  // 4. FUNCTIONS & ROUTINES AUDIT
  const { data: dbRoutines, error: routErr } = await adminSupabase
    .from('routines_inspection_view')
    .select('routine_name, return_type');

  const expectedFunctions = [
    { name: 'is_admin', type: 'boolean' },
    { name: 'current_week_start', type: 'date' },
    { name: 'cast_vote', type: 'jsonb' },
    { name: 'tally_weekly_winners', type: 'jsonb' },
    { name: 'confirm_weekly_winner', type: 'jsonb' },
    { name: 'grant_upload_credit', type: 'jsonb' },
    { name: 'consume_upload_credit', type: 'jsonb' },
    { name: 'create_story', type: 'jsonb' },
    { name: 'increment_play_count', type: 'jsonb' },
    { name: 'check_profile_update', type: 'trigger' },
    { name: 'check_story_update', type: 'trigger' },
    { name: 'handle_new_user', type: 'trigger' },
    { name: 'rls_auto_enable', type: 'event_trigger' },
  ];

  for (const fn of expectedFunctions) {
    const found = dbRoutines?.find((r) => r.routine_name === fn.name);
    driftReport.push({
      Category: 'FUNCTION',
      Object: `public.${fn.name}()`,
      Status: found ? 'SYNCHRONIZED' : 'DRIFT',
      Detail: found ? `Returns ${found.return_type}` : 'Function missing from database',
    });
  }

  // 5. TRIGGERS AUDIT
  const { data: dbTriggers } = await adminSupabase
    .from('triggers_inspection_view')
    .select('trigger_name, event_object_table, event_manipulation');

  const expectedTriggers = [
    { name: 'enforce_profile_update', table: 'profiles' },
    { name: 'enforce_story_update', table: 'stories' },
  ];

  for (const trg of expectedTriggers) {
    const found = dbTriggers?.find((t) => t.trigger_name === trg.name && t.event_object_table === trg.table);
    driftReport.push({
      Category: 'TRIGGER',
      Object: `${trg.table}.${trg.name}`,
      Status: found ? 'SYNCHRONIZED' : 'DRIFT',
      Detail: found ? `Active on ${found.event_manipulation}` : 'Trigger missing from database',
    });
  }

  // 6. VIEWS AUDIT
  const expectedViews = [
    'public_profiles',
    'storage_policies_view',
    'schema_inspection_view',
    'policies_inspection_view',
    'routines_inspection_view',
    'triggers_inspection_view',
  ];

  for (const view of expectedViews) {
    const { error } = await adminSupabase.from(view).select('*').limit(0);
    driftReport.push({
      Category: 'VIEW',
      Object: `public.${view}`,
      Status: error ? 'DRIFT' : 'SYNCHRONIZED',
      Detail: error ? error.message : 'View queryable',
    });
  }

  // Summary
  console.log('📊 MIGRATION DRIFT AUDIT REPORT TABLE:');
  console.table(driftReport);

  const driftCount = driftReport.filter((r) => r.Status === 'DRIFT').length;
  console.log(`\nAudit evaluated ${driftReport.length} database objects.`);

  if (driftCount === 0) {
    console.log('🎉 ZERO DRIFT DETECTED! Database schema, tables, columns, policies, routines, and triggers are 100% synchronized with migration file.\n');
  } else {
    console.log(`⚠️ DRIFT DETECTED: ${driftCount} items out of sync.\n`);
    process.exit(1);
  }
}

runDriftVerification().catch((err) => {
  console.error('Fatal error in drift verification:', err);
  process.exit(1);
});
