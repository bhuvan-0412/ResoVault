import { NextResponse } from 'next/server';
import { normalizeUrl, getDomain } from '@/lib/utils';

// Helper to decode HTML entities
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Fetch YouTube metadata via oEmbed
async function fetchYouTubeOEmbed(url: string): Promise<{ title: string; description: string; thumbnail?: string } | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || '',
        description: data.author_name ? `YouTube video by ${data.author_name}` : '',
        thumbnail: data.thumbnail_url || undefined,
      };
    }
  } catch (err) {
    console.warn('YouTube oEmbed fetch error:', err);
  }
  return null;
}

// Fetch general Open Graph and HTML title/description
async function fetchOpenGraphMetadata(url: string): Promise<{ title: string; description: string; thumbnail?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { title: '', description: '' };
    }

    const html = await res.text();

    const ogTitleMatch =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i) ||
      html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i);

    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const ogDescMatch =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i) ||
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["']/i);

    const ogImageMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

    let title = ogTitleMatch?.[1] || titleTagMatch?.[1] || '';
    let description = ogDescMatch?.[1] || '';
    const thumbnail = ogImageMatch?.[1] || undefined;

    return {
      title: decodeHtmlEntities(title),
      description: decodeHtmlEntities(description),
      thumbnail,
    };
  } catch {
    return { title: '', description: '' };
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get('url');

    if (!rawUrl) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    const normalized = normalizeUrl(rawUrl);
    const domain = getDomain(normalized);
    const lower = normalized.toLowerCase();

    let isSpecific = false;

    // 1. YouTube oEmbed
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      const ytData = await fetchYouTubeOEmbed(normalized);
      if (ytData && ytData.title && !isGenericOrUnhelpful(ytData.title, normalized)) {
        return NextResponse.json({
          success: true,
          data: {
            url: normalized,
            title: ytData.title,
            description: ytData.description,
            thumbnail: ytData.thumbnail,
            isSpecificTitle: true,
          },
        });
      }
    }

    // 2. Open Graph tags & <title>
    const ogData = await fetchOpenGraphMetadata(normalized);

    let title = ogData.title;
    if (title && !isGenericOrUnhelpful(title, normalized)) {
      isSpecific = true;
    } else {
      isSpecific = false;
      if (!title || isGenericOrUnhelpful(title, normalized)) {
        const cleanDomain = domain.split('.')[0];
        title = cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        url: normalized,
        title,
        description: ogData.description,
        thumbnail: ogData.thumbnail,
        isSpecificTitle: isSpecific,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/metadata:', error);
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}

export function isGenericOrUnhelpful(title: string, url: string = ''): boolean {
  if (!title || typeof title !== 'string') return true;
  const clean = title.trim().toLowerCase();
  if (clean.length < 3) return true;

  const genericPatterns = [
    /^google drive$/,
    /^drive$/,
    /^google docs$/,
    /^google sheets$/,
    /^google slides$/,
    /^google forms$/,
    /^google$/,
    /^google accounts$/,
    /^sign in.*$/,
    /^login.*$/,
    /^log in.*$/,
    /^sign up.*$/,
    /^dropbox$/,
    /^onedrive$/,
    /^notion$/,
    /^instagram$/,
    /^twitter$/,
    /^x$/,
    /^github$/,
    /^youtube$/,
    /^404.*$/,
    /^page not found.*$/,
    /^error.*$/,
    /^internal server error.*$/,
    /^access denied.*$/,
    /^unauthorized.*$/,
    /^forbidden.*$/,
    /^security check.*$/,
    /^just a moment\.\.\..*$/,
    /^attention required.*$/,
    /^redirecting.*$/,
    /.*— review$/,
    /^untitled.*$/,
    /^home$/,
    /^welcome$/
  ];

  for (const pat of genericPatterns) {
    if (pat.test(clean)) return true;
  }
  return false;
}
