import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Only log if user is signed in
    if (!user) {
      return NextResponse.json({ success: true, logged: false });
    }

    const body = await req.json();
    const { articleId, category } = body;

    if (!articleId) {
      return NextResponse.json({ error: 'articleId is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_article_clicks')
      .insert({
        user_id: user.id,
        article_id: String(articleId),
        category: category ? String(category).trim() : null,
      });

    if (error) {
      console.warn('Click tracking insert warning:', error.message);
    }

    return NextResponse.json({ success: true, logged: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
