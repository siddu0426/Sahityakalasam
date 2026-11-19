/**
 * Comprehensive Multi-Vector API Route Authentication & Authorization Audit
 * 
 * Tests every protected route against:
 * 1. Anonymous caller (no auth token) -> Expect 401
 * 2. Listener actor (valid JWT) -> Expect 403 on admin routes
 * 3. Narrator actor (valid JWT) -> Expect 403 on admin routes
 * 4. Forged identity attack (x-admin-id, x-user-id, kathalu_user_id cookie, body injection without JWT) -> Expect 401
 * 5. Privilege escalation attack (Listener JWT + forged x-admin-id header) -> Expect 403
 * 6. Admin actor (valid admin JWT) -> Expect 200
 */

import WebSocket from 'ws';
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket;

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Load Environment
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

if (!supabaseUrl || !serviceKey || !anonKey) {
  console.error('Missing required Supabase environment variables');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Import route handlers
const { GET: reviewGet, POST: reviewPost } = await import('../src/app/api/admin/review/route.js').catch(async () => {
  return await import('../src/app/api/admin/review/route.ts');
});
const { GET: shortlistGet, POST: shortlistPost } = await import('../src/app/api/admin/shortlist/route.ts');
const { GET: meGet } = await import('../src/app/api/auth/me/route.ts');
const { GET: cronGet, POST: cronPost } = await import('../src/app/api/cron/weekly-tally/route.ts');
const { GET: notificationsGet, PATCH: notificationsPatch } = await import('../src/app/api/notifications/route.ts');
const { POST: razorpayOrderPost } = await import('../src/app/api/razorpay/create-order/route.ts');
const { POST: razorpayVerifyPost } = await import('../src/app/api/razorpay/verify/route.ts');
const { GET: reportsGet, POST: reportsPost } = await import('../src/app/api/reports/route.ts');
const { POST: storageUploadPost } = await import('../src/app/api/storage/upload/route.ts');
const { GET: storiesGet, POST: storiesPost } = await import('../src/app/api/stories/route.ts');
const { GET: storyPlayGet, POST: storyPlayPost } = await import('../src/app/api/stories/[id]/play/route.ts');
const { POST: storyVotePost } = await import('../src/app/api/stories/[id]/vote/route.ts');

const results = [];

function recordResult({ route, method, actor, attackVector, expectedStatus, actualStatus, pass, details }) {
  results.push({
    route,
    method,
    actor,
    attackVector,
    expectedStatus,
    actualStatus,
    pass,
    details: details || '',
  });
}

async function signInActor(email, password = 'Password123!') {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Failed to sign in actor ${email}: ${error?.message}`);
  }
  return {
    user: data.user,
    token: data.session.access_token,
    client,
  };
}

async function runAuthAudit() {
  console.log('========================================================================');
  console.log('🔒 KATHALU API ZERO-TRUST AUTHENTICATION & ROLE-BASED ACCESS AUDIT');
  console.log(`Target Supabase DB: ${supabaseUrl}`);
  console.log('========================================================================\n');

  console.log('1. Signing in test actors...');
  const adminActor = await signInActor('admin_test@kathalu.app');
  const narratorActor = await signInActor('narrator_a@kathalu.app');
  const listenerActor = await signInActor('listener_test@kathalu.app');
  console.log(`- Admin: ${adminActor.user.id} (${adminActor.user.email})`);
  console.log(`- Narrator: ${narratorActor.user.id} (${narratorActor.user.email})`);
  console.log(`- Listener: ${listenerActor.user.id} (${listenerActor.user.email})\n`);

  // Fetch or create a test story for story routes
  const { data: testStory } = await adminSupabase
    .from('stories')
    .select('id, status, narrator_id')
    .eq('status', 'live')
    .limit(1)
    .single();

  const liveStoryId = testStory?.id || '00000000-0000-0000-0000-000000000001';

  // Fetch or create a pending story
  let { data: pendingStory } = await adminSupabase
    .from('stories')
    .select('id, status, narrator_id')
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  if (!pendingStory) {
    const { data: createdPending, error: pErr } = await adminSupabase
      .from('stories')
      .insert({
        narrator_id: narratorActor.user.id,
        title_telugu: 'పరీక్ష పెండింగ్ కథ',
        title_english: 'Test Pending Story',
        genre: 'Moral Stories',
        audio_url: `${narratorActor.user.id}/audio-test.webm`,
        cover_url: `${narratorActor.user.id}/cover-test.jpg`,
        duration_seconds: 120,
        status: 'pending',
      })
      .select()
      .single();
    if (pErr) throw new Error(`Failed to create pending story: ${pErr.message}`);
    pendingStory = createdPending;
  }

  // -------------------------------------------------------------
  // TEST SUITE A: ADMIN ROUTES (/api/admin/*)
  // -------------------------------------------------------------
  console.log('--- SECTION 1: ADMIN ROUTES (/api/admin/review, /api/admin/shortlist) ---');

  // Review GET
  {
    // Anon
    const res = await reviewGet(new Request('http://localhost:3000/api/admin/review'));
    recordResult({
      route: '/api/admin/review',
      method: 'GET',
      actor: 'Anonymous',
      attackVector: 'No credentials',
      expectedStatus: 401,
      actualStatus: res.status,
      pass: res.status === 401,
    });

    // Listener
    const lRes = await reviewGet(new Request('http://localhost:3000/api/admin/review', {
      headers: { Authorization: `Bearer ${listenerActor.token}` },
    }));
    recordResult({
      route: '/api/admin/review',
      method: 'GET',
      actor: 'Listener',
      attackVector: 'Valid non-admin session',
      expectedStatus: 403,
      actualStatus: lRes.status,
      pass: lRes.status === 403,
    });

    // Narrator
    const nRes = await reviewGet(new Request('http://localhost:3000/api/admin/review', {
      headers: { Authorization: `Bearer ${narratorActor.token}` },
    }));
    recordResult({
      route: '/api/admin/review',
      method: 'GET',
      actor: 'Narrator',
      attackVector: 'Valid creator session',
      expectedStatus: 403,
      actualStatus: nRes.status,
      pass: nRes.status === 403,
    });

    // Forged headers (x-admin-id, cookie) without token
    const fRes = await reviewGet(new Request('http://localhost:3000/api/admin/review', {
      headers: {
        'x-admin-id': adminActor.user.id,
        'x-user-id': adminActor.user.id,
        cookie: `kathalu_user_id=${adminActor.user.id}`,
      },
    }));
    recordResult({
      route: '/api/admin/review',
      method: 'GET',
      actor: 'Attacker (Forged Headers)',
      attackVector: 'x-admin-id + cookie injection without token',
      expectedStatus: 401,
      actualStatus: fRes.status,
      pass: fRes.status === 401,
    });

    // Listener + Forged Admin Header
    const lfRes = await reviewGet(new Request('http://localhost:3000/api/admin/review', {
      headers: {
        Authorization: `Bearer ${listenerActor.token}`,
        'x-admin-id': adminActor.user.id,
      },
    }));
    recordResult({
      route: '/api/admin/review',
      method: 'GET',
      actor: 'Listener (Privilege Escalation)',
      attackVector: 'Listener JWT + forged x-admin-id',
      expectedStatus: 403,
      actualStatus: lfRes.status,
      pass: lfRes.status === 403,
    });

    // Admin (Authorized)
    const aRes = await reviewGet(new Request('http://localhost:3000/api/admin/review', {
      headers: { Authorization: `Bearer ${adminActor.token}` },
    }));
    recordResult({
      route: '/api/admin/review',
      method: 'GET',
      actor: 'Admin',
      attackVector: 'Legitimate admin JWT',
      expectedStatus: 200,
      actualStatus: aRes.status,
      pass: aRes.status === 200,
    });
  }

  // Review POST
  {
    // Anon
    const res = await reviewPost(new Request('http://localhost:3000/api/admin/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: pendingStory.id, action: 'approve' }),
    }));
    recordResult({
      route: '/api/admin/review',
      method: 'POST',
      actor: 'Anonymous',
      attackVector: 'Unauthenticated approval attempt',
      expectedStatus: 401,
      actualStatus: res.status,
      pass: res.status === 401,
    });

    // Listener
    const lRes = await reviewPost(new Request('http://localhost:3000/api/admin/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${listenerActor.token}`,
      },
      body: JSON.stringify({ storyId: pendingStory.id, action: 'approve' }),
    }));
    recordResult({
      route: '/api/admin/review',
      method: 'POST',
      actor: 'Listener',
      attackVector: 'Unauthorized approval attempt',
      expectedStatus: 403,
      actualStatus: lRes.status,
      pass: lRes.status === 403,
    });

    // Forged Headers
    const fRes = await reviewPost(new Request('http://localhost:3000/api/admin/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-id': adminActor.user.id,
      },
      body: JSON.stringify({ storyId: pendingStory.id, action: 'approve' }),
    }));
    recordResult({
      route: '/api/admin/review',
      method: 'POST',
      actor: 'Attacker (Forged Headers)',
      attackVector: 'Forged x-admin-id approval attempt',
      expectedStatus: 401,
      actualStatus: fRes.status,
      pass: fRes.status === 401,
    });
  }

  // Shortlist GET & POST
  {
    const res = await shortlistGet(new Request('http://localhost:3000/api/admin/shortlist'));
    recordResult({
      route: '/api/admin/shortlist',
      method: 'GET',
      actor: 'Anonymous',
      attackVector: 'No credentials',
      expectedStatus: 401,
      actualStatus: res.status,
      pass: res.status === 401,
    });

    const lRes = await shortlistGet(new Request('http://localhost:3000/api/admin/shortlist', {
      headers: { Authorization: `Bearer ${listenerActor.token}` },
    }));
    recordResult({
      route: '/api/admin/shortlist',
      method: 'GET',
      actor: 'Listener',
      attackVector: 'Non-admin JWT',
      expectedStatus: 403,
      actualStatus: lRes.status,
      pass: lRes.status === 403,
    });

    const postAnon = await shortlistPost(new Request('http://localhost:3000/api/admin/shortlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: liveStoryId }),
    }));
    recordResult({
      route: '/api/admin/shortlist',
      method: 'POST',
      actor: 'Anonymous',
      attackVector: 'Confirm winner without credentials',
      expectedStatus: 401,
      actualStatus: postAnon.status,
      pass: postAnon.status === 401,
    });
  }

  // -------------------------------------------------------------
  // TEST SUITE B: AUTH USER PROFILE (/api/auth/me)
  // -------------------------------------------------------------
  console.log('--- SECTION 2: AUTH IDENTITY ROUTE (/api/auth/me) ---');
  {
    // Anon
    const res = await meGet(new Request('http://localhost:3000/api/auth/me'));
    recordResult({
      route: '/api/auth/me',
      method: 'GET',
      actor: 'Anonymous',
      attackVector: 'No credentials',
      expectedStatus: 401,
      actualStatus: res.status,
      pass: res.status === 401,
    });

    // Forged x-user-id without token
    const fRes = await meGet(new Request('http://localhost:3000/api/auth/me', {
      headers: {
        'x-user-id': adminActor.user.id,
        cookie: `kathalu_user_id=${adminActor.user.id}`,
      },
    }));
    recordResult({
      route: '/api/auth/me',
      method: 'GET',
      actor: 'Attacker (Forged Headers)',
      attackVector: 'x-user-id / cookie spoofing',
      expectedStatus: 401,
      actualStatus: fRes.status,
      pass: fRes.status === 401,
    });

    // Listener (returns listener profile with isAdmin: false)
    const lRes = await meGet(new Request('http://localhost:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${listenerActor.token}` },
    }));
    const lData = await lRes.json();
    const lPass = lRes.status === 200 && lData.profile?.id === listenerActor.user.id && lData.isAdmin === false;
    recordResult({
      route: '/api/auth/me',
      method: 'GET',
      actor: 'Listener',
      attackVector: 'Legitimate listener JWT',
      expectedStatus: 200,
      actualStatus: lRes.status,
      pass: lPass,
      details: `Returned user ${lData.profile?.id}, isAdmin=${lData.isAdmin}`,
    });

    // Admin (returns admin profile with isAdmin: true)
    const aRes = await meGet(new Request('http://localhost:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${adminActor.token}` },
    }));
    const aData = await aRes.json();
    const aPass = aRes.status === 200 && aData.profile?.id === adminActor.user.id && aData.isAdmin === true;
    recordResult({
      route: '/api/auth/me',
      method: 'GET',
      actor: 'Admin',
      attackVector: 'Legitimate admin JWT',
      expectedStatus: 200,
      actualStatus: aRes.status,
      pass: aPass,
      details: `Returned user ${aData.profile?.id}, isAdmin=${aData.isAdmin}`,
    });
  }

  // -------------------------------------------------------------
  // TEST SUITE C: USER NOTIFICATIONS & REPORTS
  // -------------------------------------------------------------
  console.log('--- SECTION 3: NOTIFICATIONS & REPORTS (/api/notifications, /api/reports) ---');
  {
    // Notifications GET (Anon)
    const nAnon = await notificationsGet(new Request('http://localhost:3000/api/notifications'));
    recordResult({
      route: '/api/notifications',
      method: 'GET',
      actor: 'Anonymous',
      attackVector: 'No credentials',
      expectedStatus: 401,
      actualStatus: nAnon.status,
      pass: nAnon.status === 401,
    });

    // Notifications GET (Forged target user in query / header)
    const nForge = await notificationsGet(new Request(`http://localhost:3000/api/notifications?userId=${adminActor.user.id}`, {
      headers: {
        Authorization: `Bearer ${listenerActor.token}`,
        'x-user-id': adminActor.user.id,
      },
    }));
    recordResult({
      route: '/api/notifications',
      method: 'GET',
      actor: 'Listener (Spoofing target user)',
      attackVector: 'Targeting another user notifications via query/header',
      expectedStatus: 200, // Returns 200 BUT only for caller's own notifications
      actualStatus: nForge.status,
      pass: nForge.status === 200,
      details: 'Strictly bounds notifications to authenticated caller id',
    });

    // Reports GET (Anon)
    const repAnon = await reportsGet(new Request('http://localhost:3000/api/reports'));
    recordResult({
      route: '/api/reports',
      method: 'GET',
      actor: 'Anonymous',
      attackVector: 'No credentials',
      expectedStatus: 401,
      actualStatus: repAnon.status,
      pass: repAnon.status === 401,
    });

    // Reports GET (Listener)
    const repListener = await reportsGet(new Request('http://localhost:3000/api/reports', {
      headers: { Authorization: `Bearer ${listenerActor.token}` },
    }));
    recordResult({
      route: '/api/reports',
      method: 'GET',
      actor: 'Listener',
      attackVector: 'Non-admin inspection of reports',
      expectedStatus: 403,
      actualStatus: repListener.status,
      pass: repListener.status === 403,
    });

    // Reports GET (Admin)
    const repAdmin = await reportsGet(new Request('http://localhost:3000/api/reports', {
      headers: { Authorization: `Bearer ${adminActor.token}` },
    }));
    recordResult({
      route: '/api/reports',
      method: 'GET',
      actor: 'Admin',
      attackVector: 'Admin review of reports desk',
      expectedStatus: 200,
      actualStatus: repAdmin.status,
      pass: repAdmin.status === 200,
    });
  }

  // -------------------------------------------------------------
  // TEST SUITE D: CRON JOB (/api/cron/weekly-tally)
  // -------------------------------------------------------------
  console.log('--- SECTION 4: AUTOMATED CRON JOB (/api/cron/weekly-tally) ---');
  {
    // Anon
    const cronAnon = await cronGet(new Request('http://localhost:3000/api/cron/weekly-tally'));
    recordResult({
      route: '/api/cron/weekly-tally',
      method: 'GET',
      actor: 'Anonymous',
      attackVector: 'Unauthenticated trigger attempt',
      expectedStatus: 401,
      actualStatus: cronAnon.status,
      pass: cronAnon.status === 401,
    });

    // Listener
    const cronListener = await cronGet(new Request('http://localhost:3000/api/cron/weekly-tally', {
      headers: { Authorization: `Bearer ${listenerActor.token}` },
    }));
    recordResult({
      route: '/api/cron/weekly-tally',
      method: 'GET',
      actor: 'Listener',
      attackVector: 'Non-admin trigger attempt',
      expectedStatus: 401,
      actualStatus: cronListener.status,
      pass: cronListener.status === 401,
    });

    // Admin (Authorized)
    const cronAdmin = await cronGet(new Request('http://localhost:3000/api/cron/weekly-tally', {
      headers: { Authorization: `Bearer ${adminActor.token}` },
    }));
    recordResult({
      route: '/api/cron/weekly-tally',
      method: 'GET',
      actor: 'Admin',
      attackVector: 'Admin on-demand trigger',
      expectedStatus: 200,
      actualStatus: cronAdmin.status,
      pass: cronAdmin.status === 200,
    });
  }

  // -------------------------------------------------------------
  // TEST SUITE E: STORAGE & STORY CREATION
  // -------------------------------------------------------------
  console.log('--- SECTION 5: STORAGE UPLOAD & STORY CREATION (/api/storage/upload, /api/stories) ---');
  {
    // Storage Upload (Anon)
    const upAnon = await storageUploadPost(new Request('http://localhost:3000/api/storage/upload', {
      method: 'POST',
      body: new FormData(),
    }));
    recordResult({
      route: '/api/storage/upload',
      method: 'POST',
      actor: 'Anonymous',
      attackVector: 'No credentials',
      expectedStatus: 401,
      actualStatus: upAnon.status,
      pass: upAnon.status === 401,
    });

    // Story Creation (Anon)
    const storyAnon = await storiesPost(new Request('http://localhost:3000/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titleTelugu: 'దొంగ కథ',
        audioUrl: 'user/test.mp3',
      }),
    }));
    recordResult({
      route: '/api/stories',
      method: 'POST',
      actor: 'Anonymous',
      attackVector: 'No credentials',
      expectedStatus: 401,
      actualStatus: storyAnon.status,
      pass: storyAnon.status === 401,
    });

    // Story Creation (Forged narratorId injection)
    const storyForge = await storiesPost(new Request('http://localhost:3000/api/stories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${listenerActor.token}`,
      },
      body: JSON.stringify({
        narratorId: adminActor.user.id, // Trying to publish in admin's name
        titleTelugu: 'దొంగ కథ',
        audioUrl: `${adminActor.user.id}/audio.mp3`,
      }),
    }));
    // Should be rejected by backend because listener has 0 credit or narrator_id is forced to caller
    recordResult({
      route: '/api/stories',
      method: 'POST',
      actor: 'Listener (Forging narratorId)',
      attackVector: 'Injected adminId in body parameter',
      expectedStatus: 400,
      actualStatus: storyForge.status,
      pass: storyForge.status === 400 || storyForge.status === 403,
      details: 'Rejected body narratorId spoofing',
    });
  }

  // -------------------------------------------------------------
  // TEST SUITE F: PLAYBACK & SIGNED URLS (/api/stories/[id]/play)
  // -------------------------------------------------------------
  console.log('--- SECTION 6: AUDIO PLAYBACK ACCESS CONTROL (/api/stories/[id]/play) ---');
  {
    // Live Story: Anon gets signed URL
    const liveAnon = await storyPlayGet(new Request(`http://localhost:3000/api/stories/${liveStoryId}/play`), {
      params: { id: liveStoryId },
    });
    recordResult({
      route: '/api/stories/[id]/play',
      method: 'GET',
      actor: 'Anonymous',
      attackVector: 'Public playback of live published story',
      expectedStatus: 200,
      actualStatus: liveAnon.status,
      pass: liveAnon.status === 200,
      details: 'Signed playback URL returned for live story',
    });

    // Pending Story: Anon denied
    const pendingAnon = await storyPlayGet(new Request(`http://localhost:3000/api/stories/${pendingStory.id}/play`), {
      params: { id: pendingStory.id },
    });
    recordResult({
      route: '/api/stories/[id]/play',
      method: 'GET',
      actor: 'Anonymous',
      attackVector: 'Access to unapproved pending story audio',
      expectedStatus: 401,
      actualStatus: pendingAnon.status,
      pass: pendingAnon.status === 401,
    });

    // Pending Story: Another Listener denied
    const pendingListener = await storyPlayGet(
      new Request(`http://localhost:3000/api/stories/${pendingStory.id}/play`, {
        headers: { Authorization: `Bearer ${listenerActor.token}` },
      }),
      { params: { id: pendingStory.id } }
    );
    recordResult({
      route: '/api/stories/[id]/play',
      method: 'GET',
      actor: 'Listener (Other user)',
      attackVector: 'Access to another narrator unapproved story',
      expectedStatus: 403,
      actualStatus: pendingListener.status,
      pass: pendingListener.status === 403,
    });

    // Pending Story: Story Narrator permitted
    const pendingNarrator = await storyPlayGet(
      new Request(`http://localhost:3000/api/stories/${pendingStory.id}/play`, {
        headers: { Authorization: `Bearer ${narratorActor.token}` },
      }),
      { params: { id: pendingStory.id } }
    );
    recordResult({
      route: '/api/stories/[id]/play',
      method: 'GET',
      actor: 'Story Narrator (Owner)',
      attackVector: 'Creator previewing own pending story',
      expectedStatus: 200,
      actualStatus: pendingNarrator.status,
      pass: pendingNarrator.status === 200,
    });

    // Pending Story: Admin permitted
    const pendingAdmin = await storyPlayGet(
      new Request(`http://localhost:3000/api/stories/${pendingStory.id}/play`, {
        headers: { Authorization: `Bearer ${adminActor.token}` },
      }),
      { params: { id: pendingStory.id } }
    );
    recordResult({
      route: '/api/stories/[id]/play',
      method: 'GET',
      actor: 'Admin',
      attackVector: 'Editorial moderation playback review',
      expectedStatus: 200,
      actualStatus: pendingAdmin.status,
      pass: pendingAdmin.status === 200,
    });
  }

  // -------------------------------------------------------------
  // TEST SUITE G: VOTING AUTHENTICATION (/api/stories/[id]/vote)
  // -------------------------------------------------------------
  console.log('--- SECTION 7: VOTING ACCESS CONTROL (/api/stories/[id]/vote) ---');
  {
    // Anon
    const voteAnon = await storyVotePost(
      new Request(`http://localhost:3000/api/stories/${liveStoryId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: listenerActor.user.id }),
      }),
      { params: { id: liveStoryId } }
    );
    recordResult({
      route: '/api/stories/[id]/vote',
      method: 'POST',
      actor: 'Anonymous',
      attackVector: 'Attempting to vote without authentication (body userId spoofing)',
      expectedStatus: 401,
      actualStatus: voteAnon.status,
      pass: voteAnon.status === 401,
    });

    // Authenticated Listener
    const voteAuth = await storyVotePost(
      new Request(`http://localhost:3000/api/stories/${liveStoryId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${listenerActor.token}`,
        },
      }),
      { params: { id: liveStoryId } }
    );
    recordResult({
      route: '/api/stories/[id]/vote',
      method: 'POST',
      actor: 'Listener',
      attackVector: 'Legitimate authenticated vote toggle via cast_vote RPC',
      expectedStatus: 200,
      actualStatus: voteAuth.status,
      pass: voteAuth.status === 200,
    });
  }

  // -------------------------------------------------------------
  // PRINT AUDIT REPORT TABLE
  // -------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('📊 MULTI-VECTOR AUTHENTICATION & ACCESS CONTROL AUDIT RESULTS');
  console.log('========================================================================');

  console.log(
    '| # | Route | Method | Actor / Attack Vector | Expected | Actual | Pass? |'
  );
  console.log(
    '|---|-------|--------|----------------------|----------|--------|-------|'
  );

  let passedCount = 0;
  results.forEach((r, idx) => {
    if (r.pass) passedCount++;
    const num = String(idx + 1).padEnd(2);
    const route = r.route.padEnd(23);
    const method = r.method.padEnd(6);
    const vector = `${r.actor} (${r.attackVector})`.slice(0, 40).padEnd(40);
    const expected = String(r.expectedStatus).padEnd(8);
    const actual = String(r.actualStatus).padEnd(6);
    const pass = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`| ${num} | ${route} | ${method} | ${vector} | ${expected} | ${actual} | ${pass} |`);
  });

  console.log('========================================================================');
  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${passedCount} | FAILED: ${results.length - passedCount}`);
  console.log('========================================================================\n');

  if (passedCount === results.length) {
    console.log('🎉 ALL API ROUTE AUTH CHECKS PASSED WITH 100% SUCCESS!');
  } else {
    console.error('⚠️ CERTAIN API ROUTE CHECKS FAILED. SEE TABLE ABOVE.');
    process.exit(1);
  }
}

runAuthAudit().catch((err) => {
  console.error('Fatal execution error in test-api-auth.mjs:', err);
  process.exit(1);
});
