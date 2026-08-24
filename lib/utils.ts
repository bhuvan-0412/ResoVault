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

// Normalize URL (add https:// if missing)
export function normalizeUrl(urlInput: string): string {
  let trimmed = urlInput.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

// Clean slate default resources array
export const INITIAL_RESOURCES: Resource[] = [];
