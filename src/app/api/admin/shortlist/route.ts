import { NextResponse } from 'next/server';
import { ServerDB } from '@/lib/server-db';
import { requireAdmin, createUserClient } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) return authResult.response;

    const shortlist = await ServerDB.getWeeklyShortlist();
    return NextResponse.json({ shortlist });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) return authResult.response;

    const body = await request.json();
    const { storyId } = body;

    if (!storyId) {
      return NextResponse.json({ error: 'Story ID is required' }, { status: 400 });
    }

    const { caller } = authResult;
    if (caller.token && supabaseAdmin) {
      const userClient = createUserClient(caller.token);
      const { data, error } = await userClient.rpc('confirm_weekly_winner', {
        p_story_id: storyId,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        winner: data,
        message: 'Winner confirmed and ₹1,000 reward granted!',
      });
    }

    const winner = await ServerDB.confirmWeeklyWinner(storyId);
    return NextResponse.json({ success: true, winner, message: 'Winner confirmed and ₹1,000 reward granted!' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
