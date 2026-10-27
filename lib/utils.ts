import { Resource } from './types';

// Extract domain from URL cleanly
export function getDomain(urlStr: string): string {
  try {
    const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return urlStr;
  }
}

// Get Google Favicon URL for a domain
export function getFaviconUrl(urlStr: string): string {
  try {
    const domain = getDomain(urlStr);
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return '';
  }
}

// Identify specialized domain types for tailored UI badges / icons
export function getDomainType(urlStr: string): 'github' | 'drive' | 'gdocs' | 'youtube' | 'figma' | 'notion' | 'pdf' | 'generic' {
  const lower = urlStr.toLowerCase();
  if (lower.includes('github.com')) return 'github';
  if (lower.includes('drive.google.com')) return 'drive';
  if (lower.includes('docs.google.com') || lower.includes('sheets.google.com') || lower.includes('slides.google.com')) return 'gdocs';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('figma.com')) return 'figma';
  if (lower.includes('notion.so') || lower.includes('notion.site')) return 'notion';
  if (lower.endsWith('.pdf')) return 'pdf';
  return 'generic';
}

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  'si', // YouTube share tracking parameter
]);

// Normalize URL (strip tracking params, lowercase hostname, remove trailing slashes)
export function normalizeUrl(urlInput: string): string {
  let trimmed = urlInput.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    parsed.hostname = parsed.hostname.toLowerCase();

    // Strip common tracking query parameters
    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lowerKey = key.toLowerCase();
      if (TRACKING_PARAMS.has(lowerKey) || lowerKey.startsWith('utm_')) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((k) => parsed.searchParams.delete(k));

    // Remove trailing slash on pathnames (except single root slash if no query)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }

    let result = parsed.toString();
    if (result.endsWith('/') && parsed.pathname === '/' && !parsed.search && !parsed.hash) {
      result = result.slice(0, -1);
    }
    return result;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

// Clean slate default resources array
export const INITIAL_RESOURCES: Resource[] = [];

export interface CategoryStyle {
  bg: string;
  text: string;
  border: string;
  badge: string;
  dot: string;
  active: string;
}

// One distinct color per standard folder (see FOLDERS in lib/link-taxonomy.ts)
const CATEGORY_COLOR_MAP: Record<string, CategoryStyle> = {
  'content': {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    dot: 'bg-purple-400',
    active: 'bg-purple-500/20 text-purple-200 border-purple-500/50 shadow-purple-500/10',
  },
  'video editing': {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    dot: 'bg-rose-400',
    active: 'bg-rose-500/20 text-rose-200 border-rose-500/50 shadow-rose-500/10',
  },
  'ai tools & prompts': {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    dot: 'bg-cyan-400',
    active: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 shadow-cyan-500/10',
  },
  'design & web': {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    dot: 'bg-indigo-400',
    active: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50 shadow-indigo-500/10',
  },
  'dev & github': {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/30',
    badge: 'bg-green-500/15 text-green-300 border-green-500/30',
    dot: 'bg-green-400',
    active: 'bg-green-500/20 text-green-200 border-green-500/50 shadow-green-500/10',
  },
  'product management': {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
    active: 'bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-amber-500/10',
  },
  'career & roadmaps': {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    dot: 'bg-blue-400',
    active: 'bg-blue-500/20 text-blue-200 border-blue-500/50 shadow-blue-500/10',
  },
  'startups': {
    bg: 'bg-fuchsia-500/10',
    text: 'text-fuchsia-400',
    border: 'border-fuchsia-500/30',
    badge: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
    dot: 'bg-fuchsia-400',
    active: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/50 shadow-fuchsia-500/10',
  },
  'certificates': {
    bg: 'bg-lime-500/10',
    text: 'text-lime-400',
    border: 'border-lime-500/30',
    badge: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
    dot: 'bg-lime-400',
    active: 'bg-lime-500/20 text-lime-200 border-lime-500/50 shadow-lime-500/10',
  },
  'acads': {
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    border: 'border-teal-500/30',
    badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    dot: 'bg-teal-400',
    active: 'bg-teal-500/20 text-teal-200 border-teal-500/50 shadow-teal-500/10',
  },
  'personal': {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    dot: 'bg-orange-400',
    active: 'bg-orange-500/20 text-orange-200 border-orange-500/50 shadow-orange-500/10',
  },
};

const DYNAMIC_FALLBACK_STYLES: CategoryStyle[] = [
  {
    bg: 'bg-pink-500/10',
    text: 'text-pink-400',
    border: 'border-pink-500/30',
    badge: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    dot: 'bg-pink-400',
    active: 'bg-pink-500/20 text-pink-200 border-pink-500/50 shadow-pink-500/10',
  },
  {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    dot: 'bg-yellow-400',
    active: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/50 shadow-yellow-500/10',
  },
  {
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/30',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    dot: 'bg-violet-400',
    active: 'bg-violet-500/20 text-violet-200 border-violet-500/50 shadow-violet-500/10',
  },
  {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    badge: 'bg-red-500/15 text-red-300 border-red-500/30',
    dot: 'bg-red-400',
    active: 'bg-red-500/20 text-red-200 border-red-500/50 shadow-red-500/10',
  },
];

export function getCategoryStyle(categoryName: string = ''): CategoryStyle {
  const normalized = categoryName.trim().toLowerCase();
  if (CATEGORY_COLOR_MAP[normalized]) {
    return CATEGORY_COLOR_MAP[normalized];
  }

  // Deterministic fallback for future custom user categories
  if (!normalized) {
    return {
      bg: 'bg-zinc-800/60',
      text: 'text-zinc-300',
      border: 'border-zinc-700/40',
      badge: 'bg-zinc-800 text-zinc-300 border-zinc-700/50',
      dot: 'bg-zinc-400',
      active: 'bg-zinc-800 text-zinc-100 border-zinc-600',
    };
  }

  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DYNAMIC_FALLBACK_STYLES.length;
  return DYNAMIC_FALLBACK_STYLES[index];
}
