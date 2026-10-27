import { createClient, isSupabaseConfigured } from './supabase/client';
import { Resource, CategoryStat, UrlMetadata } from './types';
import { FOLDER_NAMES } from './link-taxonomy';

// The 11 standard folders (see lib/link-taxonomy.ts)
export const DEFAULT_STARTING_CATEGORIES: string[] = [...FOLDER_NAMES];

interface SupabaseResourceRow {
  id: string;
  user_id?: string;
  url: string;
  title: string;
  category?: string | null;
  tags?: string[] | null;
  description?: string | null;
  is_pinned?: boolean | null;
  click_count?: number | null;
  last_opened_at?: string | null;
  created_at: string;
  updated_at: string;
}

function mapSupabaseRow(row: SupabaseResourceRow): Resource {
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    title: row.title,
    category: row.category || 'General',
    tags: Array.isArray(row.tags) ? row.tags : [],
    description: row.description || '',
    notes: row.description || '',
    isPinned: Boolean(row.is_pinned),
    clickCount: typeof row.click_count === 'number' ? row.click_count : 0,
    lastOpenedAt: row.last_opened_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Fetch all resources belonging to the authenticated user via Supabase RLS
export async function fetchResources(): Promise<Resource[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase fetchResources error:', error);
    return [];
  }

  const list = (data || []).map(mapSupabaseRow);

  // Merge client-side click tracker cache for instant real-time sync
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('resovault_click_tracker');
      if (stored) {
        const tracker = JSON.parse(stored);
        for (const item of list) {
          if (tracker[item.id]) {
            item.clickCount = Math.max(item.clickCount || 0, tracker[item.id].clickCount || 0);
            if (tracker[item.id].lastOpenedAt) {
              if (!item.lastOpenedAt || tracker[item.id].lastOpenedAt > item.lastOpenedAt) {
                item.lastOpenedAt = tracker[item.id].lastOpenedAt;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Click tracker sync error:', e);
    }
  }

  return list;
}

// Track click on resource URL: updates local tracker and writes to Supabase
export async function trackResourceClick(
  resourceId: string
): Promise<{ clickCount: number; lastOpenedAt: string }> {
  const now = new Date().toISOString();
  let count = 1;

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('resovault_click_tracker');
      const tracker = stored ? JSON.parse(stored) : {};
      const current = tracker[resourceId]?.clickCount || 0;
      count = current + 1;
      tracker[resourceId] = { clickCount: count, lastOpenedAt: now };
      localStorage.setItem('resovault_click_tracker', JSON.stringify(tracker));
    } catch (e) {
      console.warn('Failed to write click to localStorage:', e);
    }
  }

  // Attempt database persistence (if column exists)
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('resources')
        .update({
          click_count: count,
          last_opened_at: now,
        })
        .eq('id', resourceId);
    }
  } catch {
    // Ignore schema mismatch if column not yet applied to database
  }

  return { clickCount: count, lastOpenedAt: now };
}

// Toggle pinned status of resource
export async function togglePinResource(
  resourceId: string,
  isPinned: boolean
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('resources')
    .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
    .eq('id', resourceId);

  if (error) {
    console.error('Supabase togglePinResource error:', error);
    return false;
  }
  return true;
}

// Ensure category exists for user
export async function ensureCategoryExists(categoryName: string): Promise<void> {
  const clean = categoryName.trim();
  if (!clean) return;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    await supabase.from('categories').insert({
      user_id: user.id,
      name: clean,
    });
  } catch {
    // Ignore conflict error if category already exists
  }
}

// Create a single resource in Supabase
export async function createResource(
  resourceData: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Resource> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in with Google to save resources.');
  }

  const category = (resourceData.category || 'General').trim();
  await ensureCategoryExists(category);

  const { data, error } = await supabase
    .from('resources')
    .insert({
      user_id: user.id,
      url: resourceData.url.trim(),
      title: resourceData.title.trim(),
      description: (resourceData.notes || resourceData.description || '').trim(),
      category,
      tags: Array.isArray(resourceData.tags) ? resourceData.tags : [],
      is_pinned: Boolean(resourceData.isPinned),
    })
    .select()
    .single();

  if (error) {
    console.error('Supabase createResource error:', error);
    throw new Error(error.message || 'Failed to save resource to Supabase');
  }

  return mapSupabaseRow(data);
}

// Bulk save multiple resources in a single batch insert to Supabase
export async function bulkSaveResources(
  items: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<Resource[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in with Google to save resources.');
  }

  if (items.length === 0) return [];

  // 1. Ensure categories exist
  const uniqueCategories = Array.from(new Set(items.map((i) => (i.category || 'General').trim())));
  for (const cat of uniqueCategories) {
    await ensureCategoryExists(cat);
  }

  // 2. Batch insert
  const records = items.map((item) => ({
    user_id: user.id,
    url: item.url.trim(),
    title: item.title.trim(),
    description: (item.notes || item.description || '').trim(),
    category: (item.category || 'General').trim(),
    tags: Array.isArray(item.tags) ? item.tags : [],
    is_pinned: Boolean(item.isPinned),
  }));

  const { data, error } = await supabase.from('resources').insert(records).select();

  if (error) {
    console.error('Supabase bulkSaveResources error:', error);
    throw new Error(error.message || 'Failed to bulk save resources to Supabase');
  }

  return (data || []).map(mapSupabaseRow);
}

// Update resource in Supabase
export async function updateResource(resource: Resource): Promise<Resource> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be signed in to update resources.');
  }

  const category = (resource.category || 'General').trim();
  await ensureCategoryExists(category);

  const { data, error } = await supabase
    .from('resources')
    .update({
      url: resource.url.trim(),
      title: resource.title.trim(),
      description: (resource.notes || resource.description || '').trim(),
      category,
      tags: Array.isArray(resource.tags) ? resource.tags : [],
      is_pinned: Boolean(resource.isPinned),
      updated_at: new Date().toISOString(),
    })
    .eq('id', resource.id)
    .select()
    .single();

  if (error) {
    console.error('Supabase updateResource error:', error);
    throw new Error(error.message || 'Failed to update resource');
  }

  return mapSupabaseRow(data);
}

// Delete resource from Supabase
export async function deleteResource(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from('resources').delete().eq('id', id);

  if (error) {
    console.error('Supabase deleteResource error:', error);
    return false;
  }
  return true;
}

// Bulk delete resources from Supabase
export async function bulkDeleteResources(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const supabase = createClient();
  const { error } = await supabase.from('resources').delete().in('id', ids);

  if (error) {
    console.error('Supabase bulkDeleteResources error:', error);
    return false;
  }
  return true;
}

// Bulk update category for selected resources
export async function bulkUpdateCategory(ids: string[], categoryName: string): Promise<boolean> {
  if (ids.length === 0) return true;
  const clean = categoryName.trim();
  if (!clean) return false;

  await ensureCategoryExists(clean);

  const supabase = createClient();
  const { error } = await supabase
    .from('resources')
    .update({ category: clean, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (error) {
    console.error('Supabase bulkUpdateCategory error:', error);
    return false;
  }
  return true;
}

// Bulk add or remove tag for selected resources
export async function bulkModifyTag(
  resources: Resource[],
  ids: string[],
  tag: string,
  action: 'add' | 'remove'
): Promise<boolean> {
  if (ids.length === 0) return true;
  const clean = tag.trim().toLowerCase();
  if (!clean) return false;

  const supabase = createClient();
  const idSet = new Set(ids);
  const targets = resources.filter((r) => idSet.has(r.id));

  const updates = targets.map((r) => {
    const current = r.tags || [];
    const nextTags =
      action === 'add'
        ? Array.from(new Set([...current, clean]))
        : current.filter((t) => t.toLowerCase() !== clean);
    return supabase
      .from('resources')
      .update({ tags: nextTags, updated_at: new Date().toISOString() })
      .eq('id', r.id);
  });

  await Promise.all(updates);
  return true;
}

// Fetch user categories from Supabase with counts, in the user's saved folder order
export async function fetchCategories(): Promise<CategoryStat[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return DEFAULT_STARTING_CATEGORIES.map((name) => ({ name, count: 0 }));
  }

  // 1. Fetch user categories ordered by position (nulls last). Falls back to name order
  //    when the position column has not been migrated yet.
  let catNames: string[] | null = null;
  const ordered = await supabase
    .from('categories')
    .select('name')
    .order('position', { ascending: true, nullsFirst: false })
    .order('name');
  if (!ordered.error) {
    catNames = (ordered.data || []).map((r) => r.name as string);
  } else {
    const plain = await supabase.from('categories').select('name').order('name');
    if (plain.error) {
      console.error('Supabase fetchCategories error:', plain.error);
    } else {
      catNames = (plain.data || []).map((r) => r.name as string);
    }
  }

  // Brand-new account with no folders: seed the 11 standard ones
  if (catNames && catNames.length === 0) {
    for (const catName of DEFAULT_STARTING_CATEGORIES) {
      await ensureCategoryExists(catName);
    }
    catNames = [...DEFAULT_STARTING_CATEGORIES];
  }

  // 2. Fetch resources to calculate counts
  const { data: resourceRows, error: resError } = await supabase.from('resources').select('category');
  if (resError) {
    console.error('Supabase fetchCategories counts error:', resError);
  }

  const counts: Record<string, number> = {};
  for (const name of catNames || []) {
    counts[name] = 0;
  }

  const extras = new Set<string>();
  for (const r of resourceRows || []) {
    const cat = r.category || 'Uncategorized';
    if (!(cat in counts)) extras.add(cat);
    counts[cat] = (counts[cat] || 0) + 1;
  }

  // Saved order first, then folders that only exist on links (alphabetical)
  const names = [...(catNames || []), ...Array.from(extras).sort((a, b) => a.localeCompare(b))];
  return names.map((name) => ({ name, count: counts[name] || 0 }));
}

// Create custom category in Supabase
export async function createCategory(name: string): Promise<CategoryStat[]> {
  await ensureCategoryExists(name);
  return await fetchCategories();
}

// Auto-fetch link metadata (YouTube oEmbed + Open Graph)
export async function fetchUrlMetadata(url: string): Promise<UrlMetadata | null> {
  try {
    const res = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const json = await res.json();
      return json.data || null;
    }
  } catch (err) {
    console.warn('Metadata fetch failed:', err);
  }
  return null;
}




// ---------------------------------------------------------------------------
// Folder management (rename / merge / delete / reorder)
// supabase-js does not throw: every call below inspects its { error } return.
// ---------------------------------------------------------------------------

export type StorageResult = { ok: true } | { ok: false; error: string };

const MIGRATION_HINT = 'Run supabase/migrations/20261027_categories_manage.sql in the Supabase SQL Editor.';

async function getUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function failure(prefix: string, message: string): StorageResult {
  return { ok: false, error: `${prefix}: ${message}` };
}

// Rename a folder: updates the category row AND every link filed under the old name
export async function renameCategory(oldName: string, newName: string): Promise<StorageResult> {
  const clean = newName.trim();
  if (!clean) return { ok: false, error: 'Folder name cannot be empty.' };
  if (clean === oldName) return { ok: true };

  const userId = await getUserId();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = createClient();

  // 1. Category row (a folder may exist only on links, with no row)
  const { data: existing, error: lookupError } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', oldName);
  if (lookupError) return failure('Could not read folder', lookupError.message);
  const hadRow = (existing || []).length > 0;

  if (hadRow) {
    const { data: updated, error } = await supabase
      .from('categories')
      .update({ name: clean })
      .eq('user_id', userId)
      .eq('name', oldName)
      .select('id');
    if (error) {
      return failure('Could not rename folder', error.code === '23505' ? `"${clean}" already exists` : error.message);
    }
    if (!updated || updated.length === 0) {
      return { ok: false, error: `Rename was blocked (missing UPDATE policy). ${MIGRATION_HINT}` };
    }
  } else {
    const { error } = await supabase.from('categories').insert({ user_id: userId, name: clean });
    if (error && error.code !== '23505') return failure('Could not create folder', error.message);
  }

  // 2. Links
  const { error: linkError } = await supabase
    .from('resources')
    .update({ category: clean, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('category', oldName);
  if (linkError) {
    // Roll the folder name back so links and folder stay in sync
    if (hadRow) {
      const { error: rollbackError } = await supabase
        .from('categories')
        .update({ name: oldName })
        .eq('user_id', userId)
        .eq('name', clean);
      if (rollbackError) console.error('Rename rollback failed:', rollbackError);
    }
    return failure('Could not move links to the new name', linkError.message);
  }

  return { ok: true };
}

// Move every link from one folder to another, then remove the source folder
export async function mergeCategory(fromName: string, toName: string): Promise<StorageResult> {
  if (fromName === toName) return { ok: false, error: 'Pick a different destination folder.' };

  const userId = await getUserId();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = createClient();

  // Destination must exist as a folder row
  const { error: ensureError } = await supabase.from('categories').insert({ user_id: userId, name: toName });
  if (ensureError && ensureError.code !== '23505') return failure('Could not prepare destination', ensureError.message);

  const { error: moveError } = await supabase
    .from('resources')
    .update({ category: toName, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('category', fromName);
  if (moveError) return failure('Could not move links (nothing was deleted)', moveError.message);

  const { error: deleteError } = await supabase
    .from('categories')
    .delete()
    .eq('user_id', userId)
    .eq('name', fromName);
  if (deleteError) return failure('Links moved, but the old folder could not be deleted', deleteError.message);

  return { ok: true };
}

// Delete a folder. A folder that still has links needs a destination; links are never silently deleted.
export async function deleteCategory(name: string, moveTo?: string): Promise<StorageResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = createClient();

  const { count, error: countError } = await supabase
    .from('resources')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category', name);
  if (countError) return failure('Could not check folder contents', countError.message);

  if ((count ?? 0) > 0) {
    if (!moveTo) {
      return { ok: false, error: `"${name}" still has ${count} link${count === 1 ? '' : 's'}. Choose where to move them.` };
    }
    return mergeCategory(name, moveTo);
  }

  const { error } = await supabase.from('categories').delete().eq('user_id', userId).eq('name', name);
  if (error) return failure('Could not delete folder', error.message);
  return { ok: true };
}

// Persist the folder order (position = index * 1000). Creates rows for folders that only exist on links.
export async function reorderCategories(orderedNames: string[]): Promise<StorageResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: 'You must be signed in.' };
  const supabase = createClient();

  const rows = orderedNames.map((name, i) => ({ user_id: userId, name, position: (i + 1) * 1000 }));
  const { error } = await supabase.from('categories').upsert(rows, { onConflict: 'user_id,name' });
  if (error) {
    const missing = error.code === '42703' || error.code === '42501' || /position|policy/i.test(error.message);
    return failure('Could not save folder order', missing ? `${error.message}. ${MIGRATION_HINT}` : error.message);
  }
  return { ok: true };
}
