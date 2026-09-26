import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Deadline, DeadlineStatus, PriorityLevel } from '@/lib/types';

function mapRowToDeadline(row: any): Deadline {
  const status: DeadlineStatus = row.status || (row.completed ? 'done' : 'not_started');
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || null,
    dueDate: row.due_date ? String(row.due_date).split('T')[0] : new Date().toISOString().split('T')[0],
    dueTime: row.due_time ? String(row.due_time).slice(0, 5) : null,
    category: row.category || 'General',
    status,
    priority: (row.priority as PriorityLevel) || 'medium',
    estimatedDuration: row.estimated_duration || 45,
    completed: status === 'done',
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filterStatus = searchParams.get('status');

    let query = supabase
      .from('deadlines')
      .select('*')
      .eq('user_id', user.id);

    if (filterStatus && filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    let { data, error } = await query
      .order('due_date', { ascending: true })
      .order('priority', { ascending: false });

    // Fallback if deadlines table not yet migrated
    if (error && error.code === '42P01') {
      let fallbackQuery = supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id);

      if (filterStatus === 'done') {
        fallbackQuery = fallbackQuery.eq('completed', true);
      } else if (filterStatus === 'not_started' || filterStatus === 'open') {
        fallbackQuery = fallbackQuery.eq('completed', false);
      }

      const fallback = await fallbackQuery
        .order('due_date', { ascending: true })
        .order('priority', { ascending: false });

      if (!fallback.error) {
        data = fallback.data;
        error = null;
      }
    }

    if (error) throw error;

    const deadlines: Deadline[] = (data || []).map(mapRowToDeadline);
    return NextResponse.json({ deadlines, todos: deadlines });
  } catch (error: any) {
    console.error('Error fetching deadlines:', error);
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
    const { title, description, dueDate, dueTime, category, priority, status, estimatedDuration } = body;

    if (!title || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields: title, dueDate' },
        { status: 400 }
      );
    }

    const payload = {
      user_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      due_date: dueDate,
      due_time: dueTime || null,
      category: category?.trim() || 'General',
      priority: priority || 'medium',
      status: status || 'not_started',
      estimated_duration: estimatedDuration ? parseInt(estimatedDuration, 10) : 45,
    };

    let { data, error } = await supabase
      .from('deadlines')
      .insert(payload)
      .select()
      .single();

    // Fallback to todos table if deadlines not yet migrated
    if (error && error.code === '42P01') {
      const fallbackPayload = {
        user_id: user.id,
        title: title.trim(),
        due_date: dueTime ? `${dueDate}T${dueTime}:00Z` : `${dueDate}T23:59:59Z`,
        priority: priority || 'medium',
        estimated_duration: estimatedDuration ? parseInt(estimatedDuration, 10) : 45,
        completed: status === 'done',
        category: category?.trim() || 'General',
      };
      const fallback = await supabase
        .from('todos')
        .insert(fallbackPayload)
        .select()
        .single();
      if (!fallback.error) {
        data = fallback.data;
        error = null;
      }
    }

    if (error) throw error;

    const created = mapRowToDeadline(data);
    return NextResponse.json({ success: true, deadline: created, todo: created });
  } catch (error: any) {
    console.error('Error creating deadline:', error);
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
    const { id, title, description, dueDate, dueTime, category, priority, status, estimatedDuration, completed } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing deadline id' }, { status: 400 });
    }

    const effectiveStatus: DeadlineStatus | undefined = status !== undefined
      ? status
      : completed !== undefined
      ? (completed ? 'done' : 'not_started')
      : undefined;

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (title !== undefined) updatePayload.title = title.trim();
    if (description !== undefined) updatePayload.description = description ? description.trim() : null;
    if (dueDate !== undefined) updatePayload.due_date = dueDate;
    if (dueTime !== undefined) updatePayload.due_time = dueTime || null;
    if (category !== undefined) updatePayload.category = category ? category.trim() : 'General';
    if (priority !== undefined) updatePayload.priority = priority;
    if (effectiveStatus !== undefined) updatePayload.status = effectiveStatus;
    if (estimatedDuration !== undefined) updatePayload.estimated_duration = parseInt(estimatedDuration, 10);

    let { data, error } = await supabase
      .from('deadlines')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error && error.code === '42P01') {
      const fallbackPayload: Record<string, any> = {};
      if (title !== undefined) fallbackPayload.title = title.trim();
      if (dueDate !== undefined) {
        fallbackPayload.due_date = dueTime ? `${dueDate}T${dueTime}:00Z` : `${dueDate}T23:59:59Z`;
      }
      if (priority !== undefined) fallbackPayload.priority = priority;
      if (category !== undefined) fallbackPayload.category = category;
      if (effectiveStatus !== undefined) {
        fallbackPayload.completed = effectiveStatus === 'done';
        fallbackPayload.completed_at = effectiveStatus === 'done' ? new Date().toISOString() : null;
      }
      if (estimatedDuration !== undefined) fallbackPayload.estimated_duration = parseInt(estimatedDuration, 10);

      const fallback = await supabase
        .from('todos')
        .update(fallbackPayload)
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

    const updated = mapRowToDeadline(data);
    return NextResponse.json({ success: true, deadline: updated, todo: updated });
  } catch (error: any) {
    console.error('Error updating deadline:', error);
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
      return NextResponse.json({ error: 'Missing deadline id' }, { status: 400 });
    }

    let { error } = await supabase
      .from('deadlines')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error && error.code === '42P01') {
      const fallback = await supabase
        .from('todos')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      error = fallback.error;
    }

    if (error) throw error;

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Error deleting deadline:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
