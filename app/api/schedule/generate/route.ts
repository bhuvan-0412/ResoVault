import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { detectAllScheduleConflicts } from '../conflicts/route';
import {
  FixedClass,
  FixedEvent,
  Deadline,
  TodoItem,
  ScheduleBlock,
  GeneratedSchedule,
  ScheduleConflict,
  EnergyLevel,
} from '@/lib/types';

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function minutesToTimeStr(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Map energy level string for a time window
function getSlotEnergy(
  startMinutes: number,
  energyMap: Record<string, EnergyLevel>
): EnergyLevel | 'unknown' {
  const hour = Math.floor(startMinutes / 60);
  const slotKey = `${hour.toString().padStart(2, '0')}:00`;
  return energyMap[slotKey] || 'unknown';
}

interface HeuristicParams {
  dateStr: string;
  dayName: string;
  fixedClasses: FixedClass[];
  lockedBlocks: ScheduleBlock[];
  deadlines: Deadline[];
  energyMap: Record<string, EnergyLevel>;
  preferences: any;
  feedbackNotes: string;
}

// Deterministic heuristic scheduler when LLM is offline or fails
function generateHeuristicSchedule({
  dateStr,
  dayName,
  fixedClasses,
  lockedBlocks,
  deadlines,
  energyMap,
  preferences,
  feedbackNotes,
}: HeuristicParams): { blocks: ScheduleBlock[]; summary: string } {
  const blocks: ScheduleBlock[] = [];

  const wakeMinutes = parseTimeToMinutes(preferences?.wake_time || '08:00');
  const sleepMinutes = parseTimeToMinutes(preferences?.sleep_time || '23:30');

  // 1. Add all locked completed/in-progress blocks first (unmovable)
  for (const lb of lockedBlocks) {
    blocks.push({
      ...lb,
      reason: lb.reason || 'Locked session from earlier in the day',
    });
  }

  // 2. Add all fixed classes (non-negotiable locked commitments)
  for (const fc of fixedClasses) {
    // Avoid re-adding if already represented in lockedBlocks
    const alreadyLocked = lockedBlocks.some(
      (b) => b.startTime === fc.startTime.slice(0, 5) && b.title === fc.title
    );
    if (!alreadyLocked) {
      blocks.push({
        id: `class-${fc.id}`,
        title: fc.title,
        startTime: fc.startTime.slice(0, 5),
        endTime: fc.endTime.slice(0, 5),
        type: 'class',
        category: fc.category || 'Class',
        reason: 'Locked recurring class commitment',
      });
    }
  }

  // Sort existing locked and class blocks
  blocks.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

  // 3. Mark busy intervals
  interface TimeSlot {
    start: number;
    end: number;
  }

  const busySlots: TimeSlot[] = blocks.map((b) => ({
    start: parseTimeToMinutes(b.startTime),
    end: parseTimeToMinutes(b.endTime),
  }));

  // Add standard meal breaks if slots are free
  const lunchSlot = { start: 12 * 60 + 30, end: 13 * 60 + 15 };
  const dinnerSlot = { start: 19 * 60 + 30, end: 20 * 60 + 15 };

  const isFree = (slot: TimeSlot) => !busySlots.some((b) => slot.start < b.end && slot.end > b.start);

  if (isFree(lunchSlot)) {
    blocks.push({
      id: `break-lunch-${dateStr}`,
      title: 'Lunch & Recharge Break',
      startTime: '12:30',
      endTime: '13:15',
      type: 'break',
      reason: 'Nutrition and mental recharge buffer',
    });
    busySlots.push(lunchSlot);
  }

  if (isFree(dinnerSlot)) {
    blocks.push({
      id: `break-dinner-${dateStr}`,
      title: 'Dinner & Relaxation Break',
      startTime: '19:30',
      endTime: '20:15',
      type: 'break',
      reason: 'Evening break buffer',
    });
    busySlots.push(dinnerSlot);
  }

  busySlots.sort((a, b) => a.start - b.start);

  // 4. Compute uncommitted free intervals between wake and sleep
  const freeSlots: TimeSlot[] = [];
  let pointer = wakeMinutes;

  for (const busy of busySlots) {
    if (busy.start > pointer + 15) {
      freeSlots.push({ start: pointer, end: busy.start });
    }
    pointer = Math.max(pointer, busy.end);
  }
  if (sleepMinutes > pointer + 15) {
    freeSlots.push({ start: pointer, end: sleepMinutes });
  }

  // 5. Backward scheduling from deadlines (closest due_date & high priority first)
  const sortedDeadlines = [...deadlines].sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (diff !== 0) return diff;
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    const pOrder = { high: 0, medium: 1, low: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });

  // 6. Allocate focus blocks into free slots respecting energy and breaks
  let deadlineIdx = 0;
  for (const slot of freeSlots) {
    let slotTime = slot.start;
    const slotEnd = slot.end;

    while (slotTime + 25 <= slotEnd && deadlineIdx < sortedDeadlines.length) {
      const deadline = sortedDeadlines[deadlineIdx];
      const slotEnergy = getSlotEnergy(slotTime, energyMap);

      // If slot is low energy, check if this is high priority and we can schedule a lighter session
      const isHighEffort = deadline.priority === 'high';
      const isLowEnergy = slotEnergy === 'low';

      // Duration: 45 min default, cap to available slot minus buffer
      const duration = Math.min(deadline.estimatedDuration || 45, slotEnd - slotTime);
      if (duration < 25) break;

      const blockEnd = slotTime + duration;
      const titlePrefix = isLowEnergy && isHighEffort ? 'Review / Prep' : 'Focus';

      blocks.push({
        id: `study-${deadline.id}-${slotTime}`,
        title: `${titlePrefix}: ${deadline.title}`,
        startTime: minutesToTimeStr(slotTime),
        endTime: minutesToTimeStr(blockEnd),
        type: 'study',
        linkedDeadlineId: deadline.id,
        todoId: deadline.id,
        priority: deadline.priority,
        energyLevelRequired: isLowEnergy ? 'low' : isHighEffort ? 'high' : 'medium',
        reason: isLowEnergy
          ? `Low-energy window utilized for lighter prep session before deadline on ${deadline.dueDate}`
          : `Reverse-planned focus session leading up to due date ${deadline.dueDate}`,
      });

      // Insert 10-15 min break between intense work blocks
      slotTime = blockEnd + 15;
      deadlineIdx++;
    }
  }

  blocks.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

  const summary = `Reverse-planned timetable for ${dayName}: scheduled ${
    blocks.filter((b) => b.type === 'study' || b.type === 'task').length
  } focus sessions aligned with your energy rhythm and locked commitments, with buffers for recovery.`;

  return { blocks, summary };
}

// Constraint-aware LLM Schedule Generator
async function callLLMScheduleGenerator({
  dateStr,
  dayName,
  fixedClasses,
  lockedBlocks,
  deadlines,
  energyMap,
  preferences,
  feedbackNotes,
}: HeuristicParams): Promise<{ blocks: ScheduleBlock[]; summary: string } | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const prompt = `
You are an expert executive time-management assistant.
Generate an optimized, constraint-aware daily schedule for ${dayName}, ${dateStr}.

CONSTRAINTS & DATA:
1. Locked Fixed Classes (NON-NEGOTIABLE — DO NOT MOVE OR OVERWRITE):
${JSON.stringify(
  fixedClasses.map((c) => ({
    title: c.title,
    start: c.startTime.slice(0, 5),
    end: c.endTime.slice(0, 5),
    category: c.category || 'Class',
    location: c.location,
  })),
  null,
  2
)}

2. Already Completed / In-Progress Blocks Today (DO NOT TOUCH OR REMOVE):
${JSON.stringify(
  lockedBlocks.map((b) => ({
    id: b.id,
    title: b.title,
    start: b.startTime,
    end: b.endTime,
    status: b.isCompleted ? 'completed' : b.status || 'in_progress',
  })),
  null,
  2
)}

3. Open Deadlines (Reverse-plan study/work sessions leading up to each due_date, prioritizing sooner deadlines and high priority):
${JSON.stringify(
  deadlines.slice(0, 10).map((d) => ({
    id: d.id,
    title: d.title,
    dueDate: d.dueDate,
    dueTime: d.dueTime,
    priority: d.priority,
    estimatedMinutes: d.estimatedDuration || 45,
  })),
  null,
  2
)}

4. Hourly Energy Rhythm Map for ${dateStr} (06:00 to 23:00):
${JSON.stringify(energyMap, null, 2)}

5. Stated Habits & Preferences:
- Wake time: ${preferences?.wake_time || '08:00'}
- Bedtime: ${preferences?.sleep_time || '23:30'}
- Peak energy window: ${preferences?.peak_energy || 'morning'}

SCHEDULING RULES:
1. LOCKED COMMITMENTS & PAST WORK:
   - Fixed classes and already completed/in-progress blocks are strictly locked at their times.
   - Do NOT overlap with any locked block or fixed class.
2. REVERSE-PLANNING & PRIORITIZATION:
   - Work backward from each deadline's due_date. Prioritize deadlines due sooner and marked 'high' priority.
   - Reason about tradeoffs if deadlines compete (e.g. allocate time for the closer deadline first).
3. ENERGY-AWARE SCHEDULING:
   - Avoid scheduling high-effort/heavy cognitive tasks in slots where energy is tagged or learned as 'low'.
   - If a low-energy slot must be used (e.g. no other time available before an urgent deadline), schedule something lighter (review, reading, outline) instead of leaving it idle.
4. HEALTHY PACING & BREAKS:
   - Include 10-15 min buffers/breaks between work sessions.
   - Do NOT pack blocks back-to-back at 100% utilization.
   - Include meal recharge windows (e.g. Lunch ~12:30, Dinner ~19:30).

Return valid JSON with this exact schema:
{
  "summary": "1-2 sentence motivating summary explaining the scheduling strategy and energy alignment",
  "blocks": [
    {
      "id": "unique-block-id",
      "title": "Block Title",
      "startTime": "09:00",
      "endTime": "10:15",
      "type": "class" | "study" | "task" | "break" | "free",
      "linkedDeadlineId": "optional-deadline-id-if-linked",
      "todoId": "optional-deadline-id-if-linked",
      "priority": "high" | "medium" | "low",
      "energyLevelRequired": "low" | "medium" | "high",
      "reason": "Why this block was placed here"
    }
  ]
}
`;

  // 1. Try Gemini
  if (geminiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          const parsed = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
          if (parsed.blocks && Array.isArray(parsed.blocks)) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Gemini schedule generation failed:', e);
    }
  }

  // 2. Try OpenAI
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.blocks && Array.isArray(parsed.blocks)) return parsed;
        }
      }
    } catch (e) {
      console.warn('OpenAI schedule generation failed:', e);
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const cronUserId = req.headers.get('x-cron-user-id');
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCron = Boolean(cronUserId && (cronSecret ? authHeader === `Bearer ${cronSecret}` : true));

    let supabase: any;
    let userId: string;

    if (isCron && cronUserId) {
      const { createServiceRoleSupabaseClient } = await import('@/lib/supabase/server');
      supabase = createServiceRoleSupabaseClient();
      userId = cronUserId;
    } else {
      supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
    }

    const body = await req.json().catch(() => ({}));
    const targetDateStr = body.date || new Date().toISOString().split('T')[0];
    const forceRegenerate = Boolean(body.forceRegenerate);

    const targetDate = new Date(`${targetDateStr}T12:00:00Z`);
    const dayOfWeek = targetDate.getUTCDay();
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = DAY_NAMES[dayOfWeek];

    // 1. Fetch existing schedule (if any) for target date
    const { data: existingSchedule } = await supabase
      .from('generated_schedules')
      .select('*')
      .eq('user_id', userId)
      .eq('schedule_date', targetDateStr)
      .maybeSingle();

    // Fetch existing completions
    const { data: completions } = await supabase
      .from('schedule_completions')
      .select('block_id, status')
      .eq('date', targetDateStr)
      .eq('user_id', userId);

    const compMap: Record<string, string> = {};
    (completions || []).forEach((c: any) => {
      compMap[c.block_id] = c.status;
    });

    // If not forced and already exists, return cached schedule
    if (!forceRegenerate && existingSchedule) {
      const mergedBlocks = (existingSchedule.blocks || []).map((b: ScheduleBlock) => ({
        ...b,
        isCompleted: compMap[b.id] === 'completed' || b.isCompleted,
        isSkipped: compMap[b.id] === 'skipped' || b.isSkipped,
      }));

      return NextResponse.json({
        schedule: {
          ...existingSchedule,
          blocks: mergedBlocks,
        },
        cached: true,
      });
    }

    // 2. Identify locked completed or in-progress blocks
    // RULE: On any regeneration, don't touch blocks already completed or in-progress!
    const lockedBlocks: ScheduleBlock[] = [];
    if (existingSchedule && existingSchedule.blocks) {
      for (const b of existingSchedule.blocks) {
        const isDone = compMap[b.id] === 'completed' || b.isCompleted;
        const isInProgress = b.status === 'in_progress';
        if (isDone || isInProgress) {
          lockedBlocks.push({
            ...b,
            isCompleted: isDone,
            status: isDone ? 'completed' : 'in_progress',
          });
        }
      }
    }

    // 3. Fetch Fixed Classes (check fixed_classes first, then fixed_events)
    let fixedRows: any[] = [];
    let { data: fcData, error: fcErr } = await supabase
      .from('fixed_classes')
      .select('*')
      .eq('user_id', userId)
      .eq('day_of_week', dayOfWeek)
      .order('start_time', { ascending: true });

    if (fcErr && fcErr.code === '42P01') {
      const { data: legacyData } = await supabase
        .from('fixed_events')
        .select('*')
        .eq('user_id', userId)
        .eq('day_of_week', dayOfWeek)
        .order('start_time', { ascending: true });
      fixedRows = legacyData || [];
    } else {
      fixedRows = fcData || [];
    }

    const fixedClasses: FixedClass[] = fixedRows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      dayOfWeek: r.day_of_week,
      startTime: r.start_time,
      endTime: r.end_time,
      location: r.location,
      color: r.color,
      category: r.category,
      createdAt: r.created_at,
    }));

    // 4. Fetch open Deadlines (check deadlines first, then todos)
    let deadlineRows: any[] = [];
    let { data: dlData, error: dlErr } = await supabase
      .from('deadlines')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false });

    if (dlErr && dlErr.code === '42P01') {
      const { data: legacyTodos } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', false)
        .order('due_date', { ascending: true, nullsFirst: false });
      deadlineRows = legacyTodos || [];
    } else {
      deadlineRows = dlData || [];
    }

    const deadlines: Deadline[] = deadlineRows
      .filter((r) => !r.completed && r.status !== 'done')
      .map((r) => ({
        id: r.id,
        userId: r.user_id,
        title: r.title,
        description: r.description,
        dueDate: r.due_date,
        dueTime: r.due_time,
        category: r.category,
        priority: r.priority || 'medium',
        status: r.status || 'not_started',
        estimatedDuration: r.estimated_duration || 45,
        completed: false,
      }));

    // 5. Conflict Detection (both overlapping classes & unachievable deadlines)
    const conflicts: ScheduleConflict[] = detectAllScheduleConflicts(
      fixedClasses,
      deadlines,
      targetDateStr
    );

    // 6. Fetch Energy Profile for this user and date
    const energyMap: Record<string, EnergyLevel> = {};
    try {
      const { data: energyRows } = await supabase
        .from('energy_logs')
        .select('time_block, energy_level, derived_score')
        .eq('user_id', userId)
        .or(`date.eq.${targetDateStr},derived_score.not.is.null`);

      if (energyRows) {
        energyRows.forEach((row: any) => {
          const slot = (row.time_block || '').slice(0, 5);
          if (!slot) return;
          // Priority: manual tag on target date > derived score
          if (row.energy_level && !energyMap[slot]) {
            energyMap[slot] = row.energy_level as EnergyLevel;
          } else if (row.derived_score !== null && !energyMap[slot]) {
            const score = Number(row.derived_score);
            if (score >= 0.75) energyMap[slot] = 'high';
            else if (score >= 0.4) energyMap[slot] = 'medium';
            else energyMap[slot] = 'low';
          }
        });
      }
    } catch (e) {
      console.warn('Energy logs query skipped:', e);
    }

    // 7. Fetch user preferences
    const { data: prefRow } = await supabase
      .from('user_schedule_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const preferences = prefRow?.parsed_preferences || {
      wake_time: '08:00',
      sleep_time: '23:30',
      peak_energy: 'morning',
    };

    const feedbackNotes = `Energy map loaded with ${Object.keys(energyMap).length} configured slots.`;

    // 8. Generate Schedule via LLM (with heuristic fallback)
    const params: HeuristicParams = {
      dateStr: targetDateStr,
      dayName,
      fixedClasses,
      lockedBlocks,
      deadlines,
      energyMap,
      preferences,
      feedbackNotes,
    };

    let result = await callLLMScheduleGenerator(params);

    if (!result || !result.blocks || result.blocks.length === 0) {
      result = generateHeuristicSchedule(params);
    }

    // 9. Merge: Guarantee that locked completed/in-progress blocks remain intact
    const finalBlocksMap = new Map<string, ScheduleBlock>();

    // First insert locked blocks
    for (const lb of lockedBlocks) {
      finalBlocksMap.set(lb.id, lb);
    }

    // Next insert newly generated blocks if they don't replace a locked block
    for (const nb of result.blocks) {
      if (!finalBlocksMap.has(nb.id)) {
        // Ensure status is marked completed if it was done in compMap
        const isDone = compMap[nb.id] === 'completed' || nb.isCompleted;
        finalBlocksMap.set(nb.id, {
          ...nb,
          isCompleted: isDone,
          status: isDone ? 'completed' : nb.status || 'planned',
        });
      }
    }

    const finalBlocks = Array.from(finalBlocksMap.values()).sort(
      (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
    );

    // 10. Persist schedule to generated_schedules and sync to schedule_blocks
    const { data: savedSchedule, error: saveErr } = await supabase
      .from('generated_schedules')
      .upsert(
        {
          user_id: userId,
          schedule_date: targetDateStr,
          blocks: finalBlocks,
          summary: result.summary,
          conflicts: conflicts.length > 0 ? conflicts : [],
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,schedule_date' }
      )
      .select()
      .single();

    if (saveErr) throw saveErr;

    // Sync to schedule_blocks table if available
    try {
      for (const b of finalBlocks) {
        await supabase.from('schedule_blocks').upsert({
          id: b.id.includes('-') && b.id.length === 36 ? b.id : undefined,
          user_id: userId,
          date: targetDateStr,
          start_time: b.startTime,
          end_time: b.endTime,
          title: b.title,
          type: ['class', 'study', 'task', 'break', 'free'].includes(b.type) ? b.type : 'study',
          linked_deadline_id: b.linkedDeadlineId || b.todoId || null,
          energy_level_required: b.energyLevelRequired || null,
          status: b.isCompleted ? 'completed' : b.isSkipped ? 'skipped' : 'planned',
        });
      }
    } catch (sbErr) {
      // Ignore if schedule_blocks table is pending remote migration
    }

    return NextResponse.json({
      success: true,
      schedule: {
        id: savedSchedule.id,
        userId: savedSchedule.user_id,
        scheduleDate: savedSchedule.schedule_date,
        blocks: finalBlocks,
        summary: savedSchedule.summary,
        conflicts,
        createdAt: savedSchedule.created_at,
      },
      hasConflicts: conflicts.length > 0,
      conflicts,
    });
  } catch (error: any) {
    console.error('Error generating schedule:', error);
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
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const { data: schedule } = await supabase
      .from('generated_schedules')
      .select('*')
      .eq('user_id', user.id)
      .eq('schedule_date', dateStr)
      .maybeSingle();

    if (!schedule) {
      return NextResponse.json({ schedule: null });
    }

    // Merge with current completions
    const { data: completions } = await supabase
      .from('schedule_completions')
      .select('block_id, status')
      .eq('schedule_id', schedule.id);

    const compMap: Record<string, string> = {};
    (completions || []).forEach((c: any) => {
      compMap[c.block_id] = c.status;
    });

    const blocksWithStatus = (schedule.blocks || []).map((b: ScheduleBlock) => ({
      ...b,
      isCompleted: compMap[b.id] === 'completed' || b.isCompleted,
      isSkipped: compMap[b.id] === 'skipped' || b.isSkipped,
    }));

    return NextResponse.json({
      schedule: {
        id: schedule.id,
        userId: schedule.user_id,
        scheduleDate: schedule.schedule_date,
        blocks: blocksWithStatus,
        summary: schedule.summary,
        conflicts: schedule.conflicts || [],
        createdAt: schedule.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error getting schedule:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
