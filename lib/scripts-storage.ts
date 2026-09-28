import { createClient } from './supabase/client';
import { ScriptItem, ScriptStatus } from './types';

function mapSupabaseScriptRow(row: any): ScriptItem {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || 'Untitled Script',
    body: row.body || '',
    status: row.status as ScriptStatus,
    correctionsNote: row.corrections_note || null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    shotAt: row.shot_at || null,
    postedAt: row.posted_at || null,
  };
}

export async function fetchScripts(): Promise<ScriptItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase fetchScripts error:', error);
    // Table might not exist yet if migration hasn't been executed
    return [];
  }

  return (data || []).map(mapSupabaseScriptRow);
}

export async function createScript(
  scriptData: Omit<ScriptItem, 'id' | 'createdAt' | 'updatedAt' | 'shotAt' | 'postedAt'>
): Promise<ScriptItem> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User must be authenticated to create a script');
  }

  const now = new Date().toISOString();
  const payload: any = {
    user_id: user.id,
    title: scriptData.title.trim() || 'Untitled Script',
    body: scriptData.body,
    status: scriptData.status || 'needs_corrections',
    corrections_note: scriptData.correctionsNote?.trim() || null,
    tags: scriptData.tags || [],
  };

  if (scriptData.status === 'shot') {
    payload.shot_at = now;
  } else if (scriptData.status === 'posted') {
    payload.shot_at = now;
    payload.posted_at = now;
  }

  const { data, error } = await supabase
    .from('scripts')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Supabase createScript error:', error);
    throw error;
  }

  return mapSupabaseScriptRow(data);
}

export async function updateScript(
  script: Partial<ScriptItem> & { id: string }
): Promise<ScriptItem> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User must be authenticated to update a script');
  }

  const now = new Date().toISOString();
  const payload: any = {
    updated_at: now,
  };

  if (script.title !== undefined) payload.title = script.title.trim();
  if (script.body !== undefined) payload.body = script.body;
  if (script.status !== undefined) {
    payload.status = script.status;
    if (script.status === 'shot' && !script.shotAt) {
      payload.shot_at = now;
    }
    if (script.status === 'posted') {
      if (!script.postedAt) payload.posted_at = now;
      if (!script.shotAt) payload.shot_at = now;
    }
  }
  if (script.correctionsNote !== undefined) payload.corrections_note = script.correctionsNote?.trim() || null;
  if (script.tags !== undefined) payload.tags = script.tags;

  const { data, error } = await supabase
    .from('scripts')
    .update(payload)
    .eq('id', script.id)
    .select()
    .single();

  if (error) {
    console.error('Supabase updateScript error:', error);
    throw error;
  }

  return mapSupabaseScriptRow(data);
}

export async function updateScriptStatus(
  id: string,
  newStatus: ScriptStatus,
  currentScript?: ScriptItem
): Promise<ScriptItem> {
  const now = new Date().toISOString();
  const updatePayload: Partial<ScriptItem> & { id: string } = {
    id,
    status: newStatus,
  };

  if (newStatus === 'shot' && !currentScript?.shotAt) {
    updatePayload.shotAt = now;
  } else if (newStatus === 'posted') {
    if (!currentScript?.postedAt) updatePayload.postedAt = now;
    if (!currentScript?.shotAt) updatePayload.shotAt = now;
  }

  return updateScript(updatePayload);
}

export async function deleteScript(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('scripts').delete().eq('id', id);

  if (error) {
    console.error('Supabase deleteScript error:', error);
    throw error;
  }
}

export async function bulkCreateScripts(
  items: Omit<ScriptItem, 'id' | 'createdAt' | 'updatedAt' | 'shotAt' | 'postedAt'>[]
): Promise<ScriptItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User must be authenticated to bulk create scripts');
  }

  const now = new Date().toISOString();
  const rows = items.map((item) => {
    const payload: any = {
      user_id: user.id,
      title: item.title.trim() || 'Untitled Script',
      body: item.body,
      status: item.status || 'needs_corrections',
      corrections_note: item.correctionsNote?.trim() || null,
      tags: item.tags || [],
    };
    if (item.status === 'shot') {
      payload.shot_at = now;
    } else if (item.status === 'posted') {
      payload.shot_at = now;
      payload.posted_at = now;
    }
    return payload;
  });

  const { data, error } = await supabase
    .from('scripts')
    .insert(rows)
    .select();

  if (error) {
    console.error('Supabase bulkCreateScripts error:', error);
    throw error;
  }

  return (data || []).map(mapSupabaseScriptRow);
}
