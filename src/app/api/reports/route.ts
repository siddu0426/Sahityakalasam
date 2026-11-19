import { NextResponse } from 'next/server';
import { ServerDB } from '@/lib/server-db';
import { requireAdmin, requireAuth, getAuthenticatedUser } from '@/lib/auth-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) return authResult.response;

    const reports = await ServerDB.getReports();
    return NextResponse.json({ reports });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const caller = await getAuthenticatedUser(request);
    const clientIp = getClientIp(request);
    const rateKey = caller ? `report:user:${caller.user.id}` : `report:ip:${clientIp}`;

    const rate = await checkRateLimit(rateKey, 5, 600000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: rate.message || `Too many reports submitted. Please wait ${rate.retryAfterSeconds} seconds before submitting another report.` },
        { status: 429 }
      );
    }

    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const reporterId = authResult.caller.user.id;
    const body = await request.json();
    const { storyId, reason, details } = body;

    if (!storyId || !reason) {
      return NextResponse.json({ error: 'Story ID and reason are required' }, { status: 400 });
    }

    const report = await ServerDB.reportStory({
      story_id: storyId,
      reporter_id: reporterId,
      reason,
      details,
    });

    return NextResponse.json({ success: true, report, message: 'Report received by moderation desk' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
