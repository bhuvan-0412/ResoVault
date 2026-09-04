import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeUrl } from '@/lib/utils';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in with Google.' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch resources' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in with Google.' }, { status: 401 });
    }

    const body = await req.json();

    // Bulk insert
    if (Array.isArray(body)) {
      const records = body
        .filter((item: any) => item && (item.url || item.title))
        .map((item: any) => ({
          user_id: user.id,
          url: normalizeUrl(item.url || ''),
          title: (item.title || 'Untitled').trim(),
          description: (item.description || item.notes || '').trim(),
          category: (item.category || 'General').trim(),
          tags: Array.isArray(item.tags) ? item.tags : [],
          is_pinned: Boolean(item.isPinned),
        }));

      const { data, error } = await supabase.from('resources').insert(records).select();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, count: data.length, data });
    }

    // Single resource insert
    const { url, title, category, tags, notes, description, isPinned } = body;
    if (!url || !title) {
      return NextResponse.json({ error: 'URL and Title are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('resources')
      .insert({
        user_id: user.id,
        url: normalizeUrl(url),
        title: String(title).trim(),
        description: String(description || notes || '').trim(),
        category: category ? String(category).trim() : 'General',
        tags: Array.isArray(tags) ? tags : [],
        is_pinned: Boolean(isPinned),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save resource' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in with Google.' }, { status: 401 });
    }

    const body = await req.json();
    const { id, url, title, category, tags, notes, description, isPinned } = body;

    if (!id || !url || !title) {
      return NextResponse.json({ error: 'ID, URL and Title are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('resources')
      .update({
        url: normalizeUrl(url),
        title: String(title).trim(),
        description: String(description || notes || '').trim(),
        category: category ? String(category).trim() : 'General',
        tags: Array.isArray(tags) ? tags : [],
        is_pinned: isPinned !== undefined ? Boolean(isPinned) : false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update resource' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in with Google.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Resource ID is required' }, { status: 400 });
    }

    const { error } = await supabase.from('resources').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete resource' }, { status: 500 });
  }
}
