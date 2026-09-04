import { NextResponse } from 'next/server';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Verify cron authorization if configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && searchParams.get('key') !== cronSecret) {
      const isVercelCron = req.headers.get('x-vercel-cron') === '1';
      if (!isVercelCron && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized cron invocation' }, { status: 401 });
      }
    }

    const supabase = createServiceRoleSupabaseClient();

    // Target date: Tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Fetch distinct users who have fixed events or todos
    const { data: activeUsers, error: userErr } = await supabase
      .from('fixed_events')
      .select('user_id');

    if (userErr) throw userErr;

    const userIds = Array.from(new Set((activeUsers || []).map((u) => u.user_id)));

    let generatedCount = 0;

    for (const userId of userIds) {
      try {
        // Trigger generation for each user via internal call or generation service
        const host = req.headers.get('host') || 'localhost:3000';
        const proto = host.includes('localhost') ? 'http' : 'https';
        const url = `${proto}://${host}/api/schedule/generate`;

        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cron-user-id': userId,
          },
          body: JSON.stringify({
            date: tomorrowStr,
            forceRegenerate: true,
          }),
        }).catch(console.warn);

        generatedCount++;
      } catch (err) {
        console.warn(`Failed schedule generation for user ${userId}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Completed daily schedule generation for ${generatedCount} user(s) for ${tomorrowStr}`,
      date: tomorrowStr,
      usersProcessed: generatedCount,
    });
  } catch (error: any) {
    console.error('Error in /api/cron/generate-schedules:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
