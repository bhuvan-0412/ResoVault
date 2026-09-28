'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  LayoutGrid,
  List,
  Search,
  Plus,
  Zap,
  Clapperboard,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  X,
  FileText,
  Video,
  Flame,
} from 'lucide-react';
import { ScriptItem, ScriptStatus } from '@/lib/types';
import {
  fetchScripts,
  createScript,
  updateScript,
  updateScriptStatus,
  deleteScript,
  bulkCreateScripts,
} from '@/lib/scripts-storage';
import {
  formatScriptMetrics,
  SCRIPT_STATUS_CONFIG,
  SCRIPT_STATUS_ORDER,
} from '@/lib/scripts-utils';
import { ScriptCard } from './ScriptCard';
import { AddEditScriptModal } from './AddEditScriptModal';
import { BulkImportScriptsModal } from './BulkImportScriptsModal';
import { ShootDayModal } from './ShootDayModal';

interface ScriptsTabProps {
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  searchQuery?: string;
  showToast: (
    message: string,
    type?: 'success' | 'delete' | 'pin' | 'copy' | 'info',
    subtext?: string,
    undoAction?: () => void,
    durationMs?: number
  ) => void;
}

export const ScriptsTab: React.FC<ScriptsTabProps> = ({
  isAuthenticated,
  onRequireAuth,
  searchQuery: externalSearchQuery = '',
  showToast,
}) => {
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState('');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [listStatusFilter, setListStatusFilter] = useState<ScriptStatus | 'all'>('all');

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<ScriptItem | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isShootDayOpen, setIsShootDayOpen] = useState(false);

  // Undo deletions tracking ref: id -> timeout
  const pendingDeletionsRef = useRef<Map<string, { timer: NodeJS.Timeout; script: ScriptItem }>>(new Map());

  // Load scripts on mount / auth change
  const loadScripts = useCallback(async () => {
    if (!isAuthenticated) {
      setScripts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchScripts();
      setScripts(data);
    } catch (err) {
      console.warn('Failed to load scripts:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  // Combine navbar search query with local search query
  const effectiveSearch = (externalSearchQuery || localSearch).trim().toLowerCase();

  // Filter scripts based on search query (title, body, tags, correctionsNote)
  const filteredScripts = useMemo(() => {
    if (!effectiveSearch) return scripts;
    return scripts.filter((s) => {
      const titleMatch = s.title.toLowerCase().includes(effectiveSearch);
      const bodyMatch = s.body.toLowerCase().includes(effectiveSearch);
      const noteMatch = (s.correctionsNote || '').toLowerCase().includes(effectiveSearch);
      const tagMatch = s.tags.some((t) => t.toLowerCase().includes(effectiveSearch));
      return titleMatch || bodyMatch || noteMatch || tagMatch;
    });
  }, [scripts, effectiveSearch]);

  // Group scripts by status for Board View
  const columnGroups = useMemo(() => {
    const groups: Record<ScriptStatus, ScriptItem[]> = {
      needs_corrections: [],
      ready_to_shoot: [],
      shot: [],
      posted: [],
    };

    for (const script of filteredScripts) {
      if (groups[script.status]) {
        groups[script.status].push(script);
      }
    }
    return groups;
  }, [filteredScripts]);

  // Handlers
  const handleSaveScript = async (
    scriptData: Omit<ScriptItem, 'id' | 'createdAt' | 'updatedAt' | 'shotAt' | 'postedAt'> | ScriptItem
  ) => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }

    if ('id' in scriptData && scriptData.id) {
      // Update
      const updated = await updateScript(scriptData as any);
      setScripts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      showToast('Script updated successfully', 'success', updated.title);
    } else {
      // Create
      const created = await createScript(scriptData);
      setScripts((prev) => [created, ...prev]);
      showToast('Script added to board', 'success', created.title);
    }
  };

  const handleBulkImport = async (
    items: Omit<ScriptItem, 'id' | 'createdAt' | 'updatedAt' | 'shotAt' | 'postedAt'>[]
  ) => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }

    try {
      const createdList = await bulkCreateScripts(items);
      setScripts((prev) => [...createdList, ...prev]);
      showToast(`Imported ${createdList.length} scripts to board`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to bulk import scripts', 'info');
    }
  };

  const handleStatusChange = async (id: string, newStatus: ScriptStatus) => {
    const targetScript = scripts.find((s) => s.id === id);
    if (!targetScript) return;

    // Optimistic UI update
    setScripts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );

    try {
      const updated = await updateScriptStatus(id, newStatus, targetScript);
      setScripts((prev) => prev.map((s) => (s.id === id ? updated : s)));
      showToast(
        `Moved to ${SCRIPT_STATUS_CONFIG[newStatus].label}`,
        'success',
        targetScript.title
      );
    } catch (err) {
      console.error('Failed to update status on server:', err);
      // Revert optimistic update
      setScripts((prev) =>
        prev.map((s) => (s.id === id ? targetScript : s))
      );
    }
  };

  const handleAdvanceStatus = (id: string, currentStatus: ScriptStatus) => {
    const nextStatus = SCRIPT_STATUS_CONFIG[currentStatus].nextStatus;
    if (nextStatus) {
      handleStatusChange(id, nextStatus);
    }
  };

  // Delete single script with 5-second Undo grace period (matching resources pattern)
  const handleDeleteScript = (id: string) => {
    const itemToDelete = scripts.find((s) => s.id === id);
    if (!itemToDelete) return;

    // Optimistically remove from state immediately
    setScripts((prev) => prev.filter((s) => s.id !== id));

    const undoKey = `script-delete-${id}-${Date.now()}`;
    const timer = setTimeout(async () => {
      pendingDeletionsRef.current.delete(undoKey);
      try {
        await deleteScript(id);
      } catch (err) {
        console.warn('Failed to delete script on Supabase:', err);
      }
    }, 5000);

    pendingDeletionsRef.current.set(undoKey, { timer, script: itemToDelete });

    const handleUndo = () => {
      clearTimeout(timer);
      pendingDeletionsRef.current.delete(undoKey);
      setScripts((prev) => [itemToDelete, ...prev]);
      showToast('Script restored', 'info', itemToDelete.title);
    };

    showToast(
      'Script deleted',
      'delete',
      itemToDelete.title,
      handleUndo,
      5000
    );
  };

  const readyToShootCount = scripts.filter((s) => s.status === 'ready_to_shoot').length;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl shadow-sm">
        {/* Left: View Mode Toggle & Search (if not searching from global navbar) */}
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          {/* View Toggle */}
          <div className="flex items-center bg-zinc-950 rounded-xl p-1 border border-zinc-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'board'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* Quick Script Search */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Filter scripts, body, tags, notes..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-950 text-zinc-100 placeholder-zinc-500 rounded-xl border border-zinc-800 focus:outline-none focus:border-indigo-500 transition-all"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Main Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Start Shoot Day (Highlighted) */}
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                onRequireAuth();
                return;
              }
              setIsShootDayOpen(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer ring-1 ring-white/20"
            title="Start Full-Screen Teleprompter & Shoot Day Mode"
          >
            <Clapperboard className="w-4 h-4 stroke-[2.5]" />
            <span>Start Shoot Day</span>
            {readyToShootCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 text-emerald-200 font-mono">
                {readyToShootCount}
              </span>
            )}
          </button>

          {/* Bulk Import from Notepad */}
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                onRequireAuth();
                return;
              }
              setIsBulkImportOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all cursor-pointer"
            title="Bulk Import Raw Scripts from Notepad"
          >
            <Zap className="w-3.5 h-3.5 fill-indigo-400 text-indigo-400" />
            <span className="hidden md:inline">Import Scripts</span>
            <span className="md:hidden">Import</span>
          </button>

          {/* Add Script Modal */}
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                onRequireAuth();
                return;
              }
              setEditingScript(null);
              setIsAddEditModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Script</span>
          </button>
        </div>
      </div>

      {/* Unauthenticated Banner */}
      {!isAuthenticated && (
        <div className="p-8 text-center bg-zinc-900/60 border border-zinc-800 rounded-3xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100">
              Video Scripts Production Organizer
            </h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
              Sign in with your Google account to write, batch import from Notepad, track corrections, and shoot video scripts distraction-free.
            </p>
          </div>
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-5 py-2.5 rounded-xl bg-white text-zinc-900 text-xs font-bold shadow-md hover:bg-zinc-100 transition-all cursor-pointer"
          >
            Sign In with Google
          </button>
        </div>
      )}

      {/* Authenticated Content */}
      {isAuthenticated && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-xs text-zinc-400">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Loading video scripts from cloud vault...</span>
            </div>
          ) : scripts.length === 0 ? (
            /* Empty State */
            <div className="py-16 px-6 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-3xl max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-inner">
                <Clapperboard className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-100 mb-1">
                No Video Scripts Yet
              </h3>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed max-w-sm mx-auto">
                Organize short-form reels, tutorials, and long-form video scripts. Import a raw Notepad dump or create your first script now.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkImportOpen(true)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 inline mr-1.5 fill-white" />
                  Import Scripts from Notepad
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingScript(null);
                    setIsAddEditModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer"
                >
                  + Add Single Script
                </button>
              </div>
            </div>
          ) : viewMode === 'board' ? (
            /* BOARD VIEW: 4 Columns */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
              {SCRIPT_STATUS_ORDER.map((status) => {
                const config = SCRIPT_STATUS_CONFIG[status];
                const columnScripts = columnGroups[status];

                return (
                  <div
                    key={status}
                    className={`rounded-2xl border ${config.columnBorder} ${config.columnBg} p-3.5 flex flex-col min-h-[500px] transition-all`}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/80">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          status === 'needs_corrections'
                            ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                            : status === 'ready_to_shoot'
                            ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                            : status === 'shot'
                            ? 'bg-indigo-400 shadow-sm shadow-indigo-400/50'
                            : 'bg-violet-400 shadow-sm shadow-violet-400/50'
                        }`} />
                        <h3 className="text-xs font-extrabold text-zinc-100 tracking-tight">
                          {config.label}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-300">
                        {columnScripts.length}
                      </span>
                    </div>

                    {/* Column Script Cards */}
                    <div className="space-y-3 flex-1">
                      {columnScripts.length === 0 ? (
                        <div className="py-8 text-center text-[11px] text-zinc-500 border border-dashed border-zinc-800/80 rounded-xl">
                          No scripts in this stage
                        </div>
                      ) : (
                        columnScripts.map((script) => (
                          <ScriptCard
                            key={script.id}
                            script={script}
                            onEdit={(s) => {
                              setEditingScript(s);
                              setIsAddEditModalOpen(true);
                            }}
                            onDelete={handleDeleteScript}
                            onStatusChange={handleStatusChange}
                            onAdvanceStatus={handleAdvanceStatus}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW with Status Filter */
            <div className="space-y-4">
              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setListStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                    listStatusFilter === 'all'
                      ? 'bg-zinc-800 text-white border-zinc-700 shadow-sm'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800/80 hover:text-zinc-200'
                  }`}
                >
                  All ({filteredScripts.length})
                </button>
                {SCRIPT_STATUS_ORDER.map((st) => {
                  const conf = SCRIPT_STATUS_CONFIG[st];
                  const count = scripts.filter((s) => s.status === st).length;
                  const isSelected = listStatusFilter === st;

                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setListStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                        isSelected
                          ? `${conf.badgeBg} ${conf.badgeText} ${conf.badgeBorder} shadow-sm font-bold`
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800/80 hover:text-zinc-200'
                      }`}
                    >
                      {conf.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* List Rows */}
              <div className="space-y-2.5">
                {filteredScripts
                  .filter((s) => (listStatusFilter === 'all' ? true : s.status === listStatusFilter))
                  .map((script) => {
                    const { words, speakingTime } = formatScriptMetrics(script.body);
                    const conf = SCRIPT_STATUS_CONFIG[script.status];

                    return (
                      <div
                        key={script.id}
                        onClick={() => {
                          setEditingScript(script);
                          setIsAddEditModalOpen(true);
                        }}
                        className="p-4 rounded-2xl bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group shadow-sm"
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${conf.badgeBg} ${conf.badgeText} ${conf.badgeBorder}`}
                            >
                              {conf.label}
                            </span>
                            <h4 className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors truncate">
                              {script.title}
                            </h4>
                          </div>

                          <p className="text-xs text-zinc-400 line-clamp-1 font-mono">
                            {script.body.slice(0, 140)}...
                          </p>

                          {script.status === 'needs_corrections' && script.correctionsNote && (
                            <p className="text-[11px] text-amber-400/90 font-medium">
                              <strong>Fix:</strong> {script.correctionsNote}
                            </p>
                          )}
                        </div>

                        <div
                          className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-zinc-800/60"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs text-zinc-400 font-mono">
                            {words} words · {speakingTime}
                          </span>

                          <div className="flex items-center gap-2">
                            <select
                              value={script.status}
                              onChange={(e) =>
                                handleStatusChange(script.id, e.target.value as ScriptStatus)
                              }
                              className="text-xs font-semibold px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none cursor-pointer"
                            >
                              {SCRIPT_STATUS_ORDER.map((st) => (
                                <option key={st} value={st}>
                                  {SCRIPT_STATUS_CONFIG[st].label}
                                </option>
                              ))}
                            </select>

                            {conf.nextStatus && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceStatus(script.id, script.status)}
                                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                              >
                                {conf.nextActionLabel}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteScript(script.id)}
                              className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete Script"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add / Edit Script Modal */}
      <AddEditScriptModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setEditingScript(null);
        }}
        onSave={handleSaveScript}
        editingScript={editingScript}
      />

      {/* Bulk Import Scripts from Notepad Modal */}
      <BulkImportScriptsModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImportSuccess={handleBulkImport}
      />

      {/* Shoot Day Teleprompter Modal */}
      <ShootDayModal
        isOpen={isShootDayOpen}
        onClose={() => setIsShootDayOpen(false)}
        availableScripts={scripts}
        onMarkAsShot={async (scriptId) => {
          await handleStatusChange(scriptId, 'shot');
        }}
      />
    </div>
  );
};
