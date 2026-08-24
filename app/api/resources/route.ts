import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Resource } from '@/lib/types';
import { INITIAL_RESOURCES } from '@/lib/utils';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'resources.json');

function ensureDataFile(): Resource[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_RESOURCES, null, 2), 'utf-8');
      return INITIAL_RESOURCES;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_RESOURCES;
  } catch (err) {
    console.error('Error reading resources file:', err);
    return INITIAL_RESOURCES;
  }
}

function saveDataFile(resources: Resource[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(resources, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving resources file:', err);
  }
}

export async function GET() {
  const resources = ensureDataFile();
  return NextResponse.json(resources);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Check if replacing entire list (e.g. bulk import / reorder) or adding single resource
    if (Array.isArray(body)) {
      saveDataFile(body);
      return NextResponse.json({ success: true, data: body });
    }

    const { url, title, category, tags, notes, isPinned } = body;

    if (!url || !title) {
      return NextResponse.json({ error: 'URL and Title are required' }, { status: 400 });
    }

    const resources = ensureDataFile();
    const newResource: Resource = {
      id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      url: url.trim(),
      title: title.trim(),
      category: (category || 'Uncategorized').trim(),
      tags: Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : [],
      notes: notes ? notes.trim() : '',
      isPinned: Boolean(isPinned),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newResource, ...resources];
    saveDataFile(updated);

    return NextResponse.json({ success: true, data: newResource });
  } catch (error) {
    console.error('Error in POST /api/resources:', error);
    return NextResponse.json({ error: 'Failed to save resource' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, url, title, category, tags, notes, isPinned } = body;

    if (!id || !url || !title) {
      return NextResponse.json({ error: 'ID, URL and Title are required' }, { status: 400 });
    }

    const resources = ensureDataFile();
    const index = resources.findIndex(r => r.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const updatedResource: Resource = {
      ...resources[index],
      url: url.trim(),
      title: title.trim(),
      category: (category || 'Uncategorized').trim(),
      tags: Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : [],
      notes: notes !== undefined ? notes.trim() : resources[index].notes,
      isPinned: isPinned !== undefined ? Boolean(isPinned) : resources[index].isPinned,
      updatedAt: new Date().toISOString(),
    };

    resources[index] = updatedResource;
    saveDataFile(resources);

    return NextResponse.json({ success: true, data: updatedResource });
  } catch (error) {
    console.error('Error in PUT /api/resources:', error);
    return NextResponse.json({ error: 'Failed to update resource' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Resource ID is required' }, { status: 400 });
    }

    const resources = ensureDataFile();
    const filtered = resources.filter(r => r.id !== id);
    saveDataFile(filtered);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error in DELETE /api/resources:', error);
    return NextResponse.json({ error: 'Failed to delete resource' }, { status: 500 });
  }
}
