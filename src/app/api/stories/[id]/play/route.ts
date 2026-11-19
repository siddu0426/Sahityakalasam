import { NextResponse } from 'next/server';
import { ServerDB } from '@/lib/server-db';
import { getAuthenticatedUser, getSignedStorageUrl, createUserClient } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const storyId = params.id;
    const story = await ServerDB.getStoryById(storyId);

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Access control for signed playback URLs
    if (story.status !== 'live') {
      const caller = await getAuthenticatedUser(request);

      if (!caller) {
        return NextResponse.json(
          { error: 'Unauthorized: Authentication required to preview non-live stories' },
          { status: 401 }
        );
      }

      const isNarrator = caller.user.id === story.narrator_id;
      const isAdmin = caller.role === 'admin';

      if (!isNarrator && !isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Only the narrator or an administrator can access audio for pending or rejected stories' },
          { status: 403 }
        );
      }
    }

    // Generate signed URLs (1 hour validity)
    const signedAudioUrl = await getSignedStorageUrl('story-audio', story.audio_url, 3600);
    const signedCoverUrl = story.cover_url
      ? await getSignedStorageUrl('story-covers', story.cover_url, 3600)
      : null;

    return NextResponse.json({
      success: true,
      storyId: story.id,
      status: story.status,
      audioUrl: signedAudioUrl,
      coverUrl: signedCoverUrl,
      titleTelugu: story.title_telugu,
      titleEnglish: story.title_english,
      durationSeconds: story.duration_seconds,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const storyId = params.id;
    const caller = await getAuthenticatedUser(request);

    if (caller && caller.token && supabaseAdmin) {
      // Execute increment_play_count using user client
      try {
        const userClient = createUserClient(caller.token);
        const { data, error } = await userClient.rpc('increment_play_count', {
          p_story_id: storyId,
        });
        if (!error && data) {
          return NextResponse.json(data);
        }
      } catch {
        // Fall back to serverDB if RPC error
      }
    }

    const playCount = await ServerDB.incrementPlayCount(storyId);
    return NextResponse.json({ success: true, storyId, playCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
