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

    // Target dates: Today and Tomorrow (daily early morning generation for the day ahead)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Fetch distinct users who have fixed classes, deadlines, or legacy items
    const userIdsSet = new Set<string>();

    try {
      const { data: fcUsers } = await supabase.from('fixed_classes').select('user_id');
      (fcUsers || []).forEach((u: any) => userIdsSet.add(u.user_id));
    } catch (e) {}

    try {
      const { data: dlUsers } = await supabase.from('deadlines').select('user_id');
      (dlUsers || []).forEach((u: any) => userIdsSet.add(u.user_id));
    } catch (e) {}

    try {
      const { data: feUsers } = await supabase.from('fixed_events').select('user_id');
      (feUsers || []).forEach((u: any) => userIdsSet.add(u.user_id));
    } catch (e) {}

    try {
      const { data: todoUsers } = await supabase.from('todos').select('user_id');
      (todoUsers || []).forEach((u: any) => userIdsSet.add(u.user_id));
    } catch (e) {}

    const userIds = Array.from(userIdsSet);
    let generatedCount = 0;

    for (const userId of userIds) {
      try {
        const host = req.headers.get('host') || 'localhost:3000';
        const proto = host.includes('localhost') ? 'http' : 'https';
        const url = `${proto}://${host}/api/schedule/generate`;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-cron-user-id': userId,
        };
        if (cronSecret) {
          headers['authorization'] = `Bearer ${cronSecret}`;
        }

        // Generate for today (without touching completed blocks)
        await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            date: todayStr,
            forceRegenerate: true,
          }),
        }).catch(console.warn);

        // Generate for tomorrow
        await fetch(url, {
          method: 'POST',
          headers,
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
      message: `Completed daily schedule generation for ${generatedCount} user(s) for ${todayStr} & ${tomorrowStr}`,
      today: todayStr,
      tomorrow: tomorrowStr,
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
