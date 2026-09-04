'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { CategoryOverview } from '@/components/CategoryOverview';
import { ResourceCard } from '@/components/ResourceCard';
import { ResourceListRow } from '@/components/ResourceListRow';
import { AddEditModal } from '@/components/AddEditModal';
import { DeleteModal } from '@/components/DeleteModal';
import { ImportExportModal } from '@/components/ImportExportModal';
import { BulkImportModal } from '@/components/BulkImportModal';
import { StatsBar } from '@/components/StatsBar';
import { AuthModal } from '@/components/AuthModal';
import { MigrationBanner } from '@/components/MigrationBanner';
import { NewsDigestTab } from '@/components/NewsDigestTab';
import { Resource, ViewMode, SortOption, CategoryStat, User, AppTab, NewsArticle } from '@/lib/types';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  fetchResources,
  createResource,
  updateResource,
  deleteResource,
  bulkSaveResources,
  fetchCategories,
  DEFAULT_STARTING_CATEGORIES,
} from '@/lib/storage';
import {
  Plus,
  Search,
  Sparkles,
  RefreshCw,
  Bookmark,
  ShieldCheck,
  Smartphone,
  Laptop,
  ArrowRight,
  Database,
  Key,
  Flame,
} from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');

  const [activeTab, setActiveTab] = useState<AppTab>('vault');
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [userCategories, setUserCategories] = useState<CategoryStat[]>([]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const supabaseReady = isSupabaseConfigured();

  // Check Supabase auth session on mount & subscribe to changes
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    const getInitialSession = async () => {
      try {
        setAuthLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0],
              avatarUrl: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
              createdAt: session.user.created_at,
            });
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.warn('Error checking Supabase session:', err);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    getInitialSession();

    // Listen to Supabase auth state changes (sign in, sign out, OAuth callback redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0],
          avatarUrl: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
          createdAt: session.user.created_at,
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load resources & categories from Supabase when user is authenticated
  const loadUserData = useCallback(async () => {
    if (!user) {
      setResources([]);
      setUserCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [resourcesData, categoriesData] = await Promise.all([
        fetchResources(),
        fetchCategories(),
      ]);
      setResources(resourcesData);
      setUserCategories(categoriesData);
    } catch (err) {
      console.warn('Failed to load user data from Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserData();
  }, [user, loadUserData]);

  // Logout handler
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setResources([]);
    setUserCategories([]);
  };

  // Categories with counts
  const categoriesStat: CategoryStat[] = useMemo(() => {
    const counts: Record<string, number> = {};

    // Initialize with default starting categories
    for (const cat of DEFAULT_STARTING_CATEGORIES) {
      counts[cat] = 0;
    }

    // Add any user categories fetched from Supabase
    for (const cat of userCategories) {
      if (!(cat.name in counts)) {
        counts[cat.name] = 0;
      }
    }

    // Count actual resources
    resources.forEach((r) => {
      const cat = r.category || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return Object.keys(counts)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, count: counts[name] }));
  }, [resources, userCategories]);

  // Unique category names list for dropdowns
  const existingCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_STARTING_CATEGORIES);
    userCategories.forEach((c) => set.add(c.name));
    resources.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [resources, userCategories]);

  // Unique tags list
  const existingTags = useMemo(() => {
    const set = new Set<string>();
    resources.forEach((r) => {
      r.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [resources]);

  // Filter & Search resources
  const filteredResources = useMemo(() => {
    let result = [...resources];

    // Category filter
    if (activeCategory) {
      result = result.filter((r) => r.category === activeCategory);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const cleanTagQuery = query.replace(/^#/, '');

      result = result.filter((r) => {
        const titleMatch = r.title.toLowerCase().includes(query);
        const categoryMatch = r.category.toLowerCase().includes(query);
        const notesMatch = (r.description || r.notes || '').toLowerCase().includes(query);
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

  // Resource CRUD Handlers with Supabase
  const handleSaveResource = async (
    resourceData: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'> | Resource
  ) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if ('id' in resourceData && (resourceData as Resource).id) {
      // Editing existing resource in Supabase
      const updated = await updateResource(resourceData as Resource);
      setResources((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } else {
      // Adding new resource in Supabase
      const created = await createResource(resourceData);
      setResources((prev) => [created, ...prev]);
    }
    // Refresh categories in background
    fetchCategories().then(setUserCategories).catch(console.warn);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId || !user) return;
    const success = await deleteResource(deletingId);
    if (success) {
      setResources((prev) => prev.filter((r) => r.id !== deletingId));
    }
    setDeletingId(null);
    fetchCategories().then(setUserCategories).catch(console.warn);
  };

  // Bulk save batch from AI parser to Supabase
  const handleSaveBulkBatch = async (
    items: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>[]
  ) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const saved = await bulkSaveResources(items);
      setResources((prev) => [...saved, ...prev]);
      fetchCategories().then(setUserCategories).catch(console.warn);
    } catch (err) {
      console.error('Failed to bulk save items to Supabase:', err);
    }
  };

  // Bulk import from JSON backup file to Supabase
  const handleBulkImportFile = async (importedList: Resource[]) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const saved = await bulkSaveResources(
        importedList.map((item) => ({
          url: item.url,
          title: item.title,
          category: item.category,
          tags: item.tags || [],
          notes: item.description || item.notes || '',
          description: item.description || item.notes || '',
          isPinned: Boolean(item.isPinned),
          createdAt: item.createdAt,
        }))
      );
      setResources((prev) => [...saved, ...prev]);
      fetchCategories().then(setUserCategories).catch(console.warn);
    } catch (err) {
      console.error('Failed to import backup file to Supabase:', err);
    }
  };

  // Migration from local storage completion
  const handleMigrationComplete = (migratedResources: Resource[]) => {
    setResources((prev) => [...migratedResources, ...prev]);
    fetchCategories().then(setUserCategories).catch(console.warn);
  };

  // Save article from News Digest into user's Supabase vault
  const handleSaveNewsArticleToVault = async (article: NewsArticle) => {
    if (!user) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const saved = await createResource({
        url: article.link,
        title: article.title,
        category: article.category || 'Technology',
        tags: article.keywords && article.keywords.length > 0 ? article.keywords.slice(0, 3) : ['News', 'Digest'],
        description: article.description || '',
        notes: `Saved from Daily News Digest (${article.sourceName || 'News'})`,
        isPinned: false,
      });
      setResources((prev) => [saved, ...prev]);
      fetchCategories().then(setUserCategories).catch(console.warn);
    } catch (err) {
      console.error('Failed to save news article to vault:', err);
    }
  };

  const deletingResourceTitle = useMemo(() => {
    return resources.find((r) => r.id === deletingId)?.title;
  }, [resources, deletingId]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenAddModal={() => {
          if (!user) {
            setAuthModalMode('signup');
            setIsAuthModalOpen(true);
            return;
          }
          setEditingResource(null);
          setIsAddModalOpen(true);
        }}
        onOpenBulkModal={() => {
          if (!user) {
            setAuthModalMode('signup');
            setIsAuthModalOpen(true);
            return;
          }
          setIsBulkModalOpen(true);
        }}
        onOpenBackupModal={() => {
          setIsBackupModalOpen(true);
        }}
        totalResources={resources.length}
        user={user}
        onOpenAuthModal={(mode = 'login') => {
          setAuthModalMode(mode);
          setIsAuthModalOpen(true);
        }}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Supabase Configuration Guidance Banner if keys not set in .env.local */}
        {!supabaseReady && (
          <div className="mb-6 p-4 rounded-2xl bg-zinc-900/90 border border-amber-500/30 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    Connect Supabase &amp; Google Sign-In
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                      Action Required
                    </span>
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    To activate Google Auth and PostgreSQL database, run <code className="text-zinc-200 bg-black/40 px-1.5 py-0.5 rounded">supabase/schema.sql</code> in your Supabase SQL Editor and add your project keys to <code className="text-zinc-200 bg-black/40 px-1.5 py-0.5 rounded">.env.local</code>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-all shrink-0 cursor-pointer"
              >
                View Setup Details
              </button>
            </div>
          </div>
        )}

        {/* Tab View Switcher Content */}
        {activeTab === 'news' ? (
          <NewsDigestTab
            onSaveToVault={handleSaveNewsArticleToVault}
            isAuthenticated={Boolean(user)}
            onRequireAuth={() => {
              setAuthModalMode('login');
              setIsAuthModalOpen(true);
            }}
            searchQuery={searchQuery}
          />
        ) : (
          <>
            {/* Unauthenticated Landing View */}
            {!authLoading && !user && (
          <div className="mb-10 py-12 px-6 sm:px-12 bg-gradient-to-br from-indigo-950/40 via-zinc-900 to-violet-950/40 border border-indigo-500/20 rounded-3xl text-center relative overflow-hidden shadow-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
              <ShieldCheck className="w-4 h-4" /> Supabase PostgreSQL • Row Level Security • Google Sign-In
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight max-w-2xl mx-auto">
              Save Links on Laptop. Access on Phone.
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 mt-3 max-w-xl mx-auto leading-relaxed">
              ResoVault is powered by Supabase with Row Level Security. Every link, folder, and tag is tied
              to your Google account — 100% private and synced across all your devices.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-indigo-400" />
                <span>Laptop &amp; Desktop</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                <span>Mobile &amp; Tablets</span>
              </div>
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-indigo-400" />
                <span>YouTube oEmbed &amp; Open Graph</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <button
                onClick={() => {
                  setAuthModalMode('login');
                  setIsAuthModalOpen(true);
                }}
                className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 text-sm font-semibold shadow-xl ring-1 ring-white/20 active:scale-95 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
                <ArrowRight className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
          </div>
        )}

        {/* Local Storage Migration Banner (for users with pre-existing browser testing data) */}
        <MigrationBanner onMigrationComplete={handleMigrationComplete} />

        {/* Category Folders Overview */}
        {user && (
          <CategoryOverview
            categories={categoriesStat}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            totalCount={resources.length}
          />
        )}

        {/* Stats & Sorting Bar */}
        {user && (
          <StatsBar
            totalResources={resources.length}
            totalCategories={categoriesStat.length}
            totalTags={existingTags.length}
            sortOption={sortOption}
            setSortOption={setSortOption}
          />
        )}

        {/* Search / Filter Active Indicator */}
        {user && (searchQuery || activeCategory) && (
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
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-200 underline transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Main Content Area */}
        {authLoading || (user && loading) ? (
          <div className="py-24 flex flex-col items-center justify-center text-zinc-500 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium">Loading your Supabase cloud resources...</p>
          </div>
        ) : user && filteredResources.length > 0 ? (
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
        ) : user ? (
          /* Empty Vault State */
          <div className="py-16 px-4 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl max-w-md mx-auto my-8">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center mx-auto mb-3 text-zinc-400">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-200 mb-1">No resources found</h3>
            <p className="text-xs text-zinc-400 mb-5">
              {searchQuery || activeCategory
                ? 'Try adjusting your search criteria or category filter.'
                : 'Your Supabase cloud vault is ready! Add your first link or bulk import links from text.'}
            </p>
            {searchQuery || activeCategory ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory(null);
                }}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer"
              >
                Clear Search &amp; Filters
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setEditingResource(null);
                    setIsAddModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  + Add Your First Link
                </button>
                <button
                  onClick={() => setIsBulkModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer"
                >
                  Bulk Import Links
                </button>
              </div>
            )}
          </div>
        ) : null}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-6 mt-12 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-zinc-400">ResoVault</span>
            <span>— Cross-Device Supabase Resource Engine</span>
          </div>
          <div>Row Level Security • Google Auth • Fast Scan UI</div>
        </div>
      </footer>

      {/* Auth Modal with Google Sign-In */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />

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

      {/* Backup / Export / Migration Modal */}
      <ImportExportModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        resources={resources}
        onImport={handleBulkImportFile}
      />
    </div>
  );
}
