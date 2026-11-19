import { NextResponse } from 'next/server';
import { ServerDB } from '@/lib/server-db';
import { getCurrentISTWeekRange } from '@/lib/constants';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

async function verifyCronCaller(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // 1. Valid CRON_SECRET Bearer header
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // 2. Or authenticated admin user
  const caller = await getAuthenticatedUser(request);
  if (caller && caller.role === 'admin') {
    return true;
  }

  return false;
}

async function executeWeeklyTally() {
  const weekRange = getCurrentISTWeekRange();

  // If Supabase is active, execute database tally function
  if (supabaseAdmin) {
    const { data: tallyResult, error } = await supabaseAdmin.rpc('tally_weekly_winners');
    if (error) {
      console.error('[executeWeeklyTally DB error]:', error);
      throw new Error(error.message);
    }

    // Retrieve the recorded winner for the week
    const { data: winners } = await supabaseAdmin
      .from('weekly_winners')
      .select('*, story:stories(*, narrator:profiles!narrator_id(*))')
      .order('announced_at', { ascending: false })
      .limit(3);

    return {
      success: true,
      message: 'Weekly tally completed successfully via database procedure',
      weekRange,
      tallyResult,
      winners,
    };
  }

  // Fallback for store synced mode
  const liveStories = await ServerDB.getStories({ status: 'live', sort: 'most_voted' });
  if (liveStories.length === 0) {
    return { message: 'No live stories to tally', weekRange, winner: null };
  }

  const topStory = liveStories[0];
  const winnerRecord = await ServerDB.confirmWeeklyWinner(topStory.id);

  return {
    success: true,
    message: 'Weekly tally completed successfully',
    weekRange,
    winner: winnerRecord,
    winningStory: {
      id: topStory.id,
      title_telugu: topStory.title_telugu,
      narrator: topStory.narrator?.display_name,
      vote_count: topStory.vote_count,
      reward_amount: 1000,
    },
  };
}

export async function GET(request: Request) {
  try {
    const isAuthorized = await verifyCronCaller(request);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: CRON_SECRET or Admin authorization required' },
        { status: 401 }
      );
    }

    const result = await executeWeeklyTally();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const isAuthorized = await verifyCronCaller(request);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: CRON_SECRET or Admin authorization required' },
        { status: 401 }
      );
    }

    const result = await executeWeeklyTally();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
