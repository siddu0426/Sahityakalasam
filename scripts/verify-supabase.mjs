import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

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
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function verify() {
  console.log(`Connecting to Supabase at: ${supabaseUrl}`);

  const tables = [
    'profiles',
    'payments',
    'upload_credits',
    'stories',
    'votes',
    'weekly_winners',
    'story_reports',
    'notifications',
  ];

  const results = {};
  let allTablesExist = true;

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        results[table] = `MISSING (${error.code}: ${error.message})`;
        allTablesExist = false;
      } else {
        results[table] = 'EXISTS (OK)';
      }
    } catch (err) {
      results[table] = `EXCEPTION: ${err.message}`;
      allTablesExist = false;
    }
  }

  console.table(results);

  if (allTablesExist) {
    console.log('✅ ALL TABLES EXIST AND ARE ACCESSIBLE!');
    process.exit(0);
  } else {
    console.log('❌ SOME OR ALL TABLES ARE MISSING. Please run the SQL migration in Supabase SQL Editor.');
    process.exit(2);
  }
}

verify();
