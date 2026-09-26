import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { FixedClass } from '@/lib/types';

// Helper to normalize DB row into FixedClass
function mapRowToFixedClass(row: any): FixedClass {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    dayOfWeek: row.day_of_week,
    startTime: typeof row.start_time === 'string' ? row.start_time.slice(0, 5) : row.start_time,
    endTime: typeof row.end_time === 'string' ? row.end_time.slice(0, 5) : row.end_time,
    location: row.location || null,
    color: row.color || 'indigo',
    category: row.category || 'Class',
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try primary table fixed_classes
    let { data, error } = await supabase
      .from('fixed_classes')
      .select('*')
      .eq('user_id', user.id)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    // Fallback if fixed_classes table not yet migrated
    if (error && error.code === '42P01') {
      const fallback = await supabase
        .from('fixed_events')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (!fallback.error) {
        data = fallback.data;
        error = null;
      }
    }

    if (error) throw error;

    const classes: FixedClass[] = (data || []).map(mapRowToFixedClass);
    return NextResponse.json({ classes, events: classes });
  } catch (error: any) {
    console.error('Error fetching fixed classes:', error);
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
    const { title, dayOfWeek, startTime, endTime, location, color, category } = body;

    if (!title || dayOfWeek === undefined || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields: title, dayOfWeek, startTime, endTime' },
        { status: 400 }
      );
    }

    const payload = {
      user_id: user.id,
      title: title.trim(),
      day_of_week: parseInt(dayOfWeek, 10),
      start_time: startTime,
      end_time: endTime,
      location: location?.trim() || null,
      color: color || 'indigo',
    };

    let { data, error } = await supabase
      .from('fixed_classes')
      .insert(payload)
      .select()
      .single();

    // Fallback to fixed_events if table does not exist
    if (error && error.code === '42P01') {
      const fallbackPayload = {
        user_id: user.id,
        title: title.trim(),
        day_of_week: parseInt(dayOfWeek, 10),
        start_time: startTime,
        end_time: endTime,
        category: category || 'Fixed Commitment',
      };
      const fallback = await supabase
        .from('fixed_events')
        .insert(fallbackPayload)
        .select()
        .single();
      if (!fallback.error) {
        data = fallback.data;
        error = null;
      }
    }

    if (error) throw error;

    const created = mapRowToFixedClass(data);
    return NextResponse.json({ success: true, classItem: created, event: created });
  } catch (error: any) {
    console.error('Error adding fixed class:', error);
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
    const { id, title, dayOfWeek, startTime, endTime, location, color } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing class id' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {};
    if (title !== undefined) updatePayload.title = title.trim();
    if (dayOfWeek !== undefined) updatePayload.day_of_week = parseInt(dayOfWeek, 10);
    if (startTime !== undefined) updatePayload.start_time = startTime;
    if (endTime !== undefined) updatePayload.end_time = endTime;
    if (location !== undefined) updatePayload.location = location ? location.trim() : null;
    if (color !== undefined) updatePayload.color = color;

    let { data, error } = await supabase
      .from('fixed_classes')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error && error.code === '42P01') {
      const fallback = await supabase
        .from('fixed_events')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (!fallback.error) {
        data = fallback.data;
        error = null;
      }
    }

    if (error) throw error;

    const updated = mapRowToFixedClass(data);
    return NextResponse.json({ success: true, classItem: updated, event: updated });
  } catch (error: any) {
    console.error('Error updating fixed class:', error);
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
      return NextResponse.json({ error: 'Missing class id' }, { status: 400 });
    }

    let { error } = await supabase
      .from('fixed_classes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error && error.code === '42P01') {
      const fallback = await supabase
        .from('fixed_events')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      error = fallback.error;
    }

    if (error) throw error;

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Error deleting fixed class:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
