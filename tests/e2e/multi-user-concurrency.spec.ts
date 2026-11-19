import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

if (!globalThis.WebSocket) {
  (globalThis as any).WebSocket = WebSocket;
}

function getEnvConfig() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }
  }
  return env;
}

test('Multi-User Concurrency: Real Supabase Staging - Narrator uploads, Admin approves, Listeners vote concurrently', async ({
  browser,
}) => {
  const env = getEnvConfig();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const adminSupabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Get real test users from staging Supabase
  const narratorClient = createClient(supabaseUrl, anonKey);
  const adminClient = createClient(supabaseUrl, anonKey);
  const listener1Client = createClient(supabaseUrl, anonKey);
  const listener2Client = createClient(supabaseUrl, anonKey);

  const [narratorAuth, adminAuth, listener1Auth, listener2Auth] = await Promise.all([
    narratorClient.auth.signInWithPassword({ email: 'narrator_a@kathalu.app', password: 'Password123!' }),
    adminClient.auth.signInWithPassword({ email: 'admin_test@kathalu.app', password: 'Password123!' }),
    listener1Client.auth.signInWithPassword({ email: 'voter_1@kathalu.app', password: 'Password123!' }),
    listener2Client.auth.signInWithPassword({ email: 'voter_2@kathalu.app', password: 'Password123!' }),
  ]);

  const narratorId = narratorAuth.data.user!.id;
  const adminId = adminAuth.data.user!.id;
  const listener1Id = listener1Auth.data.user!.id;
  const listener2Id = listener2Auth.data.user!.id;

  // 2. Ensure narrator has at least 1 available upload credit in staging database
  const { data: existingCredits } = await adminSupabase
    .from('upload_credits')
    .select('id')
    .eq('user_id', narratorId)
    .eq('status', 'available');

  if (!existingCredits || existingCredits.length === 0) {
    const paymentId = '44444444-5555-4000-8000-000000000001';
    await adminSupabase.from('payments').upsert({
      id: paymentId,
      user_id: narratorId,
      amount: 2000,
      currency: 'INR',
      razorpay_order_id: `order_e2e_${Date.now()}`,
      status: 'paid',
    });
    await adminSupabase.from('upload_credits').insert({
      user_id: narratorId,
      payment_id: paymentId,
      status: 'available',
    });
  }

  // 3. Browser Contexts for all 4 actors with real Supabase Auth tokens & cookies
  const narratorContext = await browser.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${narratorAuth.data.session!.access_token}`,
      'x-user-id': narratorId,
    },
  });
  const narratorPage = await narratorContext.newPage();

  const adminContext = await browser.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${adminAuth.data.session!.access_token}`,
      'x-admin-id': adminId,
      'x-user-id': adminId,
    },
  });
  const adminPage = await adminContext.newPage();

  const listener1Context = await browser.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${listener1Auth.data.session!.access_token}`,
      'x-user-id': listener1Id,
    },
  });
  const listener1Page = await listener1Context.newPage();

  const listener2Context = await browser.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${listener2Auth.data.session!.access_token}`,
      'x-user-id': listener2Id,
    },
  });
  const listener2Page = await listener2Context.newPage();

  let createdStoryId: string | null = null;

  try {
    // --- STEP 1: Narrator submits a story to real Supabase staging ---
    const storyTitle = `కథల పండుగ · StoryFest ${Date.now().toString().slice(-4)}`;
    const submitRes = await narratorPage.request.post('/api/stories', {
      data: {
        narratorId,
        titleTelugu: storyTitle,
        titleEnglish: 'Celebration of Telugu Tales',
        genre: 'Moral Stories',
        audioUrl: `${narratorId}/audio.mp3`,
        durationSeconds: 240,
        coverUrl: 'placeholders/default-cover.webp',
      },
    });

    if (!submitRes.ok()) {
      console.error('submitRes error status:', submitRes.status(), await submitRes.text());
    }
    expect(submitRes.ok()).toBe(true);
    const { story: newStory } = await submitRes.json();
    expect(newStory.status).toBe('pending');
    createdStoryId = newStory.id;

    // Verify row in Supabase staging database
    const { data: dbStory } = await adminSupabase
      .from('stories')
      .select('status, narrator_id, vote_count')
      .eq('id', createdStoryId)
      .single();
    expect(dbStory?.status).toBe('pending');
    expect(dbStory?.narrator_id).toBe(narratorId);

    // --- STEP 2: Admin reviews and approves the story ---
    const approveRes = await adminPage.request.post('/api/admin/review', {
      headers: { 'x-admin-id': adminId },
      data: {
        storyId: createdStoryId,
        action: 'approve',
      },
    });
    expect(approveRes.ok()).toBe(true);
    const { story: approvedStory } = await approveRes.json();
    expect(approvedStory.status).toBe('live');

    // Verify row in Supabase staging database is live
    const { data: liveDbStory } = await adminSupabase
      .from('stories')
      .select('status, reviewed_by')
      .eq('id', createdStoryId)
      .single();
    expect(liveDbStory?.status).toBe('live');
    expect(liveDbStory?.reviewed_by).toBe(adminId);

    // --- STEP 3: Listeners 1 & 2 cast votes concurrently on real database ---
    await Promise.all([
      listener1Page.goto('/'),
      listener2Page.goto('/'),
    ]);

    const [voteRes1, voteRes2] = await Promise.all([
      listener1Page.request.post(`/api/stories/${createdStoryId}/vote`, {
        data: { userId: listener1Id },
      }),
      listener2Page.request.post(`/api/stories/${createdStoryId}/vote`, {
        data: { userId: listener2Id },
      }),
    ]);

    expect(voteRes1.ok()).toBe(true);
    expect(voteRes2.ok()).toBe(true);

    const voteData1 = await voteRes1.json();
    const voteData2 = await voteRes2.json();
    expect(voteData1.success).toBe(true);
    expect(voteData2.success).toBe(true);

    // --- STEP 4: Verify everyone sees the same consistent state in staging DB ---
    const checkRes1 = await listener1Page.request.get(`/api/stories?search=${encodeURIComponent(storyTitle)}`);
    const { stories: matchingStories } = await checkRes1.json();
    expect(matchingStories.length).toBeGreaterThan(0);

    const liveStoryState = matchingStories.find((s: any) => s.id === createdStoryId);
    expect(liveStoryState).toBeDefined();
    expect(liveStoryState.status).toBe('live');
    expect(liveStoryState.vote_count).toBe(2);

    // Directly assert Supabase staging table rows
    const { data: finalDbStory } = await adminSupabase
      .from('stories')
      .select('vote_count, status')
      .eq('id', createdStoryId)
      .single();
    expect(finalDbStory?.vote_count).toBe(2);

    const { count: voteRowsCount } = await adminSupabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('story_id', createdStoryId);
    expect(voteRowsCount).toBe(2);

    console.log(
      `[SUPABASE STAGING CONCURRENCY TEST PASSED] Story: "${storyTitle}", Final Votes: ${finalDbStory?.vote_count}, DB Vote Rows: ${voteRowsCount}`
    );
  } finally {
    // Clean up created story & votes from staging
    if (createdStoryId) {
      await adminSupabase.from('votes').delete().eq('story_id', createdStoryId);
      await adminSupabase.from('stories').delete().eq('id', createdStoryId);
    }
    await narratorContext.close();
    await adminContext.close();
    await listener1Context.close();
    await listener2Context.close();
  }
});
