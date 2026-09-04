import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { detectConflicts } from '../conflicts/route';
import { FixedEvent, TodoItem, ScheduleBlock, GeneratedSchedule, ScheduleConflict } from '@/lib/types';

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

// Deterministic heuristic scheduler when LLM is unavailable or times out
function generateHeuristicSchedule(
  dateStr: string,
  fixedEvents: FixedEvent[],
  todos: TodoItem[],
  preferences: any,
  feedbackNotes: string
): { blocks: ScheduleBlock[]; summary: string } {
  const blocks: ScheduleBlock[] = [];

  const wakeMinutes = parseTimeToMinutes(preferences?.wake_time || '08:00');
  const sleepMinutes = parseTimeToMinutes(preferences?.sleep_time || '23:30');
  const peakEnergy = preferences?.peak_energy || 'morning';

  // 1. Add Fixed Commitments
  for (const fe of fixedEvents) {
    blocks.push({
      id: `fixed-${fe.id}`,
      title: fe.title,
      startTime: fe.startTime.slice(0, 5),
      endTime: fe.endTime.slice(0, 5),
      type: 'fixed',
      category: fe.category || 'Commitment',
      reason: 'Recurring commitment',
    });
  }

  // Sort fixed commitments
  blocks.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

  // 2. Identify free intervals
  interface TimeSlot {
    start: number;
    end: number;
  }

  const busySlots: TimeSlot[] = blocks.map((b) => ({
    start: parseTimeToMinutes(b.startTime),
    end: parseTimeToMinutes(b.endTime),
  }));

  // Add meal anchors if not overlapping
  const lunchSlot = { start: 12 * 60 + 30, end: 13 * 60 + 15 };
  const dinnerSlot = { start: 19 * 60 + 30, end: 20 * 60 + 15 };

  const isFree = (slot: TimeSlot) => !busySlots.some((b) => slot.start < b.end && slot.end > b.start);

  if (isFree(lunchSlot)) {
    blocks.push({
      id: `meal-lunch-${dateStr}`,
      title: 'Lunch & Recharge',
      startTime: '12:30',
      endTime: '13:15',
      type: 'meal',
      reason: 'Midday nutrition and break',
    });
    busySlots.push(lunchSlot);
  }

  if (isFree(dinnerSlot)) {
    blocks.push({
      id: `meal-dinner-${dateStr}`,
      title: 'Dinner & Relaxation',
      startTime: '19:30',
      endTime: '20:15',
      type: 'meal',
      reason: 'Evening break',
    });
    busySlots.push(dinnerSlot);
  }

  // Recalculate busy slots sorted
  busySlots.sort((a, b) => a.start - b.start);

  // Compute free slots between wake and sleep
  const freeSlots: TimeSlot[] = [];
  let currentPointer = wakeMinutes;

  for (const busy of busySlots) {
    if (busy.start > currentPointer + 15) {
      freeSlots.push({ start: currentPointer, end: busy.start });
    }
    currentPointer = Math.max(currentPointer, busy.end);
  }
  if (sleepMinutes > currentPointer + 15) {
    freeSlots.push({ start: currentPointer, end: sleepMinutes });
  }

  // 3. Sort todos with reverse-planning urgency (due soonest & high priority first)
  const sortedTodos = [...todos].sort((a, b) => {
    // Due date priority
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    // Priority ordering
    const pOrder = { high: 0, medium: 1, low: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });

  // 4. Fill free slots with sorted todos
  let todoIndex = 0;
  for (const slot of freeSlots) {
    let slotTime = slot.start;
    const slotEnd = slot.end;

    while (slotTime + 25 <= slotEnd && todoIndex < sortedTodos.length) {
      const todo = sortedTodos[todoIndex];
      const duration = Math.min(todo.estimatedDuration || 45, slotEnd - slotTime);

      if (duration >= 25) {
        const blockEnd = slotTime + duration;
        blocks.push({
          id: `todo-${todo.id}-${slotTime}`,
          title: `Focus: ${todo.title}`,
          startTime: minutesToTimeStr(slotTime),
          endTime: minutesToTimeStr(blockEnd),
          type: 'todo',
          todoId: todo.id,
          priority: todo.priority,
          reason: todo.dueDate
            ? `Reverse-planned for deadline ${new Date(todo.dueDate).toLocaleDateString()}`
            : `Priority task scheduled during open focus window`,
        });

        slotTime = blockEnd + 10; // 10 min buffer
        todoIndex++;
      } else {
        break;
      }
    }
  }

  // Sort all blocks chronologically
  blocks.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

  const summary = `Generated a balanced timetable tailored to your ${peakEnergy} rhythm with ${
    blocks.filter((b) => b.type === 'todo').length
  } priority focus blocks planned around your commitments.`;

  return { blocks, summary };
}

async function callLLMScheduleGenerator(
  dateStr: string,
  dayName: string,
  fixedEvents: FixedEvent[],
  todos: TodoItem[],
  preferences: any,
  feedbackHistory: string
): Promise<{ blocks: ScheduleBlock[]; summary: string } | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const prompt = `
You are an expert executive time-management and ML timetable assistant.
Generate a structured, realistic daily timetable for date: ${dateStr} (${dayName}).

USER CONSTRAINTS & DATA:
1. Fixed Commitments (NON-NEGOTIABLE):
${JSON.stringify(
  fixedEvents.map((e) => ({
    title: e.title,
    start: e.startTime.slice(0, 5),
    end: e.endTime.slice(0, 5),
    category: e.category,
  })),
  null,
  2
)}

2. Actionable Tasks (reverse-plan study/work blocks backwards from deadlines):
${JSON.stringify(
  todos.slice(0, 10).map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    priority: t.priority,
    durationMinutes: t.estimatedDuration || 45,
  })),
  null,
  2
)}

3. Stated Habits & Preferences:
- Wake time: ${preferences?.wake_time || '08:00'}
- Bedtime: ${preferences?.sleep_time || '23:30'}
- Peak energy window: ${preferences?.peak_energy || 'morning'}
- Workout preference: ${preferences?.workout_preference || 'none'}
- Stated habits: ${preferences?.raw_notes || 'Standard rhythm'}

4. Historical Feedback Loop (Past 7 Days):
${feedbackHistory || 'Consistent baseline. Maintain balanced focus intervals.'}

SCHEDULING RULES:
- NEVER overlap with any fixed commitment.
- Schedule highest priority tasks with nearest deadlines during the user's peak energy window.
- Reverse-plan tasks with impending deadlines so the user completes them with buffer.
- Include sensible meal and short buffer recharge breaks (10–15 min between intense work).
- Return an array of blocks covering the active day from wake to sleep.

Return JSON in this EXACT format:
{
  "summary": "1-2 sentence motivating summary explaining how today's schedule was balanced",
  "blocks": [
    {
      "id": "block-unique-id",
      "title": "Block Title",
      "startTime": "09:00",
      "endTime": "10:30",
      "type": "fixed" | "todo" | "routine" | "break" | "meal",
      "todoId": "optional-todo-id-if-linked",
      "priority": "high" | "medium" | "low",
      "reason": "Why this block is scheduled here"
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
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const targetDateStr = body.date || new Date().toISOString().split('T')[0];
    const forceRegenerate = Boolean(body.forceRegenerate);
    const ignoreConflicts = Boolean(body.ignoreConflicts);

    // Calculate day of week (0 = Sunday, 1 = Monday, ... 6 = Saturday)
    const targetDate = new Date(`${targetDateStr}T12:00:00Z`);
    const dayOfWeek = targetDate.getUTCDay();
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = DAY_NAMES[dayOfWeek];

    // Check if schedule already exists and not forced
    if (!forceRegenerate) {
      const { data: existingSchedule } = await supabase
        .from('generated_schedules')
        .select('*')
        .eq('user_id', user.id)
        .eq('schedule_date', targetDateStr)
        .maybeSingle();

      if (existingSchedule) {
        // Merge with existing completions
        const { data: completions } = await supabase
          .from('schedule_completions')
          .select('block_id, status')
          .eq('schedule_id', existingSchedule.id);

        const compMap: Record<string, string> = {};
        (completions || []).forEach((c) => {
          compMap[c.block_id] = c.status;
        });

        const mergedBlocks = (existingSchedule.blocks || []).map((b: ScheduleBlock) => ({
          ...b,
          isCompleted: compMap[b.id] === 'completed',
          isSkipped: compMap[b.id] === 'skipped',
        }));

        return NextResponse.json({
          schedule: {
            ...existingSchedule,
            blocks: mergedBlocks,
          },
          cached: true,
        });
      }
    }

    // 1. Fetch fixed commitments for this day of week
    const { data: fixedRows } = await supabase
      .from('fixed_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('day_of_week', dayOfWeek)
      .order('start_time', { ascending: true });

    const fixedEvents: FixedEvent[] = (fixedRows || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      dayOfWeek: r.day_of_week,
      startTime: r.start_time,
      endTime: r.end_time,
      category: r.category,
      createdAt: r.created_at,
    }));

    // 2. Conflict Detection before generation
    const conflicts: ScheduleConflict[] = detectConflicts(fixedEvents);

    if (conflicts.length > 0 && !ignoreConflicts) {
      return NextResponse.json(
        {
          hasConflicts: true,
          conflicts,
          message: `Detected ${conflicts.length} overlapping fixed commitment(s) on ${dayName}. Please resolve these overlaps or confirm to proceed.`,
        },
        { status: 409 }
      );
    }

    // 3. Fetch active open todos
    const { data: todoRows } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .eq('completed', false)
      .order('due_date', { ascending: true, nullsFirst: false });

    const todos: TodoItem[] = (todoRows || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      dueDate: r.due_date,
      priority: r.priority,
      estimatedDuration: r.estimated_duration,
      completed: r.completed,
      category: r.category,
      createdAt: r.created_at,
    }));

    // 4. Fetch user preferences
    const { data: prefRow } = await supabase
      .from('user_schedule_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const preferences = prefRow?.parsed_preferences || {
      wake_time: '08:00',
      sleep_time: '23:30',
      peak_energy: 'morning',
    };

    // 5. Fetch feedback loop context (last 7 days' completions and skips)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: pastCompletions } = await supabase
      .from('schedule_completions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0]);

    let feedbackHistory = '';
    if (pastCompletions && pastCompletions.length > 0) {
      const skippedCount = pastCompletions.filter((c) => c.status === 'skipped').length;
      const completedCount = pastCompletions.filter((c) => c.status === 'completed').length;
      feedbackHistory = `User completed ${completedCount} blocks and skipped ${skippedCount} blocks recently. Adjust accordingly.`;
    }

    // 6. Generate Timetable via LLM or Heuristic
    let result = await callLLMScheduleGenerator(
      targetDateStr,
      dayName,
      fixedEvents,
      todos,
      preferences,
      feedbackHistory
    );

    if (!result || !result.blocks || result.blocks.length === 0) {
      result = generateHeuristicSchedule(
        targetDateStr,
        fixedEvents,
        todos,
        preferences,
        feedbackHistory
      );
    }

    // 7. Save generated schedule to database
    const { data: savedSchedule, error: saveErr } = await supabase
      .from('generated_schedules')
      .upsert(
        {
          user_id: user.id,
          schedule_date: targetDateStr,
          blocks: result.blocks,
          summary: result.summary,
          conflicts: conflicts.length > 0 ? conflicts : [],
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,schedule_date' }
      )
      .select()
      .single();

    if (saveErr) throw saveErr;

    return NextResponse.json({
      success: true,
      schedule: {
        id: savedSchedule.id,
        userId: savedSchedule.user_id,
        scheduleDate: savedSchedule.schedule_date,
        blocks: savedSchedule.blocks,
        summary: savedSchedule.summary,
        conflicts: savedSchedule.conflicts || [],
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

    // Merge with current block completions
    const { data: completions } = await supabase
      .from('schedule_completions')
      .select('block_id, status')
      .eq('schedule_id', schedule.id);

    const compMap: Record<string, string> = {};
    (completions || []).forEach((c) => {
      compMap[c.block_id] = c.status;
    });

    const blocksWithStatus = (schedule.blocks || []).map((b: ScheduleBlock) => ({
      ...b,
      isCompleted: compMap[b.id] === 'completed',
      isSkipped: compMap[b.id] === 'skipped',
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
