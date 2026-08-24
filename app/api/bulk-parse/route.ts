import { NextResponse } from 'next/server';
import { getDomain, getDomainType } from '@/lib/utils';

interface BulkParseRequest {
  rawText: string;
  existingCategories: string[];
  apiKey?: string;
  provider?: 'gemini' | 'anthropic' | 'openai' | 'auto';
}

interface ParsedResultItem {
  url: string;
  title: string;
  category: string;
  tags: string[];
  notes?: string;
}

// Regex to match URLs cleanly
function extractUrls(text: string): string[] {
  if (!text) return [];
  // Clean trailing punctuation like ), ], ., ,
  const urlRegex = /(https?:\/\/[^\s<>"'()]+)/gi;
  const matches = text.match(urlRegex) || [];
  
  const cleanedUrls: string[] = [];
  const seen = new Set<string>();

  for (const rawUrl of matches) {
    let clean = rawUrl.trim().replace(/[.,;)]+$/, '');
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      cleanedUrls.push(clean);
    }
  }

  return cleanedUrls;
}

// Fetch metadata for a URL with a strict 3s timeout
async function fetchUrlMetadata(url: string): Promise<{ url: string; title: string; description: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { url, title: '', description: '' };
    }

    const html = await res.text();

    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);

    let title = (ogTitleMatch?.[1] || titleMatch?.[1] || '').trim();
    let description = (ogDescMatch?.[1] || descMatch?.[1] || '').trim();

    // Decode HTML entities
    title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    description = description.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

    return { url, title, description };
  } catch {
    return { url, title: '', description: '' };
  }
}

// Fallback rule-based classifier when no LLM API key is provided
function ruleBasedCategorize(
  item: { url: string; title: string; description: string },
  existingCategories: string[]
): ParsedResultItem {
  const domain = getDomain(item.url);
  const domainType = getDomainType(item.url);
  const lowerUrl = item.url.toLowerCase();
  const lowerTitle = (item.title || '').toLowerCase();
  const lowerDesc = (item.description || '').toLowerCase();
  const combinedText = `${lowerUrl} ${lowerTitle} ${lowerDesc}`;

  // Fallback title formatting if metadata title is empty or generic
  let title = item.title;
  if (!title || title.length < 3) {
    const cleanDomain = domain.split('.')[0];
    title = cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1);
    if (domainType === 'github') title = `GitHub: ${domain}`;
    if (domainType === 'drive') title = `Google Drive Resource`;
    if (domainType === 'gdocs') title = `Google Doc Document`;
  }

  // Tags generation
  const tagsSet = new Set<string>();

  if (domainType === 'github') tagsSet.add('github').add('code');
  if (domainType === 'drive') tagsSet.add('drive').add('files');
  if (domainType === 'gdocs') tagsSet.add('docs').add('documentation');
  if (domainType === 'youtube') tagsSet.add('video').add('youtube');
  if (domainType === 'figma') tagsSet.add('figma').add('design');
  if (domainType === 'notion') tagsSet.add('notion').add('notes');

  if (combinedText.includes('react') || combinedText.includes('next') || combinedText.includes('vue')) tagsSet.add('frontend');
  if (combinedText.includes('python') || combinedText.includes('node') || combinedText.includes('api')) tagsSet.add('backend');
  if (combinedText.includes('design') || combinedText.includes('ui') || combinedText.includes('ux')) tagsSet.add('design');
  if (combinedText.includes('guide') || combinedText.includes('tutorial') || combinedText.includes('article')) tagsSet.add('reading');

  if (tagsSet.size === 0) {
    tagsSet.add('resource');
  }

  // Category determination
  let category = 'General';

  // Check matching existing categories
  const matchCategory = (name: string) => existingCategories.find((c) => c.toLowerCase() === name.toLowerCase());

  if (domainType === 'github' || combinedText.includes('code') || combinedText.includes('dev') || combinedText.includes('api')) {
    category = matchCategory('Development') || matchCategory('Code') || 'Development';
  } else if (domainType === 'drive' || domainType === 'gdocs' || combinedText.includes('project') || combinedText.includes('roadmap')) {
    category = matchCategory('Work & Projects') || matchCategory('Projects') || 'Work & Projects';
  } else if (domainType === 'figma' || combinedText.includes('design') || combinedText.includes('ui')) {
    category = matchCategory('Design') || 'Design';
  } else if (combinedText.includes('article') || combinedText.includes('blog') || combinedText.includes('news')) {
    category = matchCategory('Articles') || matchCategory('Reading') || 'Articles';
  } else if (existingCategories.length > 0) {
    category = existingCategories[0];
  }

  return {
    url: item.url,
    title,
    category,
    tags: Array.from(tagsSet).slice(0, 3),
    notes: item.description ? item.description.slice(0, 150) : undefined,
  };
}

// LLM Categorization call (Supports Gemini, Claude, OpenAI)
async function llmCategorize(
  metadataItems: { url: string; title: string; description: string }[],
  existingCategories: string[],
  apiKey: string,
  provider: 'gemini' | 'anthropic' | 'openai' | 'auto'
): Promise<ParsedResultItem[]> {
  const promptText = `
You are an AI assistant for a link bookmarking application.
Categorize and generate clean metadata for the following list of web links.

Existing categories available in user's hub:
${JSON.stringify(existingCategories)}

Links to analyze:
${JSON.stringify(metadataItems, null, 2)}

Requirements for each link:
1. "title": Provide a clear, human-friendly concise title (clean up trailing site names or generic labels if needed).
2. "category": Pick the best-fitting category from the existing categories list above. If NONE of the existing categories fit reasonably, propose a concise new category name (e.g., "Research", "Finance", "Entertainment").
3. "tags": Array of 1 to 3 relevant lowercase keyword tags (e.g. ["react", "docs", "frontend"]).
4. "notes": Optional 1-sentence note summary based on description.

Return ONLY a valid JSON array of objects with keys: "url", "title", "category", "tags", "notes". No extra explanation text.
`;

  // 1. Try Gemini if provider is gemini or auto
  const effectiveGeminiKey = apiKey || process.env.GEMINI_API_KEY;
  if (effectiveGeminiKey && (provider === 'gemini' || provider === 'auto')) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${effectiveGeminiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const textResp = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResp) {
          const parsed = JSON.parse(textResp);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (err) {
      console.warn('Gemini API call failed, attempting fallbacks:', err);
    }
  }

  // 2. Try Anthropic Claude if key provided or process.env.ANTHROPIC_API_KEY
  const effectiveClaudeKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (effectiveClaudeKey && (provider === 'anthropic' || provider === 'auto')) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': effectiveClaudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          messages: [{ role: 'user', content: promptText }],
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const rawContent = json.content?.[0]?.text || '';
        const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (err) {
      console.warn('Anthropic API call failed:', err);
    }
  }

  // 3. Try OpenAI if key provided or process.env.OPENAI_API_KEY
  const effectiveOpenAIKey = apiKey || process.env.OPENAI_API_KEY;
  if (effectiveOpenAIKey && (provider === 'openai' || provider === 'auto')) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveOpenAIKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: promptText }],
          response_format: { type: 'json_object' },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) return parsed;
          if (parsed.links && Array.isArray(parsed.links)) return parsed.links;
        }
      }
    } catch (err) {
      console.warn('OpenAI API call failed:', err);
    }
  }

  // Fallback to rule-based categorization
  return metadataItems.map((item) => ruleBasedCategorize(item, existingCategories));
}

export async function POST(req: Request) {
  try {
    const body: BulkParseRequest = await req.json();
    const { rawText, existingCategories = [], apiKey = '', provider = 'auto' } = body;

    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ error: 'No text provided to extract links from' }, { status: 400 });
    }

    // Step 1: Extract unique URLs
    const urls = extractUrls(rawText);

    if (urls.length === 0) {
      return NextResponse.json({ error: 'No valid URLs found in the pasted text' }, { status: 400 });
    }

    // Limit max links per batch for speed (up to 30 links)
    const targetUrls = urls.slice(0, 30);

    // Step 2: Fetch metadata in parallel
    const metadataResults = await Promise.all(targetUrls.map((u) => fetchUrlMetadata(u)));

    // Step 3: Categorize & tag via LLM (or rule fallback)
    const categorizedItems = await llmCategorize(metadataResults, existingCategories, apiKey, provider);

    // Ensure all target URLs are represented cleanly
    const finalResults = targetUrls.map((u) => {
      const match = categorizedItems.find((c) => c.url.toLowerCase() === u.toLowerCase());
      if (match) return match;
      const meta = metadataResults.find((m) => m.url === u) || { url: u, title: '', description: '' };
      return ruleBasedCategorize(meta, existingCategories);
    });

    return NextResponse.json({
      success: true,
      totalFound: targetUrls.length,
      data: finalResults,
    });
  } catch (error) {
    console.error('Error in POST /api/bulk-parse:', error);
    return NextResponse.json({ error: 'Failed to process bulk import text' }, { status: 500 });
  }
}
