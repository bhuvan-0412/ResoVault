import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { TodoItem } from '@/lib/types';

export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const completedParam = searchParams.get('completed');

    let query = supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .order('completed', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (completedParam === 'false') {
      query = query.eq('completed', false);
    } else if (completedParam === 'true') {
      query = query.eq('completed', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    const todos: TodoItem[] = (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      dueDate: row.due_date,
      priority: row.priority || 'medium',
      estimatedDuration: row.estimated_duration || 45,
      completed: Boolean(row.completed),
      completedAt: row.completed_at,
      category: row.category,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ todos });
  } catch (error: any) {
    console.error('Error fetching todos:', error);
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
    const { title, dueDate, priority, estimatedDuration, category } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('todos')
      .insert({
        user_id: user.id,
        title: title.trim(),
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        priority: priority || 'medium',
        estimated_duration: parseInt(estimatedDuration, 10) || 45,
        category: category || null,
        completed: false,
      })
      .select()
      .single();

    if (error) throw error;

    const created: TodoItem = {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      dueDate: data.due_date,
      priority: data.priority,
      estimatedDuration: data.estimated_duration,
      completed: data.completed,
      completedAt: data.completed_at,
      category: data.category,
      createdAt: data.created_at,
    };

    return NextResponse.json({ success: true, todo: created });
  } catch (error: any) {
    console.error('Error adding todo:', error);
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
    const { id, title, dueDate, priority, estimatedDuration, completed, category } = body;

    if (!id) {
      return NextResponse.json({ error: 'Todo id is required' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {};
    if (title !== undefined) updatePayload.title = title.trim();
    if (dueDate !== undefined) updatePayload.due_date = dueDate ? new Date(dueDate).toISOString() : null;
    if (priority !== undefined) updatePayload.priority = priority;
    if (estimatedDuration !== undefined) updatePayload.estimated_duration = parseInt(estimatedDuration, 10);
    if (category !== undefined) updatePayload.category = category;
    if (completed !== undefined) {
      updatePayload.completed = completed;
      updatePayload.completed_at = completed ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from('todos')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    const updated: TodoItem = {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      dueDate: data.due_date,
      priority: data.priority,
      estimatedDuration: data.estimated_duration,
      completed: data.completed,
      completedAt: data.completed_at,
      category: data.category,
      createdAt: data.created_at,
    };

    return NextResponse.json({ success: true, todo: updated });
  } catch (error: any) {
    console.error('Error updating todo:', error);
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
      return NextResponse.json({ error: 'Todo id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Error deleting todo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
