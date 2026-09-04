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
            event1: e1,
            event2: e2,
            overlapMinutes,
            message: `Conflict on ${DAY_NAMES[day]}: "${e1.title}" (${e1.startTime.slice(0, 5)}–${e1.endTime.slice(0, 5)}) overlaps with "${e2.title}" (${e2.startTime.slice(0, 5)}–${e2.endTime.slice(0, 5)}) by ${overlapMinutes} minutes.`,
          });
        }
      }
    }
  }

  return conflicts;
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

    let query = supabase
      .from('fixed_events')
      .select('*')
      .eq('user_id', user.id);

    if (dayParam !== null && dayParam !== undefined) {
      query = query.eq('day_of_week', parseInt(dayParam, 10));
    }

    const { data, error } = await query;
    if (error) throw error;

    const events: FixedEvent[] = (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      category: row.category,
      createdAt: row.created_at,
    }));

    const conflicts = detectConflicts(events);

    return NextResponse.json({
      hasConflicts: conflicts.length > 0,
      conflicts,
      totalEvents: events.length,
    });
  } catch (error: any) {
    console.error('Error checking schedule conflicts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
