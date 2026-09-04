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

    // 1. YouTube oEmbed
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      const ytData = await fetchYouTubeOEmbed(normalized);
      if (ytData && ytData.title) {
        return NextResponse.json({
          success: true,
          data: {
            url: normalized,
            title: ytData.title,
            description: ytData.description,
            thumbnail: ytData.thumbnail,
          },
        });
      }
    }

    // 2. Open Graph tags
    const ogData = await fetchOpenGraphMetadata(normalized);

    // Fallback title formatting if none found
    let title = ogData.title;
    if (!title) {
      const cleanDomain = domain.split('.')[0];
      title = cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1);
    }

    return NextResponse.json({
      success: true,
      data: {
        url: normalized,
        title,
        description: ogData.description,
        thumbnail: ogData.thumbnail,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/metadata:', error);
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}
