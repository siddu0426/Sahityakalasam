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

// Deterministic UUIDs for test users so re-running seeds updates rather than duplicating
const TEST_USERS = [
  {
    id: '11111111-0000-4000-8000-000000000001',
    email: 'admin@kathalu.app',
    phone: '+919876543210',
    display_name: 'Kathalu Editorial Desk',
    username: 'kathalu_admin',
    role: 'admin',
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop',
    bio: 'Chief Editorial & Quality Desk for Kathalu (కథలు).',
  },
  {
    id: '11111111-0000-4000-8000-000000000002',
    email: 'moderator@kathalu.app',
    phone: '+919876543211',
    display_name: 'Safety & Moderation Desk',
    username: 'safety_moderator',
    role: 'admin',
    avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&h=200&fit=crop',
    bio: 'Child Safety & Content Moderation at Kathalu.',
  },
  {
    id: '22222222-0000-4000-8000-000000000001',
    email: 'saanvi@kathalu.app',
    phone: '+919876500001',
    display_name: 'Saanvi',
    username: 'saanvi_stories',
    role: 'narrator',
    age: 12,
    city: 'Hyderabad',
    show_age_city: true,
    is_minor: true,
    guardian_name: 'Venkata Rao (Father)',
    guardian_phone: '+919876500000',
    guardian_relationship: 'Father',
    guardian_consent: true,
    avatar_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&h=200&fit=crop',
    bio: '7వ తరగతి చదువుతున్నాను. అమ్మమ్మ చెప్పిన కథలు మీతో పంచుకోవటం నాకిష్టం.',
  },
  {
    id: '22222222-0000-4000-8000-000000000002',
    email: 'ramana@kathalu.app',
    phone: '+919876500002',
    display_name: 'Ramana Thatha',
    username: 'ramana_tales',
    role: 'narrator',
    age: 68,
    city: 'Rajahmundry',
    show_age_city: true,
    is_minor: false,
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
    bio: 'మా ఊరి గోదావరి కథలు, జానపద కథలు మీకు వినిపిస్తాను.',
  },
  {
    id: '22222222-0000-4000-8000-000000000003',
    email: 'ananya@kathalu.app',
    phone: '+919876500003',
    display_name: 'Ananya',
    username: 'ananya_kathalu',
    role: 'narrator',
    age: 14,
    city: 'Vijayawada',
    show_age_city: true,
    is_minor: true,
    guardian_name: 'Suresh (Father)',
    guardian_phone: '+919876500006',
    guardian_relationship: 'Father',
    guardian_consent: true,
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
    bio: 'తెలుగు భాష మరియు సాహిత్య ప్రియురాలు.',
  },
  {
    id: '33333333-0000-4000-8000-000000000001',
    email: 'ravi@kathalu.app',
    phone: '+919666600001',
    display_name: 'Ravi',
    username: 'ravi_listener',
    role: 'listener',
    city: 'Hyderabad',
  },
  {
    id: '33333333-0000-4000-8000-000000000002',
    email: 'priya@kathalu.app',
    phone: '+919666600002',
    display_name: 'Priya',
    username: 'priya_stories',
    role: 'listener',
    city: 'Bengaluru',
  },
];

const SAMPLE_COVERS = {
  crow: 'https://images.unsplash.com/photo-1520808663317-647b476a81b9?w=800&auto=format&fit=crop',
  tenali: 'https://images.unsplash.com/photo-1544717302-de2939b7ef71?w=800&auto=format&fit=crop',
  lion: 'https://images.unsplash.com/photo-1534188753412-3e26d0d618d6?w=800&auto=format&fit=crop',
  moon: 'https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=800&auto=format&fit=crop',
  tortoise: 'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&auto=format&fit=crop',
  krishna: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop',
  deer: 'https://images.unsplash.com/photo-1484406566174-9da000fda645?w=800&auto=format&fit=crop',
  pigeon: 'https://images.unsplash.com/photo-1549608276-5786777e6587?w=800&auto=format&fit=crop',
  birds: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800&auto=format&fit=crop',
  sparrow: 'https://images.unsplash.com/photo-1555169062-013468b47731?w=800&auto=format&fit=crop',
};

const SAMPLE_AUDIO = 'https://actions.google.com/sounds/v1/ambiences/daytime_forest_bonfire.ogg';

const STORIES = [
  {
    id: '44444444-0000-4000-8000-000000000001',
    narrator_id: '22222222-0000-4000-8000-000000000001', // Saanvi
    title_telugu: 'బుద్ధిమంతుడైన కాకి',
    title_english: 'The Clever Crow',
    genre: 'Moral Stories',
    cover_url: SAMPLE_COVERS.crow,
    audio_url: SAMPLE_AUDIO,
    duration_seconds: 360,
    status: 'live',
    is_weekly_winner: true,
    vote_count: 1248,
  },
  {
    id: '44444444-0000-4000-8000-000000000002',
    narrator_id: '22222222-0000-4000-8000-000000000001', // Saanvi
    title_telugu: 'తెనాలి రామకృష్ణ మరియు బంగారు మామిడిపండ్లు',
    title_english: 'Tenali Rama & Golden Mangoes',
    genre: 'Tenali Rama',
    cover_url: SAMPLE_COVERS.tenali,
    audio_url: SAMPLE_AUDIO,
    duration_seconds: 420,
    status: 'live',
    is_weekly_winner: false,
    vote_count: 856,
  },
  {
    id: '44444444-0000-4000-8000-000000000003',
    narrator_id: '22222222-0000-4000-8000-000000000002', // Ramana
    title_telugu: 'సింహం మరియు చిన్న ఎలుక',
    title_english: 'The Lion and the Little Mouse',
    genre: 'Moral Stories',
    cover_url: SAMPLE_COVERS.lion,
    audio_url: SAMPLE_AUDIO,
    duration_seconds: 310,
    status: 'live',
    is_weekly_winner: false,
    vote_count: 940,
  },
  {
    id: '44444444-0000-4000-8000-000000000004',
    narrator_id: '22222222-0000-4000-8000-000000000002', // Ramana
    title_telugu: 'బామ్మ చెప్పిన చందమామ కథ',
    title_english: "Grandmother's Moon Tale",
    genre: 'Bedtime',
    cover_url: SAMPLE_COVERS.moon,
    audio_url: SAMPLE_AUDIO,
    duration_seconds: 480,
    status: 'live',
    is_weekly_winner: false,
    vote_count: 1120,
  },
  {
    id: '44444444-0000-4000-8000-000000000005',
    narrator_id: '22222222-0000-4000-8000-000000000003', // Ananya
    title_telugu: 'తాబేలు - కుందేలు పందెం',
    title_english: 'The Tortoise and the Hare',
    genre: 'Moral Stories',
    cover_url: SAMPLE_COVERS.tortoise,
    audio_url: SAMPLE_AUDIO,
    duration_seconds: 240,
    status: 'live',
    is_weekly_winner: false,
    vote_count: 730,
  },
  {
    id: '44444444-0000-4000-8000-000000000006',
    narrator_id: '22222222-0000-4000-8000-000000000001', // Saanvi
    title_telugu: 'శ్రీకృష్ణుడు మరియు కాళీయ మర్దనం',
    title_english: 'Krishna and the Serpent Kaliya',
    genre: 'Mythology',
    cover_url: SAMPLE_COVERS.krishna,
    audio_url: SAMPLE_AUDIO,
    duration_seconds: 510,
    status: 'live',
    is_weekly_winner: false,
    vote_count: 680,
  },
  {
    id: '44444444-0000-4000-8000-000000000007',
    narrator_id: '22222222-0000-4000-8000-000000000003', // Ananya
    title_telugu: 'అనగనగా ఒక ఊరిలో మాయా లేడి',
    title_english: 'The Enchanted Deer of the Forest',
    genre: 'Folk Tales',
    cover_url: SAMPLE_COVERS.deer,
    audio_url: SAMPLE_AUDIO,
    duration_seconds: 390,
    status: 'live',
    is_weekly_winner: false,
    vote_count: 590,
  },
  {
    id: '44444444-0000-4000-8000-000000000008',
    narrator_id: '22222222-0000-4000-8000-000000000002', // Ramana
    title_telugu: 'మిత్రలాభం - పావురాల కథ',
    title_english: 'Panchatantra: Unity of Pigeons',
    genre: 'Panchatantra',
    cover_url: SAMPLE_COVERS.pigeon,
    audio_url: SAMPLE_AUDIO,
    duration_seconds: 450,
    status: 'live',
    is_weekly_winner: false,
    vote_count: 810,
  },
  {
    id: '44444444-0000-4000-8000-000000000009',
    narrator_id: '22222222-0000-4000-8000-000000000001', // Saanvi
    title_telugu: 'గువ్వల జంట మరియు వేటగాడు',
    title_english: 'The Pair of Doves and the Hunter',
    genre: 'Folk Tales',
    cover_url: SAMPLE_COVERS.birds,
    audio_url: SAMPLE_AUDIO,
    duration_seconds: 300,
    status: 'pending',
    is_weekly_winner: false,
    vote_count: 0,
  },
  {
    id: '44444444-0000-4000-8000-000000000010',
    narrator_id: '22222222-0000-4000-8000-000000000003', // Ananya
    title_telugu: 'గాలివాన మరియు పిచ్చుక గూడు',
    title_english: 'The Storm and the Sparrow Nest',
    genre: 'Moral Stories',
    cover_url: SAMPLE_COVERS.sparrow,
    audio_url: SAMPLE_AUDIO,
    duration_seconds: 180,
    status: 'rejected',
    reject_reason: 'Audio unclear · Low volume',
    reject_notes: 'దయచేసి మైక్రోఫోన్ దగ్గరగా పట్టుకుని కొంచెం స్పష్టంగా రికార్డ్ చేయండి.',
    is_weekly_winner: false,
    vote_count: 0,
  },
];

async function seed() {
  console.log('Seeding staging Supabase database...');

  // 1. Fetch all existing auth users or create missing ones
  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 100 });
  const userMap = new Map(listData?.users?.map((u) => [u.email, u]) || []);

  for (const user of TEST_USERS) {
    try {
      let authUser = userMap.get(user.email);
      if (!authUser) {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: 'Password123!',
          email_confirm: true,
          user_metadata: {
            display_name: user.display_name,
            username: user.username,
            role: user.role,
          },
        });
        if (authData?.user) {
          authUser = authData.user;
          userMap.set(user.email, authUser);
        }
      }

      if (authUser) {
        // Upsert into profiles
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: authUser.id,
          email: user.email,
          phone: user.phone,
          display_name: user.display_name,
          username: user.username,
          role: user.role,
          avatar_url: user.avatar_url || null,
          bio: user.bio || null,
          age: user.age || null,
          city: user.city || null,
          show_age_city: user.show_age_city || false,
          is_minor: user.is_minor || false,
          guardian_name: user.guardian_name || null,
          guardian_phone: user.guardian_phone || null,
          guardian_relationship: user.guardian_relationship || null,
          guardian_consent: user.guardian_consent || false,
        });

        if (profileError) {
          console.warn(`Profile upsert note for ${user.email}:`, profileError.message);
        }
      }
    } catch (e) {
      console.warn(`Auth user note for ${user.email}:`, e.message);
    }
  }

  // 2. Fetch Saanvi, Ramana, Ananya profile IDs or map to verified staging narrators
  const { data: saanviProf } = await supabase.from('profiles').select('id').eq('email', 'saanvi@kathalu.app').maybeSingle();
  const { data: ramanaProf } = await supabase.from('profiles').select('id').eq('email', 'ramana@kathalu.app').maybeSingle();
  const { data: ananyaProf } = await supabase.from('profiles').select('id').eq('email', 'ananya@kathalu.app').maybeSingle();
  const { data: narratorAProf } = await supabase.from('profiles').select('id').eq('email', 'narrator_a@kathalu.app').maybeSingle();
  const { data: narratorBProf } = await supabase.from('profiles').select('id').eq('email', 'narrator_b@kathalu.app').maybeSingle();

  const defaultNarrator = narratorAProf?.id || 'c226381f-5634-41c7-8386-a031a9666e32';
  const secondNarrator = narratorBProf?.id || '82a054c1-f1c2-4563-a467-ada2065d0055';

  const narratorMap = {
    '22222222-0000-4000-8000-000000000001': saanviProf?.id || defaultNarrator,
    '22222222-0000-4000-8000-000000000002': ramanaProf?.id || secondNarrator,
    '22222222-0000-4000-8000-000000000003': ananyaProf?.id || defaultNarrator,
  };

  // 3. Upsert Stories
  let storiesSeeded = 0;
  for (const s of STORIES) {
    const narratorId = narratorMap[s.narrator_id] || s.narrator_id;
    const { error: storyError } = await supabase.from('stories').upsert({
      id: s.id,
      narrator_id: narratorId,
      title_telugu: s.title_telugu,
      title_english: s.title_english,
      genre: s.genre,
      cover_url: s.cover_url,
      audio_url: s.audio_url,
      duration_seconds: s.duration_seconds,
      status: s.status,
      vote_count: s.vote_count,
      is_weekly_winner: s.is_weekly_winner,
      reject_reason: s.reject_reason || null,
      reject_notes: s.reject_notes || null,
    });

    if (storyError) {
      console.warn(`Story seed error (${s.title_telugu}):`, storyError.message);
    } else {
      storiesSeeded++;
    }
  }

  // 4. Seed available upload credit for Saanvi
  const saanviId = saanviProf?.id || userMap.get('saanvi@kathalu.app')?.id;
  if (saanviId) {
    await supabase.from('upload_credits').upsert({
      id: '55555555-0000-4000-8000-000000000001',
      user_id: saanviId,
      status: 'available',
    });
  }

  // 5. Verification queries
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count: profileCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const { count: storiesCount } = await supabase.from('stories').select('*', { count: 'exact', head: true });
  const { data: liveStories, error: liveErr } = await anonClient
    .from('stories')
    .select('id, title_telugu, title_english, genre, vote_count')
    .eq('status', 'live');

  console.log('\n--- SEED VERIFICATION SUMMARY ---');
  console.log(`• Profiles in DB: ${profileCount}`);
  console.log(`• Stories in DB: ${storiesCount} (${storiesSeeded}/10 upserted in this run)`);
  console.log(`• Anonymous Live Stories View: ${liveStories?.length ?? 0} stories visible without error (error: ${liveErr?.message || 'none'})`);
  console.log('✅ Staging Database Seed Complete.');
}

seed().catch(console.error);

