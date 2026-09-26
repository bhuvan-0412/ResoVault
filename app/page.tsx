'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { NewsDigestTab } from '@/components/NewsDigestTab';
import { ScheduleTab } from '@/components/ScheduleTab';
import { ToastContainer, ToastItem } from '@/components/Toast';
import { ResourceSkeleton } from '@/components/ResourceSkeleton';
import { ShortcutsModal } from '@/components/ShortcutsModal';
import { BulkActionsBar } from '@/components/BulkActionsBar';
import { RecentShelf } from '@/components/RecentShelf';
import { Resource, ViewMode, SortOption, CategoryStat, User, AppTab, NewsArticle } from '@/lib/types';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import Fuse from 'fuse.js';
import {
  fetchResources,
  createResource,
  updateResource,
  deleteResource,
  bulkDeleteResources,
  bulkUpdateCategory,
  bulkModifyTag,
  bulkSaveResources,
  fetchCategories,
  DEFAULT_STARTING_CATEGORIES,
  trackResourceClick,
  togglePinResource,
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'AND' | 'OR'>('AND');
  const [userCategories, setUserCategories] = useState<CategoryStat[]>([]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Bulk selection state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Keyboard navigation focus index in filteredResources
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Pending deletions map for Undo capability: deletionKey -> { timer, items }
  const pendingDeletionsRef = useRef<Map<string, { timer: NodeJS.Timeout; items: Resource[] }>>(new Map());

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (
      message: string,
      type: ToastItem['type'] = 'success',
      subtext?: string,
      undoAction?: () => void,
      durationMs?: number
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type, subtext, undoAction, durationMs }]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const supabaseReady = isSupabaseConfigured();

  // Check Supabase auth session on mount & subscribe to changes
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    // Actively purge legacy localStorage keys so stale client data never persists
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('resource_hub_data_v1');
        localStorage.removeItem('resource_hub_migrated_to_db');
      } catch {
        // Ignore in restricted storage environments
      }
    }

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

  // Tag filter handlers
  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleClearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  // Favorite / Pin toggle handler: persists to Supabase and updates state immediately
  const handleTogglePin = useCallback(async (resourceId: string, nextPinned: boolean) => {
    setResources((prev) =>
      prev.map((r) => (r.id === resourceId ? { ...r, isPinned: nextPinned } : r))
    );
    showToast(nextPinned ? 'Pinned resource to top' : 'Unpinned resource', 'pin');
    try {
      await togglePinResource(resourceId, nextPinned);
    } catch (e) {
      console.warn('Failed to toggle pin on Supabase:', e);
    }
  }, [showToast]);

  // Click tracking handler: increment click counter, update lastOpenedAt, and persist
  const handleResourceClick = useCallback(async (resourceId: string) => {
    const now = new Date().toISOString();
    setResources((prev) =>
      prev.map((r) =>
        r.id === resourceId
          ? {
              ...r,
              clickCount: (r.clickCount || 0) + 1,
              lastOpenedAt: now,
            }
          : r
      )
    );
    try {
      await trackResourceClick(resourceId);
    } catch (e) {
      console.warn('Failed to track click on Supabase:', e);
    }
  }, []);

  // Filter & Search resources with Fuse.js (Fuzzy, Typo-Tolerant & Relevance Ranked)
  const filteredResources = useMemo(() => {
    let list = [...resources];

    // 1. Category Filter (single-select)
    if (activeCategory) {
      list = list.filter((r) => r.category === activeCategory);
    }

    // 2. Tag Filter (multi-select with AND / OR toggle)
    if (selectedTags.length > 0) {
      list = list.filter((r) => {
        const itemTags = (r.tags || []).map((t) => t.toLowerCase());
        if (tagFilterMode === 'AND') {
          return selectedTags.every((st) => itemTags.includes(st.toLowerCase()));
        } else {
          return selectedTags.some((st) => itemTags.includes(st.toLowerCase()));
        }
      });
    }

    // 3. Feature 3: Smart Fuzzy Search across title, category, tags, notes, and url
    const query = searchQuery.trim();
    let searchResultScores: Map<string, number> | null = null;

    if (query) {
      // If user typed a hashtag like #ai, perform direct tag matching
      if (query.startsWith('#')) {
        const cleanTag = query.slice(1).toLowerCase().trim();
        list = list.filter((r) =>
          r.tags?.some((t) => t.toLowerCase().includes(cleanTag))
        );
      } else {
        const fuse = new Fuse(list, {
          keys: [
            { name: 'title', weight: 0.40 },
            { name: 'category', weight: 0.20 },
            { name: 'tags', weight: 0.20 },
            { name: 'notes', weight: 0.12 },
            { name: 'description', weight: 0.12 },
            { name: 'url', weight: 0.08 },
          ],
          threshold: 0.38, // Balance between typo tolerance and accurate precision
          ignoreLocation: true,
          includeScore: true,
        });

        const fuseResults = fuse.search(query);
        searchResultScores = new Map();
        fuseResults.forEach((res) => {
          searchResultScores!.set(res.item.id, res.score ?? 1);
        });

        list = fuseResults.map((res) => res.item);
      }
    }

    // 4. Feature 2 Sorting Comparator
    const sortComparator = (a: Resource, b: Resource) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'mru': {
          const timeA = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
          const timeB = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
          return timeB - timeA;
        }
        case 'most-used':
          return (b.clickCount || 0) - (a.clickCount || 0);
        case 'least-used':
          return (a.clickCount || 0) - (b.clickCount || 0);
        default:
          if (searchResultScores) {
            const scoreA = searchResultScores.get(a.id) ?? 1;
            const scoreB = searchResultScores.get(b.id) ?? 1;
            return scoreA - scoreB;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    };

    // Pinned resources ALWAYS show at the top regardless of sort order
    const pinned = list.filter((r) => Boolean(r.isPinned));
    const unpinned = list.filter((r) => !r.isPinned);

    pinned.sort(sortComparator);
    unpinned.sort(sortComparator);

    return [...pinned, ...unpinned];
  }, [resources, activeCategory, selectedTags, tagFilterMode, searchQuery, sortOption]);

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
      showToast('Resource updated successfully', 'success');
    } else {
      // Adding new resource in Supabase
      const created = await createResource(resourceData);
      setResources((prev) => [created, ...prev]);
      showToast('Resource added to vault', 'success');
    }
    // Refresh categories in background
    fetchCategories().then(setUserCategories).catch(console.warn);
  };

  // Delete single resource with 5-second Undo grace period
  const handleDeleteConfirm = () => {
    if (!deletingId || !user) return;
    const targetId = deletingId;
    const itemToDelete = resources.find((r) => r.id === targetId);
    setDeletingId(null);

    // Optimistically remove from state immediately
    setResources((prev) => prev.filter((r) => r.id !== targetId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });

    const undoKey = `delete-${targetId}-${Date.now()}`;
    const timer = setTimeout(async () => {
      pendingDeletionsRef.current.delete(undoKey);
      try {
        await deleteResource(targetId);
        fetchCategories().then(setUserCategories).catch(console.warn);
      } catch (err) {
        console.warn('Failed to delete on Supabase:', err);
      }
    }, 5000);

    const handleUndo = () => {
      clearTimeout(timer);
      pendingDeletionsRef.current.delete(undoKey);
      if (itemToDelete) {
        setResources((prev) => [itemToDelete, ...prev]);
        showToast('Resource restored', 'success');
      }
    };

    pendingDeletionsRef.current.set(undoKey, { timer, items: itemToDelete ? [itemToDelete] : [] });

    showToast(
      'Resource removed from vault',
      'delete',
      undefined,
      handleUndo,
      5000
    );
  };

  // Bulk action handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredResources.map((r) => r.id)));
  }, [filteredResources]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkRecategorize = useCallback(
    async (category: string) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0 || !user) return;

      const cleanCat = category.trim();
      setResources((prev) =>
        prev.map((r) => (selectedIds.has(r.id) ? { ...r, category: cleanCat } : r))
      );
      showToast(`Moved ${ids.length} resources to "${cleanCat}"`, 'success');
      try {
        await bulkUpdateCategory(ids, cleanCat);
        fetchCategories().then(setUserCategories).catch(console.warn);
      } catch (err) {
        console.warn('Failed to bulk recategorize:', err);
      }
    },
    [selectedIds, user, showToast]
  );

  const handleBulkAddTag = useCallback(
    async (tag: string) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0 || !user) return;

      const cleanTag = tag.trim().toLowerCase();
      setResources((prev) =>
        prev.map((r) => {
          if (!selectedIds.has(r.id)) return r;
          const current = r.tags || [];
          if (current.map((t) => t.toLowerCase()).includes(cleanTag)) return r;
          return { ...r, tags: [...current, cleanTag] };
        })
      );
      showToast(`Added tag #${cleanTag} to ${ids.length} resources`, 'success');
      try {
        await bulkModifyTag(resources, ids, cleanTag, 'add');
      } catch (err) {
        console.warn('Failed to bulk add tag:', err);
      }
    },
    [selectedIds, user, resources, showToast]
  );

  const handleBulkRemoveTag = useCallback(
    async (tag: string) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0 || !user) return;

      const cleanTag = tag.trim().toLowerCase();
      setResources((prev) =>
        prev.map((r) => {
          if (!selectedIds.has(r.id)) return r;
          return {
            ...r,
            tags: (r.tags || []).filter((t) => t.toLowerCase() !== cleanTag),
          };
        })
      );
      showToast(`Removed tag #${cleanTag} from ${ids.length} resources`, 'success');
      try {
        await bulkModifyTag(resources, ids, cleanTag, 'remove');
      } catch (err) {
        console.warn('Failed to bulk remove tag:', err);
      }
    },
    [selectedIds, user, resources, showToast]
  );

  const handleBulkDelete = useCallback(() => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0 || !user) return;

    const itemsToDelete = resources.filter((r) => selectedIds.has(r.id));
    const count = itemsToDelete.length;

    // Optimistically remove from state immediately
    setResources((prev) => prev.filter((r) => !selectedIds.has(r.id)));
    setSelectedIds(new Set());
    setIsSelectMode(false);

    const undoKey = `bulk-delete-${Date.now()}`;
    const timer = setTimeout(async () => {
      pendingDeletionsRef.current.delete(undoKey);
      try {
        await bulkDeleteResources(idsToDelete);
        fetchCategories().then(setUserCategories).catch(console.warn);
      } catch (err) {
        console.warn('Failed to bulk delete on Supabase:', err);
      }
    }, 5000);

    const handleUndo = () => {
      clearTimeout(timer);
      pendingDeletionsRef.current.delete(undoKey);
      setResources((prev) => [...itemsToDelete, ...prev]);
      showToast(`Restored ${count} resource${count !== 1 ? 's' : ''}`, 'success');
    };

    pendingDeletionsRef.current.set(undoKey, { timer, items: itemsToDelete });

    showToast(
      `Deleted ${count} resource${count !== 1 ? 's' : ''}`,
      'delete',
      undefined,
      handleUndo,
      5000
    );
  }, [selectedIds, user, resources, showToast]);

  // Reset keyboard focus when search or filters change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [searchQuery, activeCategory, selectedTags, sortOption]);

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toUpperCase();
      const isInputFocused =
        activeTag === 'INPUT' ||
        activeTag === 'TEXTAREA' ||
        activeTag === 'SELECT' ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      // Esc closes any open modal or exits select mode or resets focus
      if (e.key === 'Escape') {
        if (isShortcutsModalOpen) {
          setIsShortcutsModalOpen(false);
          return;
        }
        if (isAddModalOpen) {
          setIsAddModalOpen(false);
          setEditingResource(null);
          return;
        }
        if (isBulkModalOpen) {
          setIsBulkModalOpen(false);
          return;
        }
        if (isBackupModalOpen) {
          setIsBackupModalOpen(false);
          return;
        }
        if (deletingId) {
          setDeletingId(null);
          return;
        }
        if (isAuthModalOpen) {
          setIsAuthModalOpen(false);
          return;
        }
        if (isSelectMode) {
          setIsSelectMode(false);
          setSelectedIds(new Set());
          return;
        }
        if (focusedIndex !== -1) {
          setFocusedIndex(-1);
          return;
        }
        return;
      }

      // If typing in an input, don't trigger global single-key shortcuts
      if (isInputFocused) {
        if (e.key === 'ArrowDown' && filteredResources.length > 0) {
          (document.activeElement as HTMLElement)?.blur();
          setFocusedIndex(0);
          e.preventDefault();
        }
        return;
      }

      // If any modal is open, avoid background keyboard shortcuts
      const hasAnyModalOpen =
        isAddModalOpen ||
        isBulkModalOpen ||
        isBackupModalOpen ||
        Boolean(deletingId) ||
        isAuthModalOpen ||
        isShortcutsModalOpen;

      if (hasAnyModalOpen) return;

      // '?' opens keyboard shortcuts modal
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // 'n' or 'a' opens Add Resource modal
      if (e.key === 'n' || e.key === 'a') {
        e.preventDefault();
        if (!user) {
          setAuthModalMode('signup');
          setIsAuthModalOpen(true);
        } else {
          setEditingResource(null);
          setIsAddModalOpen(true);
        }
        return;
      }

      // 's' toggles select mode
      if (e.key === 's') {
        e.preventDefault();
        setIsSelectMode((prev) => {
          if (prev) setSelectedIds(new Set());
          return !prev;
        });
        return;
      }

      // 'g' toggles grid / list view
      if (e.key === 'g') {
        e.preventDefault();
        setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'));
        return;
      }

      // Arrow navigation across filtered search results
      if (filteredResources.length > 0) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev < 0 ? 0 : Math.min(prev + 1, filteredResources.length - 1);
            const target = filteredResources[next];
            if (target) {
              const el = document.getElementById(`resource-card-${target.id}`);
              el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
            return next;
          });
          return;
        }

        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev <= 0 ? 0 : prev - 1;
            const target = filteredResources[next];
            if (target) {
              const el = document.getElementById(`resource-card-${target.id}`);
              el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
            return next;
          });
          return;
        }

        // Enter opens focused resource in new tab and tracks click
        if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredResources.length) {
          e.preventDefault();
          const target = filteredResources[focusedIndex];
          if (target) {
            window.open(target.url, '_blank', 'noopener,noreferrer');
            handleResourceClick(target.id);
          }
          return;
        }

        // 'x' toggles selection of currently focused card
        if (e.key === 'x' && focusedIndex >= 0 && focusedIndex < filteredResources.length) {
          e.preventDefault();
          const target = filteredResources[focusedIndex];
          if (target) {
            if (!isSelectMode) setIsSelectMode(true);
            handleToggleSelect(target.id);
          }
          return;
        }

        // 'c' copies link of focused resource
        if (e.key === 'c' && focusedIndex >= 0 && focusedIndex < filteredResources.length) {
          e.preventDefault();
          const target = filteredResources[focusedIndex];
          if (target) {
            navigator.clipboard.writeText(target.url);
            showToast('Link copied to clipboard', 'copy');
          }
          return;
        }

        // 'p' pins/unpins focused resource
        if (e.key === 'p' && focusedIndex >= 0 && focusedIndex < filteredResources.length) {
          e.preventDefault();
          const target = filteredResources[focusedIndex];
          if (target) {
            handleTogglePin(target.id, !target.isPinned);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isShortcutsModalOpen,
    isAddModalOpen,
    isBulkModalOpen,
    isBackupModalOpen,
    deletingId,
    isAuthModalOpen,
    isSelectMode,
    focusedIndex,
    filteredResources,
    user,
    handleResourceClick,
    handleTogglePin,
    handleToggleSelect,
    showToast,
  ]);

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
      showToast(`Imported ${saved.length} resources successfully`, 'success');
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
      showToast(`Restored ${saved.length} resources from backup`, 'success');
      fetchCategories().then(setUserCategories).catch(console.warn);
    } catch (err) {
      console.error('Failed to import backup file to Supabase:', err);
    }
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
      showToast('Saved news article to vault', 'success');
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
        onOpenShortcutsModal={() => {
          setIsShortcutsModalOpen(true);
        }}
        isSelectMode={isSelectMode}
        onToggleSelectMode={() => {
          setIsSelectMode((prev) => {
            if (prev) setSelectedIds(new Set());
            return !prev;
          });
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
        ) : activeTab === 'schedule' ? (
          <ScheduleTab
            isAuthenticated={Boolean(user)}
            onRequireAuth={() => {
              setAuthModalMode('login');
              setIsAuthModalOpen(true);
            }}
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

        {/* Category Folders Overview */}
        {user && (
          <CategoryOverview
            categories={categoriesStat}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            totalCount={resources.length}
          />
        )}

        {/* Stats & Sorting Bar with Category Dropdown and Tag Multi-Select */}
        {user && (
          <StatsBar
            totalResources={resources.length}
            filteredResourcesCount={filteredResources.length}
            categories={categoriesStat}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            allTags={existingTags}
            selectedTags={selectedTags}
            onToggleTag={handleToggleTag}
            onClearTags={handleClearTags}
            tagFilterMode={tagFilterMode}
            setTagFilterMode={setTagFilterMode}
            sortOption={sortOption}
            setSortOption={setSortOption}
          />
        )}

        {/* Recently Added / Recently Opened Quick-Access Shelf */}
        {user && resources.length > 0 && !searchQuery && !activeCategory && selectedTags.length === 0 && (
          <RecentShelf
            resources={resources}
            onResourceClick={handleResourceClick}
            onCopySuccess={() => showToast('Link copied to clipboard', 'copy')}
            onCategoryClick={(cat: string) => setActiveCategory(cat)}
          />
        )}

        {/* Search / Filter Active Indicator */}
        {user && (searchQuery || activeCategory || selectedTags.length > 0) && (
          <div className="mb-4 flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-xl text-xs flex-wrap gap-2">
            <div className="flex items-center gap-2 text-indigo-300 font-medium flex-wrap">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                Showing {filteredResources.length} matching result{filteredResources.length !== 1 ? 's' : ''}
                {activeCategory && (
                  <span>
                    {' '}in folder <strong className="text-white">&quot;{activeCategory}&quot;</strong>
                  </span>
                )}
                {selectedTags.length > 0 && (
                  <span>
                    {' '}matching tags ({tagFilterMode}):{' '}
                    <strong className="text-white">
                      {selectedTags.map((t) => `#${t}`).join(', ')}
                    </strong>
                  </span>
                )}
                {searchQuery && (
                  <span>
                    {' '}for search <strong className="text-white">&quot;{searchQuery}&quot;</strong>
                  </span>
                )}
              </span>
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory(null);
                setSelectedTags([]);
              }}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-200 underline transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Main Content Area */}
        {authLoading || (user && loading) ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Loading cloud vault resources...</span>
            </div>
            <ResourceSkeleton viewMode={viewMode} count={6} />
          </div>
        ) : user && filteredResources.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResources.map((resource, index) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onEdit={(res) => {
                    setEditingResource(res);
                    setIsAddModalOpen(true);
                  }}
                  onDelete={(id) => setDeletingId(id)}
                  onTogglePin={handleTogglePin}
                  onResourceClick={handleResourceClick}
                  onCopySuccess={() => showToast('Link copied to clipboard', 'copy')}
                  onTagClick={(tag) => handleToggleTag(tag)}
                  onCategoryClick={(cat) => setActiveCategory(cat)}
                  isSelectMode={isSelectMode}
                  isSelected={selectedIds.has(resource.id)}
                  onToggleSelect={handleToggleSelect}
                  isFocused={focusedIndex === index}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredResources.map((resource, index) => (
                <ResourceListRow
                  key={resource.id}
                  resource={resource}
                  onEdit={(res) => {
                    setEditingResource(res);
                    setIsAddModalOpen(true);
                  }}
                  onDelete={(id) => setDeletingId(id)}
                  onTogglePin={handleTogglePin}
                  onResourceClick={handleResourceClick}
                  onCopySuccess={() => showToast('Link copied to clipboard', 'copy')}
                  onTagClick={(tag) => handleToggleTag(tag)}
                  onCategoryClick={(cat) => setActiveCategory(cat)}
                  isSelectMode={isSelectMode}
                  isSelected={selectedIds.has(resource.id)}
                  onToggleSelect={handleToggleSelect}
                  isFocused={focusedIndex === index}
                />
              ))}
            </div>
          )
        ) : user ? (
          /* Empty Vault State */
          <div className="py-16 px-6 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl max-w-lg mx-auto my-8 animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 text-indigo-400 shadow-inner">
              {searchQuery || activeCategory || selectedTags.length > 0 ? (
                <Search className="w-6 h-6" />
              ) : (
                <Bookmark className="w-6 h-6" />
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-zinc-100 mb-1.5">
              {searchQuery || activeCategory || selectedTags.length > 0
                ? 'No matching resources found'
                : 'Your Vault is empty'}
            </h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed max-w-sm mx-auto">
              {searchQuery || activeCategory || selectedTags.length > 0
                ? `No resources match your active search or filters${
                    activeCategory ? ` in category "${activeCategory}"` : ''
                  }${searchQuery ? ` for "${searchQuery}"` : ''}${
                    selectedTags.length > 0 ? ` with tags #${selectedTags.join(', #')}` : ''
                  }. Try adjusting or clearing your filters.`
                : 'Your Supabase cloud vault is ready! Add your first link or bulk import links from text.'}
            </p>
            {searchQuery || activeCategory || selectedTags.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory(null);
                  setSelectedTags([]);
                }}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer shadow-sm hover:shadow"
              >
                Clear Search &amp; Filters
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingResource(null);
                    setIsAddModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  + Add Your First Link
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(true)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer"
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
        existingResources={resources}
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

      {/* Floating Bulk Actions Toolbar */}
      {isSelectMode && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          totalFilteredCount={filteredResources.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onBulkDelete={handleBulkDelete}
          onBulkRecategorize={handleBulkRecategorize}
          onBulkAddTag={handleBulkAddTag}
          onBulkRemoveTag={handleBulkRemoveTag}
          onCloseSelectMode={() => {
            setIsSelectMode(false);
            setSelectedIds(new Set());
          }}
          existingCategories={existingCategories}
          existingTags={existingTags}
        />
      )}

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Action Feedback Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
