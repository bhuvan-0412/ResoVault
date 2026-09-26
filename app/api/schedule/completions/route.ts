import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ScheduleStats, BlockFeedback } from '@/lib/types';
import { computeStreaks } from '../streaks/route';

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { scheduleId, blockId, date, status, timeSlot, feedback } = body;

    if (!scheduleId || !blockId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: scheduleId, blockId, status' },
        { status: 400 }
      );
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const normalizedSlot = timeSlot ? timeSlot.slice(0, 5) : null;
    const validatedFeedback: BlockFeedback | null = ['great', 'good', 'tough'].includes(feedback)
      ? feedback
      : null;

    // 1. Update schedule_blocks table if the block exists
    try {
      await supabase
        .from('schedule_blocks')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', blockId)
        .eq('user_id', user.id);
    } catch (blockErr) {
      // Table pending migration
    }

    // 2. Resolve tagged energy level: check body first, then energy_logs for this date & slot
    let taggedEnergy = body.energyLevel;
    if (!taggedEnergy && normalizedSlot) {
      try {
        const { data: energyRow } = await supabase
          .from('energy_logs')
          .select('energy_level')
          .eq('user_id', user.id)
          .eq('date', targetDate)
          .eq('time_block', normalizedSlot)
          .maybeSingle();
        if (energyRow) taggedEnergy = energyRow.energy_level;
      } catch (eErr) {}
    }

    // 3. Upsert completion record with feedback
    let completionRecord = null;
    try {
      const completionPayload: any = {
        user_id: user.id,
        schedule_id: scheduleId,
        block_id: blockId,
        date: targetDate,
        status,
        time_slot: normalizedSlot || null,
        action_at: new Date().toISOString(),
      };
      if (validatedFeedback) {
        completionPayload.feedback = validatedFeedback;
      }

      const { data: cData, error: cErr } = await supabase
        .from('schedule_completions')
        .upsert(completionPayload, { onConflict: 'schedule_id,block_id' })
        .select()
        .single();
      if (!cErr) completionRecord = cData;
    } catch (upsertErr) {}

    // 4. Ensure outcome is recorded in energy_logs for this date/slot if tagged
    if (normalizedSlot && taggedEnergy) {
      try {
        await supabase
          .from('energy_logs')
          .upsert(
            {
              user_id: user.id,
              date: targetDate,
              time_block: normalizedSlot,
              energy_level: taggedEnergy,
            },
            { onConflict: 'user_id,date,time_block' }
          );
      } catch (energyUpsertErr) {}
    }

    // 5. Derive patterns over time (14-day threshold) with feedback-weighted scoring
    if (normalizedSlot) {
      try {
        const { data: scData } = await supabase
          .from('schedule_completions')
          .select('date, status, feedback')
          .eq('user_id', user.id)
          .eq('time_slot', normalizedSlot);

        const { data: sbData } = await supabase
          .from('schedule_blocks')
          .select('date, status, start_time')
          .eq('user_id', user.id)
          .in('status', ['completed', 'skipped']);

        const combinedOutcomes: { date: string; status: string; feedback?: string }[] = [];
        if (scData) combinedOutcomes.push(...scData);
        if (sbData) {
          sbData.forEach((b: any) => {
            const bSlot = (b.start_time || '').slice(0, 5);
            if (bSlot === normalizedSlot) {
              combinedOutcomes.push({ date: b.date, status: b.status });
            }
          });
        }

        const distinctDays = new Set(combinedOutcomes.map((r) => r.date)).size;

        if (distinctDays >= 14) {
          // Weight completed blocks based on feedback:
          // 'great' = 1.0, 'good' / neutral = 0.85, 'tough' = 0.35, 'skipped' = 0.0
          let weightedSum = 0;
          for (const item of combinedOutcomes) {
            if (item.status === 'completed') {
              if (item.feedback === 'great') weightedSum += 1.0;
              else if (item.feedback === 'good') weightedSum += 0.85;
              else if (item.feedback === 'tough') weightedSum += 0.35;
              else weightedSum += 0.85;
            }
          }

          const derivedScore = Number((weightedSum / combinedOutcomes.length).toFixed(2));

          await supabase
            .from('energy_logs')
            .update({ derived_score: derivedScore })
            .eq('user_id', user.id)
            .eq('time_block', normalizedSlot);
        }
      } catch (calcErr) {
        console.warn('Error updating energy derived score on completion:', calcErr);
      }
    }

    // 6. Recalculate Streaks (Daily adherence >= 80% and category streaks)
    const streakData = await computeStreaks(supabase, user.id);

    return NextResponse.json({
      success: true,
      completion: completionRecord,
      energyLevel: taggedEnergy,
      feedback: validatedFeedback,
      status,
      streaks: streakData,
    });
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
    const actionableBlocks = blocks.filter(
      (b) => b.type === 'study' || b.type === 'task' || b.type === 'todo' || b.type === 'routine'
    );
    const totalBlocksCount = actionableBlocks.length;

    // 2. Fetch completions for the last 14 days
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

    // 3. Compute 80%+ Adherence & Category Streaks
    const streakData = await computeStreaks(supabase, user.id);

    // 4. Generate feedback loop summary notes for LLM generation context
    let feedbackSummary = '';
    const toughCompletions = allCompletions.filter((c) => c.feedback === 'tough');
    const skippedSlots = allCompletions.filter((c) => c.status === 'skipped');

    const feedbackNotes: string[] = [];
    if (toughCompletions.length > 0) {
      const toughSlots = Array.from(new Set(toughCompletions.map((c) => c.time_slot).filter(Boolean)));
      if (toughSlots.length > 0) {
        feedbackNotes.push(
          `User reported high fatigue/drain during: ${toughSlots.join(', ')}. Avoid heavy cognitive blocks in these slots.`
        );
      }
    }
    if (skippedSlots.length > 0) {
      feedbackNotes.push(`User skipped ${skippedSlots.length} planned blocks over past days.`);
    }

    feedbackSummary = feedbackNotes.join(' ');

    const stats: ScheduleStats = {
      streakDays: streakData.dailyAdherence.currentStreak,
      longestStreakDays: streakData.dailyAdherence.longestStreak,
      dailyCompletionRate,
      weeklyCompletionRate,
      completedBlocksCount,
      totalBlocksCount,
      categoryStreaks: streakData.categoryStreaks,
    };

    return NextResponse.json({
      stats,
      feedbackSummary,
      completionsByDate,
      streakData,
    });
  } catch (error: any) {
    console.error('Error fetching schedule completions stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
