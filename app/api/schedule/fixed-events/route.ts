import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { FixedEvent } from '@/lib/types';

export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('fixed_events')
      .select('*')
      .eq('user_id', user.id)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;

    const events: FixedEvent[] = (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      category: row.category,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('Error fetching fixed events:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, dayOfWeek, startTime, endTime, category } = body;

    if (!title || dayOfWeek === undefined || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields: title, dayOfWeek, startTime, endTime' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('fixed_events')
      .insert({
        user_id: user.id,
        title: title.trim(),
        day_of_week: parseInt(dayOfWeek, 10),
        start_time: startTime,
        end_time: endTime,
        category: category || 'Fixed Commitment',
      })
      .select()
      .single();

    if (error) throw error;

    const created: FixedEvent = {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      dayOfWeek: data.day_of_week,
      startTime: data.start_time,
      endTime: data.end_time,
      category: data.category,
      createdAt: data.created_at,
    };

    return NextResponse.json({ success: true, event: created });
  } catch (error: any) {
    console.error('Error adding fixed event:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, dayOfWeek, startTime, endTime, category } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('fixed_events')
      .update({
        title: title?.trim(),
        day_of_week: dayOfWeek !== undefined ? parseInt(dayOfWeek, 10) : undefined,
        start_time: startTime,
        end_time: endTime,
        category,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    const updated: FixedEvent = {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      dayOfWeek: data.day_of_week,
      startTime: data.start_time,
      endTime: data.end_time,
      category: data.category,
      createdAt: data.created_at,
    };

    return NextResponse.json({ success: true, event: updated });
  } catch (error: any) {
    console.error('Error updating fixed event:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('fixed_events')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Error deleting fixed event:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
