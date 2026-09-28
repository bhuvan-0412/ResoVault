import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface SplitScriptItem {
  title: string;
  body: string;
  tags: string[];
}

// Heuristic fallback splitter
function heuristicSplit(rawText: string): SplitScriptItem[] {
  const text = rawText.trim();
  if (!text) return [];

  let rawChunks: string[] = [];

  // Pattern 1: Explicit horizontal separator lines (e.g. ---, ===, ___, ***)
  const lineSeparatorRegex = /\n\s*(?:[-=_*]{3,})\s*\n/;
  if (lineSeparatorRegex.test(text)) {
    rawChunks = text.split(lineSeparatorRegex);
  }
  // Pattern 2: Script / Video / Reel / Part headings at the start of a line
  else if (/(?:^|\n)\s*(?:#+\s*)?(?:script|video|reel|short|part|ep(?:isode)?|take)\s*#?\d+[:\s\.-]*/i.test(text)) {
    const headingSplitRegex = /(?:^|\n)(?=\s*(?:#+\s*)?(?:script|video|reel|short|part|ep(?:isode)?|take)\s*#?\d+[:\s\.-]*)/i;
    rawChunks = text.split(headingSplitRegex);
  }
  // Pattern 3: 3 or more blank lines
  else if (/\n\s*\n\s*\n+/.test(text)) {
    rawChunks = text.split(/\n\s*\n\s*\n+/);
  }
  // Pattern 4: 2 blank lines if multiple paragraphs exist
  else if (/\n\s*\n/.test(text)) {
    const doubleBlank = text.split(/\n\s*\n/);
    if (doubleBlank.length > 1 && doubleBlank.some(c => c.trim().length > 100)) {
      rawChunks = doubleBlank;
    } else {
      rawChunks = [text];
    }
  } else {
    rawChunks = [text];
  }

  const results: SplitScriptItem[] = [];

  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i].trim();
    if (!chunk) continue;

    // Derive a clean title from the chunk
    const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
    let title = `Script ${results.length + 1}`;

    if (lines.length > 0) {
      const firstLine = lines[0];
      // Check if first line is a heading like "Script 1: How to stay productive"
      const headingMatch = firstLine.match(/^(?:#+\s*)?(?:script|video|reel|short|part|ep(?:isode)?|take)\s*#?\d+[:\s\.-]*(.+)$/i);
      if (headingMatch && headingMatch[1].trim()) {
        title = headingMatch[1].trim();
      } else {
        // Take first line, trimmed to 60 characters
        let clean = firstLine.replace(/^[#\-*>\s]+/, '').trim();
        if (clean.length > 60) {
          clean = clean.substring(0, 57).trim() + '...';
        }
        if (clean.length >= 3) {
          title = clean;
        }
      }
    }

    results.push({
      title,
      body: chunk,
      tags: ['imported'],
    });
  }

  return results.length > 0 ? results : [{ title: 'Script 1', body: text, tags: ['imported'] }];
}

// LLM-based intelligent splitter
async function llmSplit(rawText: string): Promise<SplitScriptItem[] | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !anthropicKey && !openaiKey) {
    return null;
  }

  const prompt = `You are an expert video script organizer.
The user provided a raw text dump containing multiple video scripts written in advance:
"""
${rawText}
"""

YOUR TASK:
Split this dump into individual, separate scripts and suggest a concise, compelling title for each script.

CRITICAL RULES:
1. EXACT WORDING PRESERVATION: NEVER rewrite, summarize, improve, rephrase, or modify the script body text. Keep the user's exact wording, punctuation, line breaks, formatting, and emojis completely intact for each script chunk.
2. Identify script boundaries accurately, even if separators are messy (such as dashes, markdown dividers, "Script 1" headings, blank lines, or topic changes).
3. Suggest a concise, descriptive title for each script (3 to 8 words) summarizing what that script is about, or using the script's hook.
4. Provide 1 to 3 relevant lowercase tags (e.g. ["tech", "hooks", "tutorial"]).

Return ONLY a valid JSON array of objects with the keys:
- "title": string
- "body": string (the exact script content)
- "tags": array of strings

Do not wrap in markdown quotes or add explanation text outside the JSON array.`;

  // 1. Try Gemini
  if (geminiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
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
        const textResp = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResp) {
          const parsed = JSON.parse(textResp);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((item: any, idx: number) => ({
              title: item.title?.trim() || `Script ${idx + 1}`,
              body: item.body || '',
              tags: Array.isArray(item.tags) ? item.tags : ['imported'],
            }));
          }
        }
      }
    } catch (err) {
      console.warn('Gemini script splitting failed, attempting next provider:', err);
    }
  }

  // 2. Try Anthropic
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const rawContent = json.content?.[0]?.text || '';
        const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((item: any, idx: number) => ({
              title: item.title?.trim() || `Script ${idx + 1}`,
              body: item.body || '',
              tags: Array.isArray(item.tags) ? item.tags : ['imported'],
            }));
          }
        }
      }
    } catch (err) {
      console.warn('Anthropic script splitting failed:', err);
    }
  }

  // 3. Try OpenAI
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
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          const list = Array.isArray(parsed) ? parsed : parsed.scripts || parsed.items || [];
          if (Array.isArray(list) && list.length > 0) {
            return list.map((item: any, idx: number) => ({
              title: item.title?.trim() || `Script ${idx + 1}`,
              body: item.body || '',
              tags: Array.isArray(item.tags) ? item.tags : ['imported'],
            }));
          }
        }
      }
    } catch (err) {
      console.warn('OpenAI script splitting failed:', err);
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in to import scripts.' }, { status: 401 });
    }

    const body = await req.json();
    const rawText = body.rawText;

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json({ error: 'Please provide script text to import.' }, { status: 400 });
    }

    // Check if any AI key is configured
    const hasAiKey = Boolean(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);

    let scripts: SplitScriptItem[] | null = null;
    let method: 'llm' | 'heuristic' = 'heuristic';
    let message = '';

    if (hasAiKey) {
      try {
        scripts = await llmSplit(rawText);
        if (scripts && scripts.length > 0) {
          method = 'llm';
          message = `AI successfully split your dump into ${scripts.length} separate script${scripts.length > 1 ? 's' : ''} with suggested titles. Exact wording preserved.`;
        }
      } catch (err) {
        console.warn('Error during LLM script split:', err);
      }
    }

    // Heuristic Fallback
    if (!scripts || scripts.length === 0) {
      scripts = heuristicSplit(rawText);
      method = 'heuristic';
      message = hasAiKey
        ? `AI call encountered an issue, so standard heuristic splitting was used (${scripts.length} detected). All exact wording is preserved.`
        : `No AI key configured (GEMINI_API_KEY). Used smart heuristic splitting (${scripts.length} detected). Exact wording preserved.`;
    }

    return NextResponse.json({
      success: true,
      method,
      message,
      scripts: scripts.map((s, idx) => ({
        id: `import_${Date.now()}_${idx}`,
        title: s.title,
        body: s.body,
        status: 'needs_corrections',
        correctionsNote: '',
        tags: s.tags || [],
        selected: true,
      })),
    });
  } catch (error: any) {
    console.error('Error in POST /api/scripts/split:', error);
    return NextResponse.json({ error: error.message || 'Failed to split scripts' }, { status: 500 });
  }
}
