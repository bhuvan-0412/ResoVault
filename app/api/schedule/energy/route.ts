import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { EnergyLevel, EnergyLog } from '@/lib/types';

// Standardize timeBlock to "HH:00" or normalized range
export function normalizeTimeSlot(timeStr: string): string {
  if (!timeStr) return '09:00';
  const clean = timeStr.trim();
  if (clean.includes('-')) {
    const start = clean.split('-')[0].trim();
    const [h] = start.split(':');
    return `${h.padStart(2, '0')}:00`;
  }
  const [h] = clean.split(':');
  return `${h.padStart(2, '0')}:00`;
}

// Calculate derived score based on completion history for a slot (requires >= 14 distinct days)
async function computeSlotDerivedScore(
  supabase: any,
  userId: string,
  normalizedSlot: string
): Promise<{ derivedScore: number | null; daysRecorded: number; completedCount: number; totalCount: number }> {
  try {
    // Query completions with matching time slot
    const { data: completions } = await supabase
      .from('schedule_completions')
      .select('date, status, time_slot, feedback')
      .eq('user_id', userId);

    const slotCompletions: any[] = (completions || []).filter((c: any) => {
      if (!c.time_slot) return false;
      return normalizeTimeSlot(c.time_slot) === normalizedSlot;
    });

    const distinctDates = new Set(slotCompletions.map((c: any) => c.date));
    const daysRecorded = distinctDates.size;

    // Minimum 14 distinct days required before deriving score
    if (daysRecorded < 14) {
      return {
        derivedScore: null,
        daysRecorded,
        completedCount: slotCompletions.filter((c: any) => c.status === 'completed').length,
        totalCount: slotCompletions.length,
      };
    }

    const completedCount = slotCompletions.filter((c: any) => c.status === 'completed').length;
    const totalCount = slotCompletions.length;

    // Weight completed blocks based on feedback:
    // 'great' = 1.0, 'good' / neutral = 0.85, 'tough' = 0.35, 'skipped' = 0.0
    let weightedSum = 0;
    for (const c of slotCompletions) {
      if (c.status === 'completed') {
        if (c.feedback === 'great') weightedSum += 1.0;
        else if (c.feedback === 'good') weightedSum += 0.85;
        else if (c.feedback === 'tough') weightedSum += 0.35;
        else weightedSum += 0.85;
      }
    }

    const score = totalCount > 0 ? Number((weightedSum / totalCount).toFixed(2)) : null;

    return {
      derivedScore: score,
      daysRecorded,
      completedCount,
      totalCount,
    };
  } catch (err) {
    console.warn('Error computing slot derived score:', err);
    return { derivedScore: null, daysRecorded: 0, completedCount: 0, totalCount: 0 };
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
    const dateParam = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase.from('energy_logs').select('*').eq('user_id', user.id);

    if (dateParam) {
      query = query.eq('date', dateParam);
    } else if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }

    let { data: logsData, error } = await query.order('time_block', { ascending: true });

    // Graceful handling if energy_logs table is not yet migrated
    if (error && error.code === '42P01') {
      logsData = [];
      error = null;
    }

    if (error) throw error;

    const logs: EnergyLog[] = (logsData || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      date: row.date,
      timeBlock: row.time_block,
      energyLevel: row.energy_level as EnergyLevel,
      derivedScore: row.derived_score !== null ? Number(row.derived_score) : null,
      createdAt: row.created_at,
    }));

    // Build per-slot patterns for standard daily waking hours (06:00 to 23:00)
    const standardHours = [
      '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
      '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
      '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
    ];

    const slotPatterns: Record<string, any> = {};

    for (const hour of standardHours) {
      const matchingLogs = logs.filter((l) => normalizeTimeSlot(l.timeBlock) === hour);
      const latestLog = matchingLogs[matchingLogs.length - 1];

      // Compute statistics for this slot
      const stats = await computeSlotDerivedScore(supabase, user.id, hour);

      // Rule: Manual tag ALWAYS overrides learned score if both exist
      let effectiveLevel: EnergyLevel = 'medium';
      if (latestLog?.energyLevel) {
        effectiveLevel = latestLog.energyLevel;
      } else if (stats.derivedScore !== null) {
        if (stats.derivedScore >= 0.75) effectiveLevel = 'high';
        else if (stats.derivedScore >= 0.40) effectiveLevel = 'medium';
        else effectiveLevel = 'low';
      }

      slotPatterns[hour] = {
        timeSlot: hour,
        manualLevel: latestLog?.energyLevel || null,
        derivedScore: stats.derivedScore,
        daysRecorded: stats.daysRecorded,
        hasTwoWeeksData: stats.daysRecorded >= 14,
        completedCount: stats.completedCount,
        totalCount: stats.totalCount,
        effectiveLevel,
      };
    }

    return NextResponse.json({
      success: true,
      logs,
      slotPatterns,
    });
  } catch (error: any) {
    console.error('Error fetching energy logs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { date, timeBlock, energyLevel } = body;

    if (!timeBlock || !energyLevel) {
      return NextResponse.json(
        { error: 'Missing required fields: timeBlock, energyLevel' },
        { status: 400 }
      );
    }

    if (!['low', 'medium', 'high'].includes(energyLevel)) {
      return NextResponse.json(
        { error: 'energyLevel must be one of: low, medium, high' },
        { status: 400 }
      );
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const normalizedSlot = normalizeTimeSlot(timeBlock);

    // Compute learned score if 2+ weeks of data exists
    const stats = await computeSlotDerivedScore(supabase, user.id, normalizedSlot);

    const payload = {
      user_id: user.id,
      date: targetDate,
      time_block: normalizedSlot,
      energy_level: energyLevel,
      derived_score: stats.derivedScore,
    };

    let { data, error } = await supabase
      .from('energy_logs')
      .upsert(payload, { onConflict: 'user_id,date,time_block' })
      .select()
      .single();

    if (error && error.code === '42P01') {
      // Table fallback response
      data = {
        id: `mock_${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
      };
      error = null;
    }

    if (error) throw error;

    const savedLog: EnergyLog = {
      id: data.id,
      userId: data.user_id,
      date: data.date,
      timeBlock: data.time_block,
      energyLevel: data.energy_level as EnergyLevel,
      derivedScore: data.derived_score !== null ? Number(data.derived_score) : null,
      createdAt: data.created_at,
    };

    return NextResponse.json({
      success: true,
      log: savedLog,
      stats: {
        daysRecorded: stats.daysRecorded,
        hasTwoWeeksData: stats.daysRecorded >= 14,
        derivedScore: stats.derivedScore,
      },
    });
  } catch (error: any) {
    console.error('Error saving energy log:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
