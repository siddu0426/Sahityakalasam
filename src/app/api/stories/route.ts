import { NextResponse } from 'next/server';
import { ServerDB } from '@/lib/server-db';
import { Genre } from '@/lib/types';
import { requireAuth, getAuthenticatedUser } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const genre = url.searchParams.get('genre') as Genre | null;
    const search = url.searchParams.get('search') || undefined;
    const sort = (url.searchParams.get('sort') as 'most_voted' | 'newest') || 'most_voted';
    const requestedStatus = (url.searchParams.get('status') as 'live' | 'pending' | 'rejected' | 'all') || 'live';
    const narratorId = url.searchParams.get('narratorId') || undefined;

    // If caller requests pending, rejected or all stories, verify caller permissions
    if (requestedStatus !== 'live') {
      const caller = await getAuthenticatedUser(request);
      const isAdmin = caller?.role === 'admin';
      const isOwnNarrator = caller && narratorId && caller.user.id === narratorId;

      if (!isAdmin && !isOwnNarrator) {
        return NextResponse.json(
          { error: 'Unauthorized: Access to pending or rejected stories requires admin or owner permissions' },
          { status: 403 }
        );
      }
    }

    const stories = await ServerDB.getStories({
      genre: genre || undefined,
      search,
      sort,
      status: requestedStatus,
      narratorId,
    });

    return NextResponse.json({ stories });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const narratorId = authResult.caller.user.id;
    const body = await request.json();
    const {
      titleTelugu,
      titleEnglish,
      genre,
      audioUrl,
      durationSeconds,
      coverUrl,
      resubmitStoryId,
    } = body;

    if (!titleTelugu || !audioUrl) {
      return NextResponse.json(
        { error: 'Telugu title and audio URL are required' },
        { status: 400 }
      );
    }

    const story = await ServerDB.submitStory({
      narratorId, // STRICT: Derived solely from authenticated caller
      titleTelugu,
      titleEnglish,
      genre: genre || 'Moral Stories',
      audioUrl,
      durationSeconds: durationSeconds || 180,
      coverUrl,
      resubmitStoryId,
    });

    return NextResponse.json({ success: true, story });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
