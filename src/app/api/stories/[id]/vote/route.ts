import { NextResponse } from 'next/server';
import { requireAuth, createUserClient } from '@/lib/auth-server';
import { ServerDB } from '@/lib/server-db';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const { caller } = authResult;
    const storyId = params.id;

    if (!storyId) {
      return NextResponse.json({ error: 'Story ID is required' }, { status: 400 });
    }

    const rate = await checkRateLimit(`vote:${caller.user.id}`, 20, 60000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: rate.message || `Too many voting requests. Please wait ${rate.retryAfterSeconds} seconds before voting again.` },
        { status: 429 }
      );
    }

    // Call cast_vote RPC using caller's own authenticated session (NOT service role)
    if (caller.token && supabaseAdmin) {
      try {
        const userClient = createUserClient(caller.token);
        const { data, error } = await userClient.rpc('cast_vote', {
          p_story_id: storyId,
        });

        if (error) {
          console.error('[cast_vote RPC error]:', error);
          const isNotFound = error.message.includes('not found');
          const isNotLive = error.message.includes('live');
          return NextResponse.json(
            { error: error.message },
            { status: isNotFound ? 404 : isNotLive ? 400 : 500 }
          );
        }

        return NextResponse.json(data);
      } catch (rpcErr: any) {
        console.error('[cast_vote client error]:', rpcErr);
        return NextResponse.json({ error: rpcErr.message }, { status: 500 });
      }
    }

    // Local / fallback store mode
    const result = await ServerDB.voteForStory(caller.user.id, storyId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
