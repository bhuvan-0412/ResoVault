import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const DEFAULT_USER_TOPICS = [
  'Technology',
  'AI & Machine Learning',
  'Development',
  'Product Management',
  'Design',
];

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        topics: DEFAULT_USER_TOPICS,
        customKeywords: [],
        isAuthenticated: false,
      });
    }

    const { data, error } = await supabase
      .from('user_topics')
      .select('topics, custom_keywords')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('Supabase user_topics error:', error);
    }

    const topics = data?.topics && data.topics.length > 0 ? data.topics : DEFAULT_USER_TOPICS;
    const customKeywords = data?.custom_keywords || [];

    return NextResponse.json({
      topics,
      customKeywords,
      isAuthenticated: true,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'You must be signed in to save topic preferences' }, { status: 401 });
    }

    const body = await req.json();
    const { topics = [], customKeywords = [] } = body;

    const cleanTopics = Array.isArray(topics) ? topics.map((t: string) => String(t).trim()).filter(Boolean) : DEFAULT_USER_TOPICS;
    const cleanKeywords = Array.isArray(customKeywords) ? customKeywords.map((k: string) => String(k).trim().toLowerCase()).filter(Boolean) : [];

    const { data, error } = await supabase
      .from('user_topics')
      .upsert({
        user_id: user.id,
        topics: cleanTopics,
        custom_keywords: cleanKeywords,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      topics: data.topics,
      customKeywords: data.custom_keywords,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
