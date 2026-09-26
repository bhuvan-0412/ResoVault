import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ParsedCandidateItem, DayOfWeek } from '@/lib/types';

interface LLMParsedItem {
  title: string;
  dayOfWeek: number; // 0-6
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  location?: string;
  color?: string;
  type?: 'class' | 'task';
  category?: string;
}

// Regex / Heuristic fallback parser
function heuristicParse(text: string): { candidates: LLMParsedItem[]; preferences: any } {
  const lower = text.toLowerCase();
  const candidates: LLMParsedItem[] = [];
  const preferences: any = {};

  const dayMap: Record<string, number[]> = {
    sunday: [0], sun: [0],
    monday: [1], mon: [1],
    tuesday: [2], tue: [2], tues: [2],
    wednesday: [3], wed: [3],
    thursday: [4], thu: [4], thur: [4], thurs: [4],
    friday: [5], fri: [5],
    saturday: [6], sat: [6],
    mwf: [1, 3, 5],
    tt: [2, 4],
    tth: [2, 4],
    weekdays: [1, 2, 3, 4, 5],
    daily: [0, 1, 2, 3, 4, 5, 6],
  };

  // Helper time formatter
  const formatTime = (t: string) => {
    const isPm = t.toLowerCase().includes('pm');
    const isAm = t.toLowerCase().includes('am');
    const clean = t.replace(/(am|pm)/gi, '').trim();
    const parts = clean.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] ? parseInt(parts[1], 10) : 0;
    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Check MWF pattern e.g. "gym every MWF 6am" or "gym MWF 6am to 7am"
  const mwfRegex = /(?:every\s+)?(mwf|tt|tth|weekdays|daily)\s+(?:at\s+|from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?:\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/gi;
  let mwfMatch;
  while ((mwfMatch = mwfRegex.exec(lower)) !== null) {
    const days = dayMap[mwfMatch[1].toLowerCase()] || [1];
    const startStr = mwfMatch[2];
    let start = formatTime(startStr);
    let end = mwfMatch[3] ? formatTime(mwfMatch[3]) : '';
    if (!end) {
      const [h, m] = start.split(':').map(Number);
      end = `${((h + 1) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
    for (const d of days) {
      candidates.push({
        title: lower.includes('gym') ? 'Gym Workout' : 'Routine Commitment',
        dayOfWeek: d,
        startTime: start,
        endTime: end,
        type: 'class',
        color: 'emerald',
        category: lower.includes('gym') ? 'Fitness' : 'Routine',
      });
    }
  }

  // Standard regex for "every tuesday 10am to 11:30am" or "club meeting thursdays 5pm"
  const singleDayRegex = /(?:every\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)s?\s+(?:at\s+|from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?:\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/gi;
  let singleMatch;
  while ((singleMatch = singleDayRegex.exec(lower)) !== null) {
    const days = dayMap[singleMatch[1].toLowerCase()] || [1];
    const startStr = singleMatch[2];
    let start = formatTime(startStr);
    let end = singleMatch[3] ? formatTime(singleMatch[3]) : '';
    if (!end) {
      const [h, m] = start.split(':').map(Number);
      end = `${((h + 1) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
    const day = days[0];
    let title = 'Meeting / Commitment';
    if (lower.includes('club')) title = 'Club Meeting';
    else if (lower.includes('lecture') || lower.includes('class')) title = 'Class Lecture';
    else if (lower.includes('lab')) title = 'Lab Session';

    candidates.push({
      title,
      dayOfWeek: day,
      startTime: start,
      endTime: end,
      type: 'class',
      color: 'indigo',
      category: 'Commitment',
    });
  }

  preferences.summary = text.slice(0, 200);
  return { candidates, preferences };
}

async function callLLMParse(text: string): Promise<{ candidates: LLMParsedItem[]; preferences: any }> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const prompt = `
You are an intelligent scheduling parser for student & professional timetables.
Analyze the user's natural language input:
"""
${text}
"""

Extract all schedule items mentioned (classes, recurring meetings, gym, club sessions, study habits).
For each item, determine:
- "title": Concise, clean title (e.g. "Gym Workout", "Physics Lecture", "Club Meeting")
- "dayOfWeek": Integer 0 to 6 (0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday).
  If multiple days are specified (e.g. "MWF" or "every Tuesday and Thursday"), return separate entries for each day!
- "startTime": "HH:MM" 24-hour format (e.g. "06:00", "14:30")
- "endTime": "HH:MM" 24-hour format (e.g. "07:30", "16:00"). If end time is not stated, assume 1 hour duration.
- "location": Optional string (e.g. "Gym", "Room 301", "Student Center", "Zoom")
- "color": One of "indigo", "violet", "emerald", "amber", "rose", "sky"
- "type": "class" (for recurring commitments/classes) or "task" (for one-off tasks/deadlines)
- "category": Short label e.g. "Academics", "Fitness", "Club", "Work", "Personal"

Also extract "preferences" if mentioned (wakeTime, sleepTime, peakEnergy).

Return ONLY valid JSON with keys "candidates" (array of items) and "preferences" (object). No markdown ticks or explanation.
`;

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
          const parsed = JSON.parse(rawContent.replace(/```json/g, '').replace(/```/g, '').trim());
          if (Array.isArray(parsed.candidates)) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Gemini NLP parsing failed:', e);
    }
  }

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
          if (Array.isArray(parsed.candidates)) return parsed;
        }
      }
    } catch (e) {
      console.warn('OpenAI NLP parsing failed:', e);
    }
  }

  return heuristicParse(text);
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // 1. If this is a batch confirm & save request from the user review screen
    if (body.action === 'confirm' && Array.isArray(body.items)) {
      const confirmedItems: ParsedCandidateItem[] = body.items.filter((item: any) => item.selected !== false);
      const insertedClasses = [];
      const insertedDeadlines = [];

      for (const item of confirmedItems) {
        if (item.type === 'class') {
          const payload = {
            user_id: user.id,
            title: item.title.trim(),
            day_of_week: item.dayOfWeek,
            start_time: item.startTime,
            end_time: item.endTime,
            location: item.location || null,
            color: item.color || 'indigo',
          };
          let { data, error } = await supabase.from('fixed_classes').insert(payload).select().single();
          if (error && error.code === '42P01') {
            const fallback = await supabase.from('fixed_events').insert({
              user_id: user.id,
              title: item.title.trim(),
              day_of_week: item.dayOfWeek,
              start_time: item.startTime,
              end_time: item.endTime,
              category: item.category || 'Routine',
            }).select().single();
            data = fallback.data;
          }
          if (data) insertedClasses.push(data);
        } else {
          // One-off deadline/task
          const today = new Date().toISOString().split('T')[0];
          const payload = {
            user_id: user.id,
            title: item.title.trim(),
            due_date: today,
            due_time: item.startTime,
            category: item.category || 'General',
            priority: 'medium',
            status: 'not_started',
          };
          let { data, error } = await supabase.from('deadlines').insert(payload).select().single();
          if (error && error.code === '42P01') {
            const fallback = await supabase.from('todos').insert({
              user_id: user.id,
              title: item.title.trim(),
              due_date: `${today}T${item.startTime}:00Z`,
              priority: 'medium',
              completed: false,
              category: item.category || 'General',
            }).select().single();
            data = fallback.data;
          }
          if (data) insertedDeadlines.push(data);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Saved ${insertedClasses.length} fixed class(es) and ${insertedDeadlines.length} task(s).`,
        savedClassesCount: insertedClasses.length,
        savedDeadlinesCount: insertedDeadlines.length,
      });
    }

    // 2. Otherwise: parse text into candidates WITHOUT silently saving
    const { rawText } = body;
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
    }

    const { candidates, preferences } = await callLLMParse(rawText.trim());

    const formattedCandidates: ParsedCandidateItem[] = (candidates || []).map((c, index) => ({
      id: `candidate_${Date.now()}_${index}`,
      title: c.title || 'Commitment',
      dayOfWeek: (c.dayOfWeek !== undefined && c.dayOfWeek >= 0 && c.dayOfWeek <= 6 ? c.dayOfWeek : 1) as DayOfWeek,
      startTime: c.startTime || '09:00',
      endTime: c.endTime || '10:00',
      location: c.location || '',
      color: c.color || 'indigo',
      type: c.type || 'class',
      category: c.category || 'Commitment',
      selected: true,
    }));

    return NextResponse.json({
      success: true,
      candidates: formattedCandidates,
      preferences: preferences || {},
      rawText: rawText.trim(),
    });
  } catch (error: any) {
    console.error('Error in /api/schedule/parse-text:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
