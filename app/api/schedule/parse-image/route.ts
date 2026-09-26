import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DayOfWeek, ExtractedClassCandidate } from '@/lib/types';

interface RawVisionClass {
  title: string;
  dayOfWeek: number; // 0 - 6
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  location?: string | null;
  category?: string;
  color?: string;
}

interface VisionResponse {
  unreadable?: boolean;
  unreadableReason?: string | null;
  scheduleTitle?: string | null;
  classes?: RawVisionClass[];
}

const VISION_SYSTEM_PROMPT = `
You are an expert AI timetable and schedule extraction system.
Analyze the provided image of a student, university, or school class schedule/timetable.
The image may be:
- A clean digital timetable or portal screenshot with grid lines and columns
- A smartphone photograph of a printed sheet, whiteboard, or computer screen (possibly taken at an angle, with perspective distortion, glare, shadows, or uneven lighting)
- A handwritten or typed schedule grid

Extract EVERY distinct class, lecture, lab, tutorial, seminar, or fixed weekly commitment visible in the schedule.

For EACH entry, determine:
- "title": Clean, concise subject title or course name/code (e.g. "Data Structures", "MATH 101: Calculus", "Organic Chemistry Lab", "Operating Systems"). Omit instructor names or section codes from title if they are separate.
- "dayOfWeek": Integer from 0 to 6 where:
  0 = Sunday
  1 = Monday
  2 = Tuesday
  3 = Wednesday
  4 = Thursday
  5 = Friday
  6 = Saturday
  IMPORTANT: If a class cell spans or lists multiple days (e.g. "MWF", "Mon, Wed, Fri", or "Tuesday/Thursday"), output a separate entry for EACH day!
- "startTime": 24-hour time format "HH:MM" (e.g. "09:00", "13:30", "08:15"). Convert 12-hour AM/PM times to 24-hour format.
- "endTime": 24-hour time format "HH:MM" (e.g. "10:15", "14:45", "11:30"). If the grid only lists period start times or duration (e.g. 50 minutes, 1 hour), compute the correct end time.
- "location": Classroom, hall, building, lab room, or online link if stated (e.g. "Room 304", "Science Hall B", "Online"), or null if not indicated.
- "category": Type of session if discernible, e.g. "Lecture", "Lab", "Tutorial", "Seminar", "Class".
- "color": Suggested accent color from: "indigo", "violet", "emerald", "amber", "rose", "sky".

HANDLING EDGE CASES & MULTIPLE SECTIONS:
- If the image contains multiple sections (e.g. Section A and Section B) or multiple semesters, do not guess which is relevant — extract all distinct classes found. The user will review and deselect what doesn't apply.
- If text is slightly blurry, angled, or skewed, reason carefully about row/column alignment.

QUALITY & UNREADABILITY CHECK:
- If the image is completely illegible, too blurry, too dark, out of focus, or does NOT contain a timetable/schedule, do NOT invent fictional classes.
- In that case, set "unreadable": true, and provide a helpful "unreadableReason" (e.g. "The image is too blurry to distinguish the text and time slots. Please retake the photo with better focus and lighting.").

Return ONLY a valid JSON object matching this structure:
{
  "unreadable": false,
  "unreadableReason": null,
  "scheduleTitle": "Optional title or semester if visible",
  "classes": [
    {
      "title": "Computer Networks",
      "dayOfWeek": 1,
      "startTime": "09:00",
      "endTime": "10:30",
      "location": "LH-3",
      "category": "Lecture",
      "color": "indigo"
    }
  ]
}
`;

async function callVisionLLM(imageBase64: string, mimeType: string): Promise<VisionResponse> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
  const validMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

  // 1. Try Gemini Vision (Gemini 1.5 Flash / 2.0 Flash)
  if (geminiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: VISION_SYSTEM_PROMPT },
                {
                  inline_data: {
                    mime_type: validMime,
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawContent) {
          const cleaned = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          if (parsed && (Array.isArray(parsed.classes) || parsed.unreadable)) {
            return parsed;
          }
        }
      } else {
        const errText = await res.text();
        console.warn('Gemini vision request failed:', res.status, errText);
      }
    } catch (err) {
      console.warn('Gemini vision API error:', err);
    }
  }

  // 2. Try OpenAI Vision (gpt-4o-mini)
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
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: VISION_SYSTEM_PROMPT },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${validMime};base64,${cleanBase64}`,
                  },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed && (Array.isArray(parsed.classes) || parsed.unreadable)) {
            return parsed;
          }
        }
      } else {
        const errText = await res.text();
        console.warn('OpenAI vision request failed:', res.status, errText);
      }
    } catch (err) {
      console.warn('OpenAI vision API error:', err);
    }
  }

  // If no AI keys configured or both failed
  return {
    unreadable: true,
    unreadableReason:
      'Vision extraction requires an AI API key (GEMINI_API_KEY or OPENAI_API_KEY) configured in the server environment.',
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // ═════════════════════════════════════════════════════════════════════
    // ACTION: CONFIRM & MERGE EXTRACTED CLASSES
    // ═════════════════════════════════════════════════════════════════════
    if (body.action === 'confirm') {
      const { items = [], replacements = [] } = body;
      const approvedItems: ExtractedClassCandidate[] = items.filter(
        (item: ExtractedClassCandidate) => item.selected && item.conflictResolution !== 'keep_existing'
      );

      // 1. Delete existing classes marked for replacement by user choice
      if (Array.isArray(replacements) && replacements.length > 0) {
        const { error: delErr } = await supabase
          .from('fixed_classes')
          .delete()
          .in('id', replacements)
          .eq('user_id', user.id);

        if (delErr && delErr.code === '42P01') {
          await supabase
            .from('fixed_events')
            .delete()
            .in('id', replacements)
            .eq('user_id', user.id);
        }
      }

      // 2. Additively insert approved new classes
      const insertedClasses = [];
      for (const item of approvedItems) {
        const payload = {
          user_id: user.id,
          title: item.title.trim(),
          day_of_week: item.dayOfWeek,
          start_time: item.startTime,
          end_time: item.endTime,
          location: item.location?.trim() || null,
          color: item.color || 'indigo',
        };

        let { data, error } = await supabase
          .from('fixed_classes')
          .insert(payload)
          .select()
          .single();

        if (error && error.code === '42P01') {
          const fallbackPayload = {
            user_id: user.id,
            title: item.title.trim(),
            day_of_week: item.dayOfWeek,
            start_time: item.startTime,
            end_time: item.endTime,
            category: item.category || 'Class',
          };
          const fallback = await supabase
            .from('fixed_events')
            .insert(fallbackPayload)
            .select()
            .single();
          data = fallback.data;
        }

        if (data) insertedClasses.push(data);
      }

      return NextResponse.json({
        success: true,
        message: `Successfully added ${insertedClasses.length} class(es)${
          replacements.length > 0 ? ` and replaced ${replacements.length} existing class(es)` : ''
        }.`,
        insertedCount: insertedClasses.length,
        replacedCount: replacements.length,
      });
    }

    // ═════════════════════════════════════════════════════════════════════
    // ACTION: VISION EXTRACTION FROM IMAGE
    // ═════════════════════════════════════════════════════════════════════
    const { imageBase64, mimeType } = body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Image data (imageBase64) is required.' },
        { status: 400 }
      );
    }

    const visionResult = await callVisionLLM(imageBase64, mimeType || 'image/jpeg');

    // Handle unreadable image or missing content gracefully
    if (visionResult.unreadable) {
      return NextResponse.json(
        {
          unreadable: true,
          error:
            visionResult.unreadableReason ||
            "We couldn't detect a readable weekly timetable in this image. Please ensure the timetable grid is clearly visible, well-lit, and in focus, then try retaking the photo.",
        },
        { status: 422 }
      );
    }

    const rawClasses = visionResult.classes || [];
    if (rawClasses.length === 0) {
      return NextResponse.json(
        {
          unreadable: true,
          error:
            "No weekly classes or schedule commitments could be recognized from this image. Please verify you've uploaded a class schedule or timetable photo.",
        },
        { status: 422 }
      );
    }

    // Format & validate candidates
    const formattedCandidates: ExtractedClassCandidate[] = rawClasses.map((c, index) => {
      let day = typeof c.dayOfWeek === 'number' && c.dayOfWeek >= 0 && c.dayOfWeek <= 6
        ? c.dayOfWeek
        : 1;

      // Normalize times to HH:MM
      let start = (c.startTime || '09:00').trim().slice(0, 5);
      let end = (c.endTime || '10:00').trim().slice(0, 5);

      if (!start.includes(':')) start = '09:00';
      if (!end.includes(':')) end = '10:00';

      return {
        id: `extracted_${Date.now()}_${index}`,
        title: (c.title || 'Class Session').trim(),
        dayOfWeek: day as DayOfWeek,
        startTime: start,
        endTime: end,
        location: c.location ? c.location.trim() : null,
        category: c.category || 'Class',
        color: c.color || 'indigo',
        selected: true,
        conflict: null,
      };
    });

    return NextResponse.json({
      success: true,
      scheduleTitle: visionResult.scheduleTitle || null,
      classes: formattedCandidates,
      totalCount: formattedCandidates.length,
    });
  } catch (error: any) {
    console.error('Error in /api/schedule/parse-image:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
