import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ScheduleStats } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { scheduleId, blockId, date, status, timeSlot } = body;

    if (!scheduleId || !blockId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: scheduleId, blockId, status' },
        { status: 400 }
      );
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Upsert completion record
    const { data, error } = await supabase
      .from('schedule_completions')
      .upsert(
        {
          user_id: user.id,
          schedule_id: scheduleId,
          block_id: blockId,
          date: targetDate,
          status,
          time_slot: timeSlot || null,
          action_at: new Date().toISOString(),
        },
        { onConflict: 'schedule_id,block_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, completion: data });
  } catch (error: any) {
    console.error('Error recording schedule completion:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // 1. Fetch today's schedule to count total actionable blocks
    const { data: scheduleData } = await supabase
      .from('generated_schedules')
      .select('id, blocks')
      .eq('user_id', user.id)
      .eq('schedule_date', dateParam)
      .maybeSingle();

    const blocks: any[] = scheduleData?.blocks || [];
    // Only count todo and focus blocks for completion stats
    const actionableBlocks = blocks.filter((b) => b.type === 'todo' || b.type === 'routine');
    const totalBlocksCount = actionableBlocks.length;

    // 2. Fetch completions for the last 14 days to compute streak & weekly %
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const sinceDateStr = fourteenDaysAgo.toISOString().split('T')[0];

    const { data: completionsData } = await supabase
      .from('schedule_completions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', sinceDateStr)
      .order('date', { ascending: false });

    const allCompletions = completionsData || [];

    // Group completions by date
    const completionsByDate: Record<string, { completed: number; skipped: number; total: number }> = {};
    for (const c of allCompletions) {
      if (!completionsByDate[c.date]) {
        completionsByDate[c.date] = { completed: 0, skipped: 0, total: 0 };
      }
      completionsByDate[c.date].total += 1;
      if (c.status === 'completed') completionsByDate[c.date].completed += 1;
      if (c.status === 'skipped') completionsByDate[c.date].skipped += 1;
    }

    // Today's completion stats
    const todayRec = completionsByDate[dateParam];
    const completedBlocksCount = todayRec ? todayRec.completed : 0;
    const dailyCompletionRate = totalBlocksCount > 0
      ? Math.round((completedBlocksCount / totalBlocksCount) * 100)
      : todayRec && todayRec.total > 0
      ? Math.round((todayRec.completed / todayRec.total) * 100)
      : 0;

    // Weekly completion rate (past 7 days)
    let weeklyTotalCompleted = 0;
    let weeklyTotalActions = 0;
    const todayDate = new Date();

    for (let i = 0; i < 7; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const rec = completionsByDate[ds];
      if (rec) {
        weeklyTotalCompleted += rec.completed;
        weeklyTotalActions += rec.total;
      }
    }

    const weeklyCompletionRate = weeklyTotalActions > 0
      ? Math.round((weeklyTotalCompleted / weeklyTotalActions) * 100)
      : 0;

    // Calculate Streak Days (consecutive past days with >= 70% completion)
    let streakDays = 0;
    // Check if today meets criteria or check consecutive days starting from yesterday backwards
    let checkDate = new Date();
    // If today is completed >= 70%, start streak counting including today
    if (dailyCompletionRate >= 70) {
      streakDays++;
    }
    // Check backward from yesterday
    for (let i = 1; i <= 30; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const rec = completionsByDate[ds];

      if (rec && rec.total > 0 && (rec.completed / rec.total) >= 0.7) {
        streakDays++;
      } else if (i === 1 && (!rec || rec.total === 0)) {
        // If yesterday was empty, streak might still be held if today is active
        continue;
      } else {
        break;
      }
    }

    // Generate feedback loop summary notes for LLM context
    let feedbackSummary = '';
    const skippedSlots = allCompletions.filter((c) => c.status === 'skipped');
    if (skippedSlots.length > 0) {
      feedbackSummary = `User skipped ${skippedSlots.length} planned blocks over past days. Adjust scheduling away from frequently skipped hours.`;
    }

    const stats: ScheduleStats = {
      streakDays,
      dailyCompletionRate,
      weeklyCompletionRate,
      completedBlocksCount,
      totalBlocksCount,
    };

    return NextResponse.json({
      stats,
      feedbackSummary,
      completionsByDate,
    });
  } catch (error: any) {
    console.error('Error fetching schedule completions stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
