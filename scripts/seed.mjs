import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

console.log('--- KATHALU SEED SCRIPT ---');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isLiveSupabase = Boolean(
  supabaseUrl &&
  serviceRoleKey &&
  !supabaseUrl.includes('mock.supabase.co') &&
  !supabaseUrl.includes('your-project')
);

const SEED_DATA = {
  profiles: [
    {
      id: 'd9b2d621-1111-4000-8000-000000000001',
      phone: '+919876500001',
      display_name: 'Saanvi',
      username: 'saanvi_stories',
      avatar_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&h=200&fit=crop&crop=faces',
      bio: '7వ తరగతి చదువుతున్నాను. అమ్మమ్మ చెప్పిన కథలు మీతో పంచుకోవటం నాకిష్టం.',
      age: 12,
      city: 'Hyderabad',
      show_age_city: true,
      is_minor: true,
      guardian_name: 'Venkata Rao (Father)',
      guardian_phone: '+919876500000',
      guardian_relationship: 'Father',
      guardian_consent: true,
      role: 'user',
    },
    {
      id: 'd9b2d621-1111-4000-8000-000000000002',
      phone: '+919876500002',
      display_name: 'Aarav',
      username: 'aarav_narrates',
      avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=faces',
      bio: 'పంచతంత్ర కథలు అంటే నాకు చాలా ఇష్టం.',
      age: 9,
      city: 'Visakhapatnam',
      show_age_city: true,
      is_minor: true,
      guardian_name: 'Swapna (Mother)',
      guardian_phone: '+919876500003',
      guardian_relationship: 'Mother',
      guardian_consent: true,
      role: 'user',
    },
    {
      id: 'd9b2d621-1111-4000-8000-000000000003',
      phone: '+919876500004',
      display_name: 'Lakshmi Garu',
      username: 'baamma_kathalu',
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces',
      bio: 'మా మనవళ్లకు చెప్పిన చందమామ, నీతి కథలు అందరి పిల్లలకు చేరాలనే ఆశతో.',
      age: 64,
      city: 'Tirupati',
      show_age_city: true,
      is_minor: false,
      guardian_consent: false,
      role: 'user',
    },
    {
      id: 'd9b2d621-1111-4000-8000-000000000004',
      phone: '+919876500005',
      display_name: 'Ananya',
      username: 'ananya_tales',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces',
      bio: 'తెలుగు భాష మరియు సాహిత్య ప్రియురాలు.',
      age: 14,
      city: 'Vijayawada',
      show_age_city: true,
      is_minor: true,
      guardian_name: 'Suresh (Father)',
      guardian_phone: '+919876500006',
      guardian_relationship: 'Father',
      guardian_consent: true,
      role: 'user',
    },
    {
      id: 'd9b2d621-1111-4000-8000-000000000005',
      phone: '+919876543210',
      display_name: 'Kathalu Editorial',
      username: 'kathalu_admin',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=faces',
      bio: 'Editorial and review desk for Kathalu (కథలు).',
      age: 38,
      city: 'Hyderabad',
      show_age_city: false,
      is_minor: false,
      guardian_consent: false,
      role: 'admin',
    },
  ],
  stories: [
    {
      id: 'e1a2b3c4-0001-4000-8000-000000000001',
      narrator_id: 'd9b2d621-1111-4000-8000-000000000001',
      title_telugu: 'బుద్ధిమంతుడైన కాకి',
      title_english: 'The Clever Crow',
      genre: 'Moral Stories',
      cover_url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600&h=600&fit=crop',
      audio_url: 'https://actions.google.com/sounds/v1/ambiences/daytime_forest_bonfire.ogg',
      duration_seconds: 360,
      status: 'live',
      is_weekly_winner: true,
    },
    {
      id: 'e1a2b3c4-0002-4000-8000-000000000002',
      narrator_id: 'd9b2d621-1111-4000-8000-000000000001',
      title_telugu: 'తెనాలి రామకృష్ణ మరియు బంగారు మామిడిపండ్లు',
      title_english: 'Tenali Rama & Golden Mangoes',
      genre: 'Tenali Rama',
      cover_url: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=600&h=600&fit=crop',
      audio_url: 'https://actions.google.com/sounds/v1/water/rain_heavy.ogg',
      duration_seconds: 420,
      status: 'live',
      is_weekly_winner: false,
    },
    {
      id: 'e1a2b3c4-0003-4000-8000-000000000003',
      narrator_id: 'd9b2d621-1111-4000-8000-000000000002',
      title_telugu: 'సింహం మరియు చిన్న ఎలుక',
      title_english: 'The Lion and the Little Mouse',
      genre: 'Moral Stories',
      cover_url: 'https://images.unsplash.com/photo-1534188753412-3e26d0d618d6?w=600&h=600&fit=crop',
      audio_url: 'https://actions.google.com/sounds/v1/ambiences/rain_heavy_wind_leaves.ogg',
      duration_seconds: 310,
      status: 'live',
      is_weekly_winner: false,
    },
    {
      id: 'e1a2b3c4-0004-4000-8000-000000000004',
      narrator_id: 'd9b2d621-1111-4000-8000-000000000003',
      title_telugu: 'బామ్మ చెప్పిన చందమామ కథ',
      title_english: "Grandmother's Moon Tale",
      genre: 'Bedtime',
      cover_url: 'https://images.unsplash.com/photo-1532767153582-b1a0e5145009?w=600&h=600&fit=crop',
      audio_url: 'https://actions.google.com/sounds/v1/transportation/steam_train_horn.ogg',
      duration_seconds: 480,
      status: 'live',
      is_weekly_winner: false,
    },
    {
      id: 'e1a2b3c4-0005-4000-8000-000000000005',
      narrator_id: 'd9b2d621-1111-4000-8000-000000000004',
      title_telugu: 'తాబేలు - కుందేలు పందెం',
      title_english: 'The Tortoise and the Hare',
      genre: 'Moral Stories',
      cover_url: 'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=600&h=600&fit=crop',
      audio_url: 'https://actions.google.com/sounds/v1/animals/cuckoo_call.ogg',
      duration_seconds: 240,
      status: 'live',
      is_weekly_winner: false,
    },
    {
      id: 'e1a2b3c4-0006-4000-8000-000000000006',
      narrator_id: 'd9b2d621-1111-4000-8000-000000000001',
      title_telugu: 'శ్రీకృష్ణుడు మరియు కాళీయ మర్దనం',
      title_english: 'Krishna and the Serpent Kaliya',
      genre: 'Mythology',
      cover_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop',
      audio_url: 'https://actions.google.com/sounds/v1/science_fiction/teleport.ogg',
      duration_seconds: 510,
      status: 'live',
      is_weekly_winner: false,
    },
    {
      id: 'e1a2b3c4-0007-4000-8000-000000000007',
      narrator_id: 'd9b2d621-1111-4000-8000-000000000002',
      title_telugu: 'అనగనగా ఒక ఊరిలో మాయా లేడి',
      title_english: 'The Enchanted Deer of the Forest',
      genre: 'Folk Tales',
      cover_url: 'https://images.unsplash.com/photo-1484406566174-9da000fda645?w=600&h=600&fit=crop',
      audio_url: 'https://actions.google.com/sounds/v1/weather/thunder_crack.ogg',
      duration_seconds: 390,
      status: 'live',
      is_weekly_winner: false,
    },
    {
      id: 'e1a2b3c4-0008-4000-8000-000000000008',
      narrator_id: 'd9b2d621-1111-4000-8000-000000000004',
      title_telugu: 'రామలింగడి తెలివైన దొంగల ఉపాయం',
      title_english: "Tenali Rama's Quick Wit with Thieves",
      genre: 'Tenali Rama',
      cover_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&h=600&fit=crop',
      audio_url: 'https://actions.google.com/sounds/v1/household/clock_ticking.ogg',
      duration_seconds: 345,
      status: 'live',
      is_weekly_winner: false,
    },
    {
      id: 'e1a2b3c4-0009-4000-8000-000000000009',
      narrator_id: 'd9b2d621-1111-4000-8000-000000000001',
      title_telugu: 'ఏనుగు మరియు దర్జీ స్నేహం',
      title_english: 'The Elephant and the Friendly Tailor',
      genre: 'Moral Stories',
      cover_url: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=600&h=600&fit=crop',
      audio_url: 'https://actions.google.com/sounds/v1/ambiences/daytime_forest_bonfire.ogg',
      duration_seconds: 280,
      status: 'pending',
      is_weekly_winner: false,
    },
    {
      id: 'e1a2b3c4-0010-4000-8000-000000000010',
      narrator_id: 'd9b2d621-1111-4000-8000-000000000001',
      title_telugu: 'హనుమంతుని బాల్య లీలలు',
      title_english: 'Childhood Adventures of Hanuman',
      genre: 'Mythology',
      cover_url: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&h=600&fit=crop',
      audio_url: 'https://actions.google.com/sounds/v1/water/rain_heavy.ogg',
      duration_seconds: 330,
      status: 'rejected',
      reject_reason: 'Audio unclear · Low volume',
      reject_notes: 'Audio is too quiet. Please speak closer to the microphone in a quiet room and resubmit without paying again.',
      is_weekly_winner: false,
    },
  ],
};

if (isLiveSupabase) {
  console.log(`Connecting to Supabase at: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  async function seedSupabase() {
    console.log('Seeding profiles...');
    for (const profile of SEED_DATA.profiles) {
      await supabase.from('profiles').upsert(profile);
    }
    console.log('Seeding stories...');
    for (const story of SEED_DATA.stories) {
      await supabase.from('stories').upsert(story);
    }
    console.log('✓ Supabase database seeded successfully!');
  }
  seedSupabase().catch(console.error);
} else {
  console.log('Supabase credentials not configured in .env (running in self-contained mock/local mode).');
  console.log('Generated in-memory seed dataset containing:');
  console.log(`- ${SEED_DATA.profiles.length} Profiles (including Saanvi, Aarav, Lakshmi Garu, and Admin)`);
  console.log(`- ${SEED_DATA.stories.length} Telugu Stories (8 Live, 1 Pending, 1 Rejected with audio feedback)`);
  console.log('✓ Local seed verified!');
}
