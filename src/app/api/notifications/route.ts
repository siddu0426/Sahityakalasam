import { NextResponse } from 'next/server';
import { ServerDB } from '@/lib/server-db';
import { requireAuth } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const userId = authResult.caller.user.id;
    const notifications = await ServerDB.getNotifications(userId);
    return NextResponse.json({ notifications });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const body = await request.json();
    const { id } = body;
    if (id) {
      await ServerDB.markNotificationRead(id);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
