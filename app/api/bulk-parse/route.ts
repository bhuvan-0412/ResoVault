import { NextResponse } from 'next/server';
import { getDomain, getDomainType } from '@/lib/utils';
import {
  NEEDS_REVIEW_TAG,
  TopicTag,
  TypeTag,
  buildTaxonomyPrompt,
  enforceTagRule,
  isGenericTitle,
  isTopicTag,
  isTypeTag,
  matchFolder,
} from '@/lib/link-taxonomy';

interface BulkParseRequest {
  rawText: string;
  existingCategories?: string[]; // ignored: folders come from the fixed taxonomy
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
    const clean = rawUrl.trim().replace(/[.,;)]+$/, '');
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      cleanedUrls.push(clean);
    }
  }

  return cleanedUrls;
}

// Fetch metadata for a URL with YouTube oEmbed and Open Graph support
async function fetchUrlMetadata(url: string): Promise<{ url: string; title: string; description: string }> {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.title) {
          return {
            url,
            title: data.title,
            description: data.author_name ? `YouTube video by ${data.author_name}` : '',
          };
        }
      }
    } catch {
      // Fall through to standard fetch
    }
  }

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
function detectTypeTag(url: string, text: string): TypeTag {
  const lower = url.toLowerCase();
  let path = '';
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    // keep empty path
  }

  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    if (lower.includes('/playlist') || /[?&]list=/.test(lower)) return 'playlist';
    return 'video';
  }
  if (lower.includes('github.com')) return 'repo';
  if (lower.includes('drive.google.com') && lower.includes('/folders')) return 'folder';
  if (lower.includes('photos.google.com') || lower.includes('photos.app.goo.gl')) return 'photos';
  if (path.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(path)) return 'image';
  if (/docs\.google\.com\/(document|spreadsheets|presentation)/.test(lower)) return 'doc';
  if (lower.includes('drive.google.com')) return 'doc';
  if (
    lower.includes('linkedin.com') ||
    lower.includes('instagram.com') ||
    lower.includes('x.com/') ||
    lower.includes('twitter.com')
  ) {
    return 'post';
  }
  if (lower.includes('notion.so') || lower.includes('notion.site')) return 'guide';
  if (/\b(certificate|certification)\b/.test(text)) return 'certificate';
  if (/\b(course|bootcamp)\b/.test(text)) return 'course';
  if (/\bprompts?\b/.test(text)) return 'prompt';
  if (/\btemplates?\b/.test(text)) return 'template';
  if (/\b(guide|tutorial|how to|roadmap)\b/.test(text)) return 'guide';
  if (/\b(substack|medium\.com|blog|essay|article)\b/.test(text)) return 'article';
  return 'tool';
}

const TOPIC_RULES: Array<[RegExp, TopicTag]> = [
  [/\b(ai|gpt|chatgpt|gemini|claude|llm|openai|midjourney)\b/, 'ai'],
  [/\b(ml|machine learning|deep learning)\b/, 'ml'],
  [/\bagents?\b/, 'agents'],
  [/\b(automation|automate)\b/, 'automation'],
  [/\b(coding|programming|python|javascript|typescript|nextjs)\b/, 'coding'],
  [/\bgithub\b/, 'github'],
  [/\b(react|next\.js)\b/, 'react'],
  [/\b(design|figma|ui|ux)\b/, 'design'],
  [/\b(animation|animated|gsap|motion)\b/, 'animation'],
  [/\b(webgl|three\.js)\b/, 'webgl'],
  [/\b(colors?|palette)\b/, 'colors'],
  [/\bicons?\b/, 'icons'],
  [/\b(sfx|sound effects?)\b/, 'sfx'],
  [/\btransitions?\b/, 'transitions'],
  [/\btextures?\b/, 'textures'],
  [/\b(editing|premiere|davinci|capcut|after effects)\b/, 'editing'],
  [/\b(script|scripting)\b/, 'scripting'],
  [/\bhooks?\b/, 'hooks'],
  [/\bstorytelling\b/, 'storytelling'],
  [/\breels?\b/, 'reels'],
  [/\binstagram\b/, 'instagram'],
  [/\b(growth|grow)\b/, 'growth'],
  [/\b(branding|personal brand)\b/, 'branding'],
  [/\b(pm|product manag\w*)\b/, 'pm'],
  [/\binternships?\b/, 'internship'],
  [/\broadmap\b/, 'roadmap'],
  [/\bportfolio\b/, 'portfolio'],
  [/\bcasebook\b/, 'casebook'],
  [/\b(resume|cv)\b/, 'resume'],
  [/\bhackathons?\b/, 'hackathon'],
  [/\b(career|jobs?)\b/, 'career'],
  [/\b(startups?|y combinator|founder)\b/, 'startups'],
];

const DEFAULT_TOPIC_BY_FOLDER: Record<string, TopicTag> = {
  Content: 'growth',
  'Video Editing': 'editing',
  'AI Tools & Prompts': 'ai',
  'Design & Web': 'design',
  'Dev & GitHub': 'dev',
  'Product Management': 'pm',
  'Career & Roadmaps': 'career',
  Startups: 'startups',
};

function detectFolder(url: string, text: string, typeTag: TypeTag): string {
  const lower = url.toLowerCase();
  const has = (re: RegExp) => re.test(text);

  if (typeTag === 'certificate' || has(/\bcertificate\b/)) return 'Certificates';
  if (typeTag === 'photos') return 'Personal';
  if (typeTag === 'repo') return 'Dev & GitHub';
  if (has(/\b(phoenix|college|semester|lecture notes)\b/)) return 'Acads';
  if (
    has(/\b(startups?|y combinator|ycombinator|paul graham|founder)\b/) ||
    lower.includes('paulgraham.com') ||
    lower.includes('ycombinator.com')
  ) {
    return 'Startups';
  }
  if (has(/\b(hackathon|resume|cv)\b/)) return 'Career & Roadmaps';
  if (has(/\b(pm|product manag\w*|casebook|internships?)\b/)) return 'Product Management';
  if (has(/\b(roadmap|career)\b/)) return 'Career & Roadmaps';
  if (has(/\b(sfx|sound effects?|transitions?|textures?|premiere|davinci|capcut|after effects|video editing|editing assets?)\b/)) {
    return 'Video Editing';
  }
  if (has(/\b(prompts?|chatgpt|gemini|claude|midjourney|openai|llm)\b/)) return 'AI Tools & Prompts';
  if (
    has(/\b(hooks?|scripts?|storytelling|reels?|instagram|branding|link[- ]in[- ]bio|creator)\b/) ||
    lower.includes('instagram.com')
  ) {
    return 'Content';
  }
  if (
    has(/\b(design|figma|animation|gsap|templates?|colors?|palette|icons?|css|tailwind|webgl|ui|ux)\b/) ||
    lower.includes('figma.com')
  ) {
    return 'Design & Web';
  }
  if (
    lower.includes('github.com') ||
    has(/\b(code|coding|dev|developer|api|python|javascript|react|machine learning|ml)\b/)
  ) {
    return 'Dev & GitHub';
  }
  if (has(/\bai\b/)) return 'AI Tools & Prompts';
  return 'Content';
}

function ruleBasedCategorize(item: { url: string; title: string; description: string }): ParsedResultItem {
  const domain = getDomain(item.url);
  const domainType = getDomainType(item.url);
  const text = `${item.url} ${item.title || ''} ${item.description || ''}`.toLowerCase();

  // Fallback title formatting if metadata title is empty or generic
  let title = item.title;
  const isUnhelpful = !title || title.length < 3 || isGenericTitle(title);

  if (isUnhelpful) {
    const cleanDomain = domain.split('.')[0];
    title = cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1);
    if (domainType === 'github') title = `GitHub: ${domain}`;
  } else {
    // Clean trailing " - Google Drive" suffixes
    title = title.replace(/\s*[-–|]\s*Google (Drive|Docs|Sheets|Slides)\s*$/i, '').trim();
  }

  // Tag rule: exactly 1 type tag + 1-3 topic tags
  const typeTag = detectTypeTag(item.url, text);
  const folder = detectFolder(item.url, text, typeTag);
  const tags: string[] = [typeTag];
  for (const [re, topic] of TOPIC_RULES) {
    if (tags.length >= 4) break;
    if (re.test(text) && !tags.includes(topic)) tags.push(topic);
  }
  if (tags.length === 1) {
    const fallbackTopic = typeTag === 'repo' ? 'coding' : DEFAULT_TOPIC_BY_FOLDER[folder];
    if (fallbackTopic) tags.push(fallbackTopic);
  }

  // needs-review only when the title is generic or empty
  if (isUnhelpful) tags.push(NEEDS_REVIEW_TAG);

  return {
    url: item.url,
    title,
    category: folder,
    tags: enforceTagRule(tags),
    notes: item.description ? item.description.slice(0, 150) : undefined,
  };
}

// Force AI output onto the fixed folders and the 1 type + 1-3 topic tag rule
function applyTaxonomy(
  item: ParsedResultItem,
  meta: { url: string; title: string; description: string }
): ParsedResultItem {
  const rule = ruleBasedCategorize(meta);
  const category = matchFolder(item.category) ?? rule.category;

  let tags = enforceTagRule(Array.isArray(item.tags) ? item.tags : []);
  const hasType = tags.some((t) => isTypeTag(t));
  const hasTopic = tags.some((t) => isTopicTag(t));
  if (!hasType || !hasTopic) {
    tags = enforceTagRule([...tags.filter((t) => t !== NEEDS_REVIEW_TAG), ...rule.tags]);
  }

  // needs-review only for generic or empty titles
  const titleIsGeneric = !meta.title || isGenericTitle(meta.title);
  tags = tags.filter((t) => t !== NEEDS_REVIEW_TAG);
  if (titleIsGeneric) tags.push(NEEDS_REVIEW_TAG);

  return { ...item, title: item.title?.trim() || rule.title, category, tags };
}

// LLM Categorization call (Supports Gemini, Claude, OpenAI)
async function llmCategorize(
  metadataItems: { url: string; title: string; description: string }[],
  apiKey: string,
  provider: 'gemini' | 'anthropic' | 'openai' | 'auto'
): Promise<ParsedResultItem[]> {
  const promptText = `
You are an AI assistant for a link bookmarking application.
Categorize and generate clean metadata for the following list of web links.

${buildTaxonomyPrompt()}

Links to analyze:
${JSON.stringify(metadataItems, null, 2)}

Requirements for each link:
1. "title": Provide a clear, human-friendly concise title (clean up trailing site names or generic labels if needed).
2. "category": Exactly one folder name from the FOLDERS list above.
3. "tags": Follow the TAG RULE above: 1 type tag + 1 to 3 topic tags. If the page title is generic, empty or a sign-in page, also add "needs-review".
4. "notes": Optional 1-sentence note summary based on description.

Return ONLY a valid JSON array of objects with keys: "url", "title", "category", "tags", "notes". No extra explanation text.
`;

  // 1. Try Gemini if provider is gemini or auto
  const effectiveGeminiKey = apiKey || process.env.GEMINI_API_KEY;
  if (effectiveGeminiKey && (provider === 'gemini' || provider === 'auto')) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${effectiveGeminiKey}`;
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
          model: 'claude-sonnet-5-5',
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
  return metadataItems.map((item) => ruleBasedCategorize(item));
}

export async function POST(req: Request) {
  try {
    const body: BulkParseRequest = await req.json();
    const { rawText, apiKey = '', provider = 'auto' } = body;

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
    const categorizedItems = await llmCategorize(metadataResults, apiKey, provider);

    // Ensure all target URLs are represented cleanly
    const finalResults = targetUrls.map((u) => {
      const meta = metadataResults.find((m) => m.url === u) || { url: u, title: '', description: '' };
      const match = categorizedItems.find((c) => c.url?.toLowerCase() === u.toLowerCase());
      return match ? applyTaxonomy(match, meta) : ruleBasedCategorize(meta);
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
