import { NextResponse } from 'next/server';
import { ServerDB } from '@/lib/server-db';
import { getCurrentISTWeekRange } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stories = await ServerDB.getStories({ status: 'all' });
    const liveStories = stories.filter((s) => s.status === 'live');
    const pendingStories = stories.filter((s) => s.status === 'pending');
    const rejectedStories = stories.filter((s) => s.status === 'rejected');
    const profiles = await ServerDB.getProfiles();
    const payments = await ServerDB.getPayments();
    const reports = await ServerDB.getReports();
    const weekRange = getCurrentISTWeekRange();

    return NextResponse.json({
      status: 'healthy',
      database: ServerDB.isSupabaseActive() ? 'supabase_postgres_live' : 'server_store_synced',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      current_ist_week: weekRange.formattedRange,
      metrics: {
        total_users: profiles.length,
        stories_live: liveStories.length,
        stories_pending_review: pendingStories.length,
        stories_rejected: rejectedStories.length,
        total_payments_recorded: payments.length,
        pending_reports: reports.filter((r) => r.status === 'pending').length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

