import { createClient } from './supabase/client';
import { NewScriptInput, ScriptItem, ScriptStatus } from './types';

interface ScriptRow {
  id: string;
  user_id: string;
  title: string | null;
  body: string | null;
  status: string;
  corrections_note: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  shot_at: string | null;
  posted_at: string | null;
  position?: number | null;
}

function mapSupabaseScriptRow(row: ScriptRow): ScriptItem {
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
    position: row.position ?? null,
  };
}

function buildInsertPayload(userId: string, item: NewScriptInput): Record<string, unknown> {
  const now = new Date().toISOString();
  const status = item.status || 'needs_corrections';
  const payload: Record<string, unknown> = {
    user_id: userId,
    title: item.title.trim() || 'Untitled Script',
    body: item.body,
    status,
    corrections_note: item.correctionsNote?.trim() || null,
    tags: item.tags || [],
  };
  if (item.position != null) payload.position = item.position;
  if (status === 'shot') {
    payload.shot_at = item.shotAt || now;
  } else if (status === 'posted') {
    payload.shot_at = item.shotAt || item.postedAt || now;
    payload.posted_at = item.postedAt || now;
  }
  return payload;
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

  return ((data || []) as ScriptRow[]).map(mapSupabaseScriptRow);
}

export async function createScript(scriptData: NewScriptInput): Promise<ScriptItem> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User must be authenticated to create a script');
  }

  const { data, error } = await supabase
    .from('scripts')
    .insert(buildInsertPayload(user.id, scriptData))
    .select()
    .single();

  if (error) {
    console.error('Supabase createScript error:', error);
    throw error;
  }

  return mapSupabaseScriptRow(data as ScriptRow);
}

export async function updateScript(
  script: Partial<ScriptItem> & { id: string }
): Promise<ScriptItem> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User must be authenticated to update a script');
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (script.title !== undefined) payload.title = script.title.trim();
  if (script.body !== undefined) payload.body = script.body;
  // shot_at / posted_at are stamped by the DB trigger when a script enters those stages
  if (script.status !== undefined) payload.status = script.status;
  if (script.shotAt !== undefined) payload.shot_at = script.shotAt;
  if (script.postedAt !== undefined) payload.posted_at = script.postedAt;
  if (script.position !== undefined) payload.position = script.position;
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

  return mapSupabaseScriptRow(data as ScriptRow);
}

export type ScriptPlacementResult = Pick<ScriptItem, 'updatedAt' | 'shotAt' | 'postedAt'>;

/**
 * Writes only position (and status, for a cross-column move) so a drag touches one row
 * and never bumps updated_at on its own. Throws if Supabase reports an error
 * (supabase-js returns { error } instead of throwing).
 */
export async function updateScriptPlacement(
  id: string,
  placement: { position: number; status?: ScriptStatus }
): Promise<ScriptPlacementResult> {
  const supabase = createClient();
  const payload: { position: number; status?: ScriptStatus } = { position: placement.position };
  if (placement.status) payload.status = placement.status;

  const { data, error } = await supabase
    .from('scripts')
    .update(payload)
    .eq('id', id)
    .select('updated_at, shot_at, posted_at')
    .single();

  if (error) {
    console.error('Supabase updateScriptPlacement error:', error);
    throw error;
  }

  return {
    updatedAt: data.updated_at,
    shotAt: data.shot_at || null,
    postedAt: data.posted_at || null,
  };
}

export async function deleteScript(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('scripts').delete().eq('id', id);

  if (error) {
    console.error('Supabase deleteScript error:', error);
    throw error;
  }
}

export async function bulkCreateScripts(items: NewScriptInput[]): Promise<ScriptItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User must be authenticated to bulk create scripts');
  }

  const rows = items.map((item) => buildInsertPayload(user.id, item));

  const { data, error } = await supabase
    .from('scripts')
    .insert(rows)
    .select();

  if (error) {
    console.error('Supabase bulkCreateScripts error:', error);
    throw error;
  }

  return ((data || []) as ScriptRow[]).map(mapSupabaseScriptRow);
}
