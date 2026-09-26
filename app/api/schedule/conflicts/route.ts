import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { FixedEvent, ScheduleConflict } from '@/lib/types';

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

export function detectConflicts(events: FixedEvent[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Group events by day of week
  const byDay: Record<number, FixedEvent[]> = {};
  for (const event of events) {
    if (!byDay[event.dayOfWeek]) byDay[event.dayOfWeek] = [];
    byDay[event.dayOfWeek].push(event);
  }

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const dayStr of Object.keys(byDay)) {
    const day = parseInt(dayStr, 10);
    const dayEvents = byDay[day];

    // Sort by start time
    dayEvents.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

    for (let i = 0; i < dayEvents.length; i++) {
      for (let j = i + 1; j < dayEvents.length; j++) {
        const e1 = dayEvents[i];
        const e2 = dayEvents[j];

        const start1 = parseTimeToMinutes(e1.startTime);
        const end1 = parseTimeToMinutes(e1.endTime);
        const start2 = parseTimeToMinutes(e2.startTime);
        const end2 = parseTimeToMinutes(e2.endTime);

        // Check overlap: start2 < end1 and end2 > start1
        if (start2 < end1 && end2 > start1) {
          const overlapStart = Math.max(start1, start2);
          const overlapEnd = Math.min(end1, end2);
          const overlapMinutes = Math.max(0, overlapEnd - overlapStart);

          conflicts.push({
            type: 'overlapping_classes',
            event1: e1,
            event2: e2,
            overlapMinutes,
            message: `Overlapping Commitment on ${DAY_NAMES[day]}: "${e1.title}" (${e1.startTime.slice(0, 5)}–${e1.endTime.slice(0, 5)}) overlaps with "${e2.title}" (${e2.startTime.slice(0, 5)}–${e2.endTime.slice(0, 5)}) by ${overlapMinutes} minutes.`,
          });
        }
      }
    }
  }

  return conflicts;
}

// Detect deadlines that cannot realistically be met before their due date
export function detectDeadlineConflicts(
  deadlines: any[],
  fixedEvents: FixedEvent[],
  currentDateStr?: string
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const todayStr = currentDateStr || new Date().toISOString().split('T')[0];
  const todayDate = new Date(`${todayStr}T00:00:00Z`);

  // Filter only open deadlines
  const openDeadlines = deadlines.filter((d) => d.status !== 'done' && !d.completed);

  // Group fixed events duration by day of week
  const fixedDurationByDay: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const fe of fixedEvents) {
    const dur = Math.max(0, parseTimeToMinutes(fe.endTime) - parseTimeToMinutes(fe.startTime));
    fixedDurationByDay[fe.dayOfWeek] = (fixedDurationByDay[fe.dayOfWeek] || 0) + dur;
  }

  // Realistic daily capacity: 15 active hours (900m) - 120m meals/buffers = 780m max available daily
  const MAX_DAILY_FOCUS_MINUTES = 780;

  for (const d of openDeadlines) {
    if (!d.dueDate) continue;

    const dueDate = new Date(`${d.dueDate}T00:00:00Z`);
    const diffTime = dueDate.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const reqMinutes = d.estimatedDuration || 60;

    // 1. Deadline already overdue
    if (diffDays < 0) {
      conflicts.push({
        type: 'unachievable_deadline',
        deadline: d,
        requiredMinutes: reqMinutes,
        availableMinutes: 0,
        message: `Overdue Deadline: "${d.title}" was due on ${d.dueDate} and remains incomplete. Reschedule or mark complete.`,
      });
      continue;
    }

    // 2. Calculate realistic uncommitted focus minutes between today and due date
    let totalAvailableMinutes = 0;
    for (let dayOffset = 0; dayOffset <= Math.min(diffDays, 14); dayOffset++) {
      const dayToCheck = new Date(todayDate);
      dayToCheck.setDate(dayToCheck.getDate() + dayOffset);
      const dow = dayToCheck.getUTCDay();
      const dailyCommitted = fixedDurationByDay[dow] || 0;
      const dailyAvailable = Math.max(60, MAX_DAILY_FOCUS_MINUTES - dailyCommitted);
      totalAvailableMinutes += dailyAvailable;
    }

    // If due today, check if remaining waking time permits
    if (diffDays === 0) {
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const dueTimeMins = d.dueTime ? parseTimeToMinutes(d.dueTime) : 23 * 60 + 59;
      const todayDow = todayDate.getUTCDay();
      const remainingToday = Math.max(0, dueTimeMins - currentMins - (fixedDurationByDay[todayDow] || 0));

      if (reqMinutes > remainingToday) {
        conflicts.push({
          type: 'unachievable_deadline',
          deadline: d,
          requiredMinutes: reqMinutes,
          availableMinutes: remainingToday,
          message: `Unrealistic Deadline Today: "${d.title}" requires ~${reqMinutes}m of work, but only ~${remainingToday}m remain before due time (${d.dueTime || 'end of day'}).`,
        });
        continue;
      }
    }

    // If required duration exceeds total available minutes across days
    if (reqMinutes > totalAvailableMinutes) {
      conflicts.push({
        type: 'unachievable_deadline',
        deadline: d,
        requiredMinutes: reqMinutes,
        availableMinutes: totalAvailableMinutes,
        message: `High Deadline Risk: "${d.title}" due ${d.dueDate} requires ~${reqMinutes}m, exceeding available free study windows (~${totalAvailableMinutes}m remaining).`,
      });
    }
  }

  return conflicts;
}

export function detectAllScheduleConflicts(
  events: FixedEvent[],
  deadlines: any[],
  currentDateStr?: string
): ScheduleConflict[] {
  const classConflicts = detectConflicts(events);
  const deadlineConflicts = detectDeadlineConflicts(deadlines, events, currentDateStr);
  return [...classConflicts, ...deadlineConflicts];
}

export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dayParam = searchParams.get('day');
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // 1. Fetch fixed classes (check fixed_classes first, then fixed_events)
    let fixedData: any[] = [];
    let { data: classesData, error: classesErr } = await supabase
      .from('fixed_classes')
      .select('*')
      .eq('user_id', user.id);

    if (classesErr && classesErr.code === '42P01') {
      const { data: legacyData } = await supabase
        .from('fixed_events')
        .select('*')
        .eq('user_id', user.id);
      fixedData = legacyData || [];
    } else {
      fixedData = classesData || [];
    }

    const events: FixedEvent[] = fixedData.map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      location: row.location,
      color: row.color,
      category: row.category,
      createdAt: row.created_at,
    }));

    // 2. Fetch deadlines (check deadlines first, then todos)
    let deadlinesData: any[] = [];
    let { data: dData, error: dErr } = await supabase
      .from('deadlines')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'done');

    if (dErr && dErr.code === '42P01') {
      const { data: legacyTodos } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', false);
      deadlinesData = legacyTodos || [];
    } else {
      deadlinesData = dData || [];
    }

    const deadlines = deadlinesData.map((r) => ({
      id: r.id,
      title: r.title,
      dueDate: r.due_date,
      dueTime: r.due_time,
      priority: r.priority,
      status: r.status,
      completed: r.completed || r.status === 'done',
      estimatedDuration: r.estimated_duration,
    }));

    const conflicts = detectAllScheduleConflicts(events, deadlines, dateParam);

    return NextResponse.json({
      hasConflicts: conflicts.length > 0,
      conflicts,
      totalEvents: events.length,
      totalDeadlines: deadlines.length,
    });
  } catch (error: any) {
    console.error('Error checking schedule conflicts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
