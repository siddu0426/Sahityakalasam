import { NextResponse } from 'next/server';
import { ServerDB } from '@/lib/server-db';
import { requireAdmin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) return authResult.response;

    const pending = await ServerDB.getStories({ status: 'pending' });
    return NextResponse.json({ pending });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) return authResult.response;

    const adminId = authResult.caller.user.id;
    const body = await request.json();
    const { storyId, action, reason, notes } = body;

    if (!storyId || !action) {
      return NextResponse.json({ error: 'Story ID and action are required' }, { status: 400 });
    }

    if (action === 'approve') {
      const story = await ServerDB.approveStory(storyId, adminId);
      return NextResponse.json({ success: true, story, message: 'Story approved and published live' });
    } else if (action === 'reject') {
      const story = await ServerDB.rejectStory(storyId, reason || 'Audio unclear', notes || '', adminId);
      return NextResponse.json({ success: true, story, message: 'Story rejected with feedback' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
