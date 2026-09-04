import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { FixedEvent, SchedulePreferences } from '@/lib/types';

interface ParseScheduleTextResponse {
  fixedEvents: {
    title: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    category?: string;
  }[];
  preferences: {
    wakeTime?: string;
    sleepTime?: string;
    peakEnergy?: 'morning' | 'afternoon' | 'evening' | 'night';
    workoutPreference?: string;
    focusDuration?: number;
    summaryNotes?: string;
  };
}

// Heuristic fallback parser if LLM keys are absent or API times out
function heuristicParse(text: string): ParseScheduleTextResponse {
  const lower = text.toLowerCase();
  const fixedEvents: ParseScheduleTextResponse['fixedEvents'] = [];
  const preferences: ParseScheduleTextResponse['preferences'] = {};

  // Detect days of week
  const dayMap: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
  };

  // Detect chronotype / peak energy
  if (lower.includes('night owl') || lower.includes('late night') || lower.includes('stay up late')) {
    preferences.peakEnergy = 'night';
    preferences.wakeTime = '09:30';
    preferences.sleepTime = '01:30';
  } else if (lower.includes('early bird') || lower.includes('morning person') || lower.includes('wake up early')) {
    preferences.peakEnergy = 'morning';
    preferences.wakeTime = '06:30';
    preferences.sleepTime = '22:30';
  } else if (lower.includes('afternoon')) {
    preferences.peakEnergy = 'afternoon';
  } else if (lower.includes('evening')) {
    preferences.peakEnergy = 'evening';
  }

  // Detect workout preferences
  if (lower.includes('workout') || lower.includes('gym') || lower.includes('exercise')) {
    if (lower.includes('evening') || lower.includes('night')) {
      preferences.workoutPreference = 'evening (18:00–19:30)';
    } else if (lower.includes('morning')) {
      preferences.workoutPreference = 'morning (07:00–08:30)';
    } else {
      preferences.workoutPreference = 'afternoon';
    }
  }

  // Simple regex for events like "gym every monday from 5pm to 6:30pm" or "physics class tuesdays 10:00 to 11:30"
  const timeRegex = /(?:every\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)s?\s+(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;

  let match;
  while ((match = timeRegex.exec(lower)) !== null) {
    const dayStr = match[1].toLowerCase();
    const startStr = match[2];
    const endStr = match[3];

    const dayOfWeek = dayMap[dayStr];
    if (dayOfWeek !== undefined) {
      const formatTime = (t: string) => {
        let isPm = t.toLowerCase().includes('pm');
        let isAm = t.toLowerCase().includes('am');
        let clean = t.replace(/(am|pm)/gi, '').trim();
        let parts = clean.split(':');
        let h = parseInt(parts[0], 10);
        let m = parts[1] ? parseInt(parts[1], 10) : 0;
        if (isPm && h < 12) h += 12;
        if (isAm && h === 12) h = 0;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      };

      fixedEvents.push({
        title: 'Scheduled Commitment',
        dayOfWeek,
        startTime: formatTime(startStr),
        endTime: formatTime(endStr),
        category: 'Routine',
      });
    }
  }

  preferences.summaryNotes = text.slice(0, 300);

  return { fixedEvents, preferences };
}

async function callLLMParse(text: string): Promise<ParseScheduleTextResponse> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const prompt = `
You are an intelligent schedule and habit assistant.
Analyze the user's free-form description of their schedule, commitments, and energy habits:
"""
${text}
"""

Extract:
1. "fixedEvents": Array of any specific recurring commitments mentioned (e.g. classes, gym, meetings).
   Each object MUST have:
   - "title": Clean title (e.g. "Biology Lab", "Gym Workout", "Team Standup")
   - "dayOfWeek": Integer 0 to 6 (0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday)
   - "startTime": "HH:MM" 24-hour time (e.g. "09:00", "14:30")
   - "endTime": "HH:MM" 24-hour time (e.g. "10:30", "16:00")
   - "category": Short label e.g. "Class", "Fitness", "Work", "Personal"

2. "preferences": Object extracting habits:
   - "wakeTime": "HH:MM" (default "08:00" if unmentioned or infer from morning/night owl)
   - "sleepTime": "HH:MM" (default "23:30" if unmentioned or infer)
   - "peakEnergy": One of "morning" | "afternoon" | "evening" | "night"
   - "workoutPreference": String note (e.g. "evening workouts")
   - "focusDuration": Integer minutes (e.g. 45 or 50)
   - "summaryNotes": Concise 1-sentence summary of stated habits

Return ONLY valid JSON with keys "fixedEvents" and "preferences". No markdown backticks, no extra text.
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
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawContent) {
          return JSON.parse(rawContent.replace(/```json/g, '').replace(/```/g, '').trim());
        }
      }
    } catch (e) {
      console.warn('Gemini schedule parsing failed:', e);
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
        if (content) return JSON.parse(content);
      }
    } catch (e) {
      console.warn('OpenAI schedule parsing failed:', e);
    }
  }

  // Fallback to heuristic parser
  return heuristicParse(text);
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rawText } = await req.json();

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
    }

    const parsed = await callLLMParse(rawText.trim());

    // 1. Insert extracted fixed events
    let insertedEvents: FixedEvent[] = [];
    if (parsed.fixedEvents && parsed.fixedEvents.length > 0) {
      const eventsToInsert = parsed.fixedEvents.map((e) => ({
        user_id: user.id,
        title: e.title || 'Scheduled Commitment',
        day_of_week: e.dayOfWeek,
        start_time: e.startTime,
        end_time: e.endTime,
        category: e.category || 'General',
      }));

      const { data: eventsData, error: eventErr } = await supabase
        .from('fixed_events')
        .insert(eventsToInsert)
        .select();

      if (!eventErr && eventsData) {
        insertedEvents = eventsData.map((row) => ({
          id: row.id,
          userId: row.user_id,
          title: row.title,
          dayOfWeek: row.day_of_week,
          startTime: row.start_time,
          endTime: row.end_time,
          category: row.category,
        }));
      }
    }

    // 2. Save / Update user schedule preferences
    const preferencesPayload = {
      wake_time: parsed.preferences?.wakeTime || '08:00',
      sleep_time: parsed.preferences?.sleepTime || '23:30',
      peak_energy: parsed.preferences?.peakEnergy || 'morning',
      workout_preference: parsed.preferences?.workoutPreference || null,
      focus_duration: parsed.preferences?.focusDuration || 45,
      summary_notes: parsed.preferences?.summaryNotes || rawText.slice(0, 200),
    };

    const { data: prefData, error: prefErr } = await supabase
      .from('user_schedule_preferences')
      .upsert(
        {
          user_id: user.id,
          raw_notes: rawText.trim(),
          parsed_preferences: preferencesPayload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (prefErr) {
      console.warn('Error saving schedule preferences:', prefErr);
    }

    return NextResponse.json({
      success: true,
      message: `Parsed successfully: ${insertedEvents.length} recurring commitment(s) added, habits updated.`,
      addedEvents: insertedEvents,
      preferences: prefData?.parsed_preferences || preferencesPayload,
    });
  } catch (error: any) {
    console.error('Error in /api/schedule/parse-text:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
