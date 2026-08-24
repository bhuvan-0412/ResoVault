'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { CategoryOverview } from '@/components/CategoryOverview';
import { ResourceCard } from '@/components/ResourceCard';
import { ResourceListRow } from '@/components/ResourceListRow';
import { AddEditModal } from '@/components/AddEditModal';
import { DeleteModal } from '@/components/DeleteModal';
import { ImportExportModal } from '@/components/ImportExportModal';
import { BulkImportModal } from '@/components/BulkImportModal';
import { StatsBar } from '@/components/StatsBar';
import { Resource, ViewMode, SortOption, CategoryStat } from '@/lib/types';
import {
  fetchResources,
  createResource,
  updateResource,
  deleteResource,
  saveToLocalStorage,
} from '@/lib/storage';
import { Plus, Search, Folder, Sparkles, RefreshCw, Bookmark } from 'lucide-react';

export default function Home() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Load resources on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await fetchResources();
      setResources(data);
      setLoading(false);
    }
    loadData();
  }, []);

  // Sync state to LocalStorage whenever resources state updates
  const updateResourcesState = (newResources: Resource[]) => {
    setResources(newResources);
    saveToLocalStorage(newResources);
  };

  // Derive unique categories and counts
  const categoriesStat: CategoryStat[] = useMemo(() => {
    const counts: Record<string, number> = {};
    resources.forEach((r) => {
      const cat = r.category || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.keys(counts)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, count: counts[name] }));
  }, [resources]);

  // Derive list of all existing unique categories
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    resources.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    const list = Array.from(set).sort();
    return list.length > 0 ? list : ['Work & Projects', 'Development', 'Design', 'Articles'];
  }, [resources]);

  // Derive list of all existing unique tags
  const existingTags = useMemo(() => {
    const set = new Set<string>();
    resources.forEach((r) => {
      r.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [resources]);

  // Filter & Search resources in real-time
  const filteredResources = useMemo(() => {
    let result = [...resources];

    // Category filter
    if (activeCategory) {
      result = result.filter((r) => r.category === activeCategory);
    }

    // Search query filter (matches title, category, tags, notes, url)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const cleanTagQuery = query.replace(/^#/, '');

      result = result.filter((r) => {
        const titleMatch = r.title.toLowerCase().includes(query);
        const categoryMatch = r.category.toLowerCase().includes(query);
        const notesMatch = r.notes?.toLowerCase().includes(query);
        const urlMatch = r.url.toLowerCase().includes(query);
        const tagMatch = r.tags?.some((t) => t.toLowerCase().includes(cleanTagQuery));

        return titleMatch || categoryMatch || notesMatch || urlMatch || tagMatch;
      });
    }

    // Sort
    result.sort((a, b) => {
      if (sortOption === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortOption === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortOption === 'title-asc') {
        return a.title.localeCompare(b.title);
      }
      if (sortOption === 'title-desc') {
        return b.title.localeCompare(a.title);
      }
      return 0;
    });

    return result;
  }, [resources, activeCategory, searchQuery, sortOption]);

  // Resource CRUD Handlers
  const handleSaveResource = async (
    resourceData: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'> | Resource
  ) => {
    if ('id' in resourceData) {
      // Editing existing resource
      const updated = await updateResource(resourceData as Resource);
      const nextList = resources.map((r) => (r.id === updated.id ? updated : r));
      updateResourcesState(nextList);
    } else {
      // Adding new resource
      const created = await createResource(resourceData);
      const nextList = [created, ...resources];
      updateResourcesState(nextList);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    await deleteResource(deletingId);
    const nextList = resources.filter((r) => r.id !== deletingId);
    updateResourcesState(nextList);
    setDeletingId(null);
  };

  const handleBulkImportFile = (importedList: Resource[]) => {
    updateResourcesState(importedList);
    fetch('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(importedList),
    }).catch((err) => console.warn('Bulk import server sync error:', err));
  };

  // Bulk save extracted batch from AI text parser
  const handleSaveBulkBatch = async (
    items: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>[]
  ) => {
    const createdResources: Resource[] = items.map((item, idx) => ({
      ...item,
      id: `res-bulk-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const nextList = [...createdResources, ...resources];
    updateResourcesState(nextList);

    // Sync to server JSON file storage
    fetch('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextList),
    }).catch((err) => console.warn('Bulk save server sync error:', err));
  };

  const deletingResourceTitle = useMemo(() => {
    return resources.find((r) => r.id === deletingId)?.title;
  }, [resources, deletingId]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Top Navigation & Instant Search */}
      <Navbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenAddModal={() => {
          setEditingResource(null);
          setIsAddModalOpen(true);
        }}
        onOpenBulkModal={() => setIsBulkModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        totalResources={resources.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Category Folders Overview */}
        <CategoryOverview
          categories={categoriesStat}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          totalCount={resources.length}
        />

        {/* Stats & Sorting Bar */}
        <StatsBar
          totalResources={resources.length}
          totalCategories={categoriesStat.length}
          totalTags={existingTags.length}
          sortOption={sortOption}
          setSortOption={setSortOption}
        />

        {/* Search / Filter Indicator */}
        {(searchQuery || activeCategory) && (
          <div className="mb-4 flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-xl text-xs">
            <div className="flex items-center gap-2 text-indigo-300 font-medium">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>
                Showing {filteredResources.length} matching result{filteredResources.length !== 1 ? 's' : ''}
                {activeCategory && (
                  <span>
                    {' '}in folder <strong className="text-white">&quot;{activeCategory}&quot;</strong>
                  </span>
                )}
                {searchQuery && (
                  <span>
                    {' '}for query <strong className="text-white">&quot;{searchQuery}&quot;</strong>
                  </span>
                )}
              </span>
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory(null);
              }}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-200 underline transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-zinc-500 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium">Loading resources...</p>
          </div>
        ) : filteredResources.length > 0 ? (
          /* Resource Cards Grid / List View */
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onEdit={(res) => {
                    setEditingResource(res);
                    setIsAddModalOpen(true);
                  }}
                  onDelete={(id) => setDeletingId(id)}
                  onTagClick={(tag) => setSearchQuery(`#${tag}`)}
                  onCategoryClick={(cat) => setActiveCategory(cat)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredResources.map((resource) => (
                <ResourceListRow
                  key={resource.id}
                  resource={resource}
                  onEdit={(res) => {
                    setEditingResource(res);
                    setIsAddModalOpen(true);
                  }}
                  onDelete={(id) => setDeletingId(id)}
                  onTagClick={(tag) => setSearchQuery(`#${tag}`)}
                  onCategoryClick={(cat) => setActiveCategory(cat)}
                />
              ))}
            </div>
          )
        ) : (
          /* Empty Search / Folder View */
          <div className="py-16 px-4 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl max-w-md mx-auto my-8">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center mx-auto mb-3 text-zinc-400">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-200 mb-1">No resources found</h3>
            <p className="text-xs text-zinc-400 mb-5">
              {searchQuery || activeCategory
                ? 'Try adjusting your search criteria or category filter.'
                : 'Your resource hub is empty. Add your first link to get started!'}
            </p>
            {searchQuery || activeCategory ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory(null);
                }}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all"
              >
                Clear Search & Filters
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditingResource(null);
                  setIsAddModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
              >
                + Add Your First Link
              </button>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-6 mt-12 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-zinc-400">Resource Hub</span>
            <span>— Save, organize, &amp; access links instantly</span>
          </div>
          <div>Private &amp; Single-User • Fast Scan UI</div>
        </div>
      </footer>

      {/* Add / Edit Resource Modal */}
      <AddEditModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingResource(null);
        }}
        onSave={handleSaveResource}
        existingCategories={existingCategories}
        existingTags={existingTags}
        editingResource={editingResource}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        existingResources={resources}
        existingCategories={existingCategories}
        onSaveBulk={handleSaveBulkBatch}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDeleteConfirm}
        resourceTitle={deletingResourceTitle}
      />

      {/* Backup / Export / Import Modal */}
      <ImportExportModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        resources={resources}
        onImport={handleBulkImportFile}
      />

    </div>
  );
}
