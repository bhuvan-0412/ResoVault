import { createClient, isSupabaseConfigured } from './supabase/client';
import { Resource, CategoryStat, UrlMetadata } from './types';

export const LOCAL_STORAGE_KEY = 'resource_hub_data_v1';
export const LOCAL_STORAGE_MIGRATED_KEY = 'resource_hub_migrated_to_db';

export const DEFAULT_STARTING_CATEGORIES = [
  'Video Editing',
  'Development',
  'Content Creation',
  'Product Management',
];

function mapSupabaseRow(row: any): Resource {
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

  return (data || []).map(mapSupabaseRow);
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

// Fetch user categories from Supabase with counts
export async function fetchCategories(): Promise<CategoryStat[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return DEFAULT_STARTING_CATEGORIES.map((name) => ({ name, count: 0 }));
  }

  // 1. Fetch user categories
  const { data: catRows, error: catError } = await supabase
    .from('categories')
    .select('name')
    .order('name');

  // If no categories exist yet in DB, seed the 4 default categories
  if (!catRows || catRows.length === 0) {
    for (const catName of DEFAULT_STARTING_CATEGORIES) {
      await ensureCategoryExists(catName);
    }
  }

  // 2. Fetch resources to calculate counts
  const { data: resourceRows } = await supabase.from('resources').select('category');

  const counts: Record<string, number> = {};
  for (const c of DEFAULT_STARTING_CATEGORIES) {
    counts[c] = 0;
  }

  if (catRows) {
    for (const row of catRows) {
      if (!(row.name in counts)) {
        counts[row.name] = 0;
      }
    }
  }

  if (resourceRows) {
    for (const r of resourceRows) {
      const cat = r.category || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    }
  }

  return Object.keys(counts)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, count: counts[name] }));
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

// LocalStorage helpers for migration and data safety
export function getLocalStoredResources(): Resource[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isLocalStorageMigrationNeeded(): boolean {
  if (typeof window === 'undefined') return false;
  const isMigrated = localStorage.getItem(LOCAL_STORAGE_MIGRATED_KEY) === 'true';
  if (isMigrated) return false;
  const resources = getLocalStoredResources();
  return resources.length > 0;
}

export function markLocalStorageMigrated(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_MIGRATED_KEY, 'true');
}

export function clearLocalStoredResources(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}
