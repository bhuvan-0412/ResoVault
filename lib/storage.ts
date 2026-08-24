import { Resource } from './types';
import { INITIAL_RESOURCES } from './utils';

const LOCAL_STORAGE_KEY = 'resource_hub_data_v1';

export async function fetchResources(): Promise<Resource[]> {
  try {
    const res = await fetch('/api/resources');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        // Sync to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        }
        return data;
      }
    }
  } catch (err) {
    console.warn('API fetch failed, falling back to localStorage:', err);
  }

  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // ignore parse error
      }
    }
  }

  return INITIAL_RESOURCES;
}

export async function createResource(resourceData: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>): Promise<Resource> {
  const newRes: Resource = {
    ...resourceData,
    id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resourceData),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data) return json.data;
    }
  } catch (err) {
    console.warn('API save failed, using local creation:', err);
  }

  return newRes;
}

export async function updateResource(resource: Resource): Promise<Resource> {
  try {
    const res = await fetch('/api/resources', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resource),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data) return json.data;
    }
  } catch (err) {
    console.warn('API update failed:', err);
  }

  return resource;
}

export async function deleteResource(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/resources?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) return true;
  } catch (err) {
    console.warn('API delete failed:', err);
  }
  return true;
}

export function saveToLocalStorage(resources: Resource[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(resources));
  }
}
