import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { DEFAULT_USER_TOPICS } from '../topics/route';
import { NewsArticle } from '@/lib/types';

function estimateReadingTime(text?: string): number {
  if (!text) return 2;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 50)); // Estimated minutes based on snippet & full read
}

function mapArticleRow(row: any): NewsArticle {
  return {
    id: row.id,
    title: row.title,
    link: row.link,
    description: row.description || '',
    pubDate: row.pub_date,
    imageUrl: row.image_url || undefined,
    sourceId: row.source_id,
    sourceName: row.source_name || row.source_id || 'Tech Publisher',
    sourceIcon: row.source_icon,
    category: row.category || 'Technology',
    categories: Array.isArray(row.categories) ? row.categories : [row.category || 'Technology'],
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    isBreaking: Boolean(row.is_breaking),
    readingTime: estimateReadingTime(row.description),
    createdAt: row.created_at,
  };
}

export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Fetch user topic preferences
    let userTopics = DEFAULT_USER_TOPICS;
    let customKeywords: string[] = [];

    if (user) {
      const { data: topicData } = await supabase
        .from('user_topics')
        .select('topics, custom_keywords')
        .eq('user_id', user.id)
        .maybeSingle();

      if (topicData?.topics && topicData.topics.length > 0) {
        userTopics = topicData.topics;
      }
      if (topicData?.custom_keywords) {
        customKeywords = topicData.custom_keywords;
      }
    }

    // 2. Fetch user click interactions in the last 30 days for engagement weighting
    const categoryWeights: Record<string, number> = {};
    if (user) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: clicks } = await supabase
        .from('user_article_clicks')
        .select('category')
        .eq('user_id', user.id)
        .gte('clicked_at', thirtyDaysAgo);

      if (clicks && clicks.length > 0) {
        clicks.forEach((c) => {
          if (c.category) {
            categoryWeights[c.category] = (categoryWeights[c.category] || 0) + 1;
          }
        });
      }
    }

    // 3. Fetch recent articles from Supabase news_articles table
    // Authenticated users query with their session (RLS enforced).
    // Unauthenticated visitors preview the public shared news feed.
    const newsReader = user ? supabase : createServiceRoleSupabaseClient();
    let { data: rawArticles, error } = await newsReader
      .from('news_articles')
      .select('*')
      .order('pub_date', { ascending: false })
      .limit(60);

    // If table is completely empty, trigger internal fallback seed
    if (!rawArticles || rawArticles.length === 0) {
      const cronUrl = new URL('/api/cron/fetch-news', req.url).toString();
      await fetch(cronUrl).catch(console.warn);

      const retry = await supabase
        .from('news_articles')
        .select('*')
        .order('pub_date', { ascending: false })
        .limit(60);
      rawArticles = retry.data || [];
    }

    const allArticles = (rawArticles || []).map(mapArticleRow);

    // 4. Extract Breaking / High-Priority Articles
    const breakingArticles = allArticles
      .filter((a) => a.isBreaking)
      .slice(0, 3);

    // 5. Curate Daily Digest (Personalized & Weighted)
    // Exclude breaking items already featured at the top
    const breakingIds = new Set(breakingArticles.map((b) => b.id));
    const candidateArticles = allArticles.filter((a) => !breakingIds.has(a.id));

    // Calculate score for each candidate article based on user topics & click weighting
    const scoredArticles = candidateArticles.map((article) => {
      let score = 1.0;

      // Check if matches user's chosen topics
      const matchesTopic = userTopics.some(
        (t) =>
          article.category.toLowerCase().includes(t.toLowerCase()) ||
          (article.categories && article.categories.some((c) => c.toLowerCase().includes(t.toLowerCase())))
      );

      if (matchesTopic) {
        score += 3.0;
      }

      // Check if matches custom keywords
      if (customKeywords.length > 0) {
        const text = `${article.title} ${article.description || ''}`.toLowerCase();
        const kwMatches = customKeywords.filter((kw) => text.includes(kw)).length;
        score += kwMatches * 2.0;
      }

      // Add engagement weighting from historical clicks
      const clickCount = categoryWeights[article.category] || 0;
      score += Math.min(clickCount * 0.5, 4.0); // max click boost of +4

      // Slight recency decay
      const ageHours = (Date.now() - new Date(article.pubDate || article.createdAt || '').getTime()) / (1000 * 60 * 60);
      if (ageHours < 12) score += 1.5;
      else if (ageHours < 24) score += 1.0;
      else if (ageHours < 48) score += 0.5;

      return { article, score };
    });

    // Sort by weighted score descending
    scoredArticles.sort((a, b) => b.score - a.score);

    // Curated Daily Digest set: limited to top 15 items (digest style, not endless scroll)
    const digest = scoredArticles.slice(0, 15).map((item) => item.article);

    return NextResponse.json({
      success: true,
      breaking: breakingArticles,
      digest,
      userTopics,
      totalDigest: digest.length,
      hasEngagedWeights: Object.keys(categoryWeights).length > 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error generating digest:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
