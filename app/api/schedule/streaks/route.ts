import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CategoryStreak } from '@/lib/types';

interface DailyAdherenceResult {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
  todayRate: number;
}

export async function computeStreaks(supabase: any, userId: string): Promise<{
  dailyAdherence: DailyAdherenceResult;
  categoryStreaks: CategoryStreak[];
}> {
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Fetch completions for the last 60 days
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const sinceStr = sixtyDaysAgo.toISOString().split('T')[0];

  let completions: any[] = [];
  try {
    const { data } = await supabase
      .from('schedule_completions')
      .select('block_id, date, status, feedback')
      .eq('user_id', userId)
      .gte('date', sinceStr);
    completions = data || [];
  } catch (e) {
    completions = [];
  }

  // 2. Fetch schedules for the last 60 days to know total planned blocks
  let schedules: any[] = [];
  try {
    const { data } = await supabase
      .from('generated_schedules')
      .select('schedule_date, blocks')
      .eq('user_id', userId)
      .gte('schedule_date', sinceStr);
    schedules = data || [];
  } catch (e) {
    schedules = [];
  }

  // Group blocks by date
  const blocksByDate: Record<string, any[]> = {};
  for (const s of schedules) {
    blocksByDate[s.schedule_date] = s.blocks || [];
  }

  // Group completions by date
  const completionsByDate: Record<string, Record<string, string>> = {};
  for (const c of completions) {
    if (!completionsByDate[c.date]) completionsByDate[c.date] = {};
    completionsByDate[c.date][c.block_id] = c.status;
  }

  // 3. Compute Daily Adherence Streak (80%+ threshold)
  let currentDailyStreak = 0;
  let lastCompletedDate: string | null = null;
  let todayRate = 0;

  // Evaluate today first
  const todayBlocks = (blocksByDate[todayStr] || []).filter(
    (b: any) => b.type === 'study' || b.type === 'task' || b.type === 'todo'
  );
  if (todayBlocks.length > 0) {
    const todayDone = todayBlocks.filter(
      (b: any) => completionsByDate[todayStr]?.[b.id] === 'completed' || b.isCompleted
    ).length;
    todayRate = Math.round((todayDone / todayBlocks.length) * 100);
    if (todayRate >= 80) {
      currentDailyStreak++;
      lastCompletedDate = todayStr;
    }
  }

  // Evaluate backwards from yesterday
  const now = new Date();
  for (let i = 1; i <= 60; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const dayBlocks = (blocksByDate[dateStr] || []).filter(
      (b: any) => b.type === 'study' || b.type === 'task' || b.type === 'todo'
    );

    // If no actionable blocks planned on that day, day is neutral (don't break)
    if (dayBlocks.length === 0) {
      continue;
    }

    const doneCount = dayBlocks.filter(
      (b: any) => completionsByDate[dateStr]?.[b.id] === 'completed' || b.isCompleted
    ).length;
    const rate = doneCount / dayBlocks.length;

    if (rate >= 0.80) {
      currentDailyStreak++;
      if (!lastCompletedDate) lastCompletedDate = dateStr;
    } else {
      // Below 80% threshold on a past day with planned blocks resets streak!
      break;
    }
  }

  // 4. Retrieve or update stored longest streak in public.streaks
  let longestDailyStreak = currentDailyStreak;
  try {
    const { data: storedDaily } = await supabase
      .from('streaks')
      .select('longest_streak, current_streak')
      .eq('user_id', userId)
      .eq('streak_type', 'daily_adherence')
      .is('category', null)
      .maybeSingle();

    if (storedDaily) {
      longestDailyStreak = Math.max(storedDaily.longest_streak || 0, currentDailyStreak);
    }

    // Persist daily streak
    await supabase.from('streaks').upsert(
      {
        user_id: userId,
        streak_type: 'daily_adherence',
        category: null,
        current_streak: currentDailyStreak,
        longest_streak: longestDailyStreak,
        last_completed_date: lastCompletedDate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,streak_type,category' }
    );
  } catch (e) {
    // Ignore if streaks table pending migration
  }

  // 5. Compute Per-Category Streaks
  // Collect all distinct categories from schedules
  const categoriesSet = new Set<string>();
  for (const s of schedules) {
    for (const b of s.blocks || []) {
      const cat = b.category || b.subject;
      if (cat && cat !== 'Break' && cat !== 'Routine' && cat !== 'Meal') {
        categoriesSet.add(cat);
      }
    }
  }

  const categoryStreaks: CategoryStreak[] = [];

  for (const cat of Array.from(categoriesSet)) {
    let catCurrentStreak = 0;
    let catLastDate: string | null = null;

    // Check days backwards
    for (let i = 0; i <= 60; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const catBlocks = (blocksByDate[dateStr] || []).filter(
        (b: any) => (b.category || b.subject) === cat
      );

      // Rule: Don't break streak on days where this category had no block scheduled!
      if (catBlocks.length === 0) {
        continue;
      }

      // Category had blocks on this day
      const completedCatBlocks = catBlocks.filter(
        (b: any) => completionsByDate[dateStr]?.[b.id] === 'completed' || b.isCompleted
      );

      if (completedCatBlocks.length > 0) {
        catCurrentStreak++;
        if (!catLastDate) catLastDate = dateStr;
      } else {
        // If today and not completed yet, don't break immediately
        if (i === 0) continue;
        // On a past day where category had blocks and was skipped: break!
        break;
      }
    }

    let catLongest = catCurrentStreak;
    try {
      const { data: storedCat } = await supabase
        .from('streaks')
        .select('longest_streak')
        .eq('user_id', userId)
        .eq('streak_type', 'category')
        .eq('category', cat)
        .maybeSingle();

      if (storedCat) {
        catLongest = Math.max(storedCat.longest_streak || 0, catCurrentStreak);
      }

      // Upsert category streak in DB
      await supabase.from('streaks').upsert(
        {
          user_id: userId,
          streak_type: 'category',
          category: cat,
          current_streak: catCurrentStreak,
          longest_streak: catLongest,
          last_completed_date: catLastDate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,streak_type,category' }
      );
    } catch (e) {}

    categoryStreaks.push({
      category: cat,
      currentStreak: catCurrentStreak,
      longestStreak: catLongest,
      lastCompletedDate: catLastDate,
    });
  }

  // Sort category streaks by currentStreak descending
  categoryStreaks.sort((a, b) => b.currentStreak - a.currentStreak);

  return {
    dailyAdherence: {
      currentStreak: currentDailyStreak,
      longestStreak: longestDailyStreak,
      lastCompletedDate,
      todayRate,
    },
    categoryStreaks,
  };
}

export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const streakData = await computeStreaks(supabase, user.id);

    return NextResponse.json({
      success: true,
      ...streakData,
    });
  } catch (error: any) {
    console.error('Error fetching streaks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
