import { NextResponse } from 'next/server';
import { ServerDB } from '@/lib/server-db';
import { requireAuth } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const { profile } = authResult.caller;
    const credits = await ServerDB.getCredits(profile.id);
    const availableCredits = credits.filter((c) => c.status === 'available').length;

    return NextResponse.json({
      profile,
      availableCredits,
      isAdmin: profile.role === 'admin',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
