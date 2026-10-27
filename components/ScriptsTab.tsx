'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  type SortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  LayoutGrid,
  List,
  Search,
  Plus,
  Zap,
  Clapperboard,
  RefreshCw,
  X,
  Video,
  BookOpen,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { NewScriptInput, ScriptItem, ScriptStatus } from '@/lib/types';
import {
  fetchScripts,
  createScript,
  updateScript,
  updateScriptPlacement,
  deleteScript,
  bulkCreateScripts,
} from '@/lib/scripts-storage';
import {
  customOrder,
  DEFAULT_SORTS,
  formatScriptMetrics,
  isScriptSortKey,
  LANDS_AT_BOTTOM,
  normalizePositions,
  planMove,
  POSITION_STEP,
  scriptDateLabel,
  SCRIPT_STATUS_CONFIG,
  SCRIPT_STATUS_ORDER,
  SORT_LABELS,
  sortOptionsFor,
  sortScripts,
  toDateInputValue,
  type PositionMove,
  type ScriptSortKey,
} from '@/lib/scripts-utils';
import { ScriptCard, ScriptActionsMenu, type MoveAction } from './ScriptCard';
import { AddEditScriptModal } from './AddEditScriptModal';
import { BulkImportScriptsModal } from './BulkImportScriptsModal';
import { ShootDayModal } from './ShootDayModal';
import { FitToScreenModal } from './FitToScreenModal';

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

// ---------------------------------------------------------------------------
// Persisted view preferences (per-column sort + filters)
// ---------------------------------------------------------------------------

const VIEW_PREFS_KEY = 'resovault.scripts.view.v1';

interface ViewPrefs {
  sorts: Record<ScriptStatus, ScriptSortKey>;
  tags: string[];
  dateFrom: string;
  dateTo: string;
}

function readViewPrefs(): ViewPrefs {
  const prefs: ViewPrefs = { sorts: { ...DEFAULT_SORTS }, tags: [], dateFrom: '', dateTo: '' };
  if (typeof window === 'undefined') return prefs;
  try {
    const raw = window.localStorage.getItem(VIEW_PREFS_KEY);
    if (!raw) return prefs;
    const saved = JSON.parse(raw) as Partial<ViewPrefs>;
    for (const st of SCRIPT_STATUS_ORDER) {
      const key = saved.sorts?.[st];
      if (isScriptSortKey(key) && sortOptionsFor(st).includes(key)) prefs.sorts[st] = key;
    }
    if (Array.isArray(saved.tags)) prefs.tags = saved.tags.filter((t) => typeof t === 'string');
    if (typeof saved.dateFrom === 'string') prefs.dateFrom = saved.dateFrom;
    if (typeof saved.dateTo === 'string') prefs.dateTo = saved.dateTo;
  } catch {
    /* storage unavailable or corrupt: fall back to defaults */
  }
  return prefs;
}

const NO_SCRIPTS: ScriptItem[] = [];

const COLUMN_PREFIX = 'col:';
const isColumnId = (id: string | number) => String(id).startsWith(COLUMN_PREFIX);
const toColumnId = (status: ScriptStatus) => `${COLUMN_PREFIX}${status}`;
const fromColumnId = (id: string | number) => String(id).slice(COLUMN_PREFIX.length) as ScriptStatus;

/** Reordering is by drop position only, so non-custom columns must not shift cards while dragging. */
const noShiftStrategy: SortingStrategy = () => null;

const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : closestCorners(args);
};

const errorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Unknown error';
};

// ---------------------------------------------------------------------------
// Board pieces
// ---------------------------------------------------------------------------

interface CardHandlers {
  onEdit: (script: ScriptItem) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: ScriptStatus) => void;
  onAdvanceStatus: (id: string, status: ScriptStatus) => void;
  onMoveInColumn: (id: string, action: MoveAction) => void;
  onMoveToColumn: (id: string, status: ScriptStatus) => void;
  onRead: (script: ScriptItem) => void;
}

interface SortableScriptCardProps extends CardHandlers {
  script: ScriptItem;
  postedNumber?: number;
  canReorder: boolean;
  isFirst: boolean;
  isLast: boolean;
  onHover: (id: string | null) => void;
}

const SortableScriptCard: React.FC<SortableScriptCardProps> = ({ onHover, ...props }) => {
  const { script } = props;
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: script.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
      className="select-none [-webkit-touch-callout:none]"
      onMouseEnter={() => onHover(script.id)}
      onMouseLeave={() => onHover(null)}
      {...listeners}
    >
      <ScriptCard
        script={script}
        postedNumber={props.postedNumber}
        canReorder={props.canReorder}
        isFirst={props.isFirst}
        isLast={props.isLast}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
        onStatusChange={props.onStatusChange}
        onAdvanceStatus={props.onAdvanceStatus}
        onMoveInColumn={props.onMoveInColumn}
        onMoveToColumn={props.onMoveToColumn}
        onReadFullScreen={props.onRead}
      />
    </div>
  );
};

interface SortSelectProps {
  status: ScriptStatus;
  value: ScriptSortKey;
  onChange: (key: ScriptSortKey) => void;
}

const SortSelect: React.FC<SortSelectProps> = ({ status, value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as ScriptSortKey)}
    aria-label={`Sort ${SCRIPT_STATUS_CONFIG[status].label}`}
    className="max-w-[9.5rem] truncate text-[11px] font-semibold pl-2 pr-1 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
  >
    {sortOptionsFor(status).map((key) => (
      <option key={key} value={key}>
        {SORT_LABELS[key]}
      </option>
    ))}
  </select>
);

interface BoardColumnProps {
  status: ScriptStatus;
  scripts: ScriptItem[];
  sort: ScriptSortKey;
  onSortChange: (key: ScriptSortKey) => void;
  isDropTarget: boolean;
  postedNumbers: Map<string, number>;
  handlers: CardHandlers;
  onHover: (id: string | null) => void;
}

const BoardColumn: React.FC<BoardColumnProps> = ({
  status,
  scripts,
  sort,
  onSortChange,
  isDropTarget,
  postedNumbers,
  handlers,
  onHover,
}) => {
  const config = SCRIPT_STATUS_CONFIG[status];
  const { setNodeRef } = useDroppable({ id: toColumnId(status) });
  const canReorder = sort === 'custom';

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border ${config.columnBorder} ${config.columnBg} p-3 sm:p-3.5 flex flex-col min-h-[260px] md:min-h-[500px] min-w-0 transition-shadow ${
        isDropTarget ? 'ring-2 ring-indigo-400/60' : ''
      }`}
    >
      <div className="pb-3 mb-3 border-b border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${config.dotClass}`} />
            <h3 className="text-xs font-extrabold text-zinc-100 tracking-tight truncate">{config.label}</h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-300">
              {scripts.length}
            </span>
          </div>
          <SortSelect status={status} value={sort} onChange={onSortChange} />
        </div>
        <p className="text-[11px] text-zinc-500">{config.helper}</p>
      </div>

      <SortableContext
        items={scripts.map((s) => s.id)}
        strategy={canReorder ? verticalListSortingStrategy : noShiftStrategy}
      >
        <div className="space-y-3 flex-1">
          {scripts.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-zinc-500 border border-dashed border-zinc-800/80 rounded-xl">
              No scripts in this stage
            </div>
          ) : (
            scripts.map((script, i) => (
              <SortableScriptCard
                key={script.id}
                script={script}
                postedNumber={postedNumbers.get(script.id)}
                canReorder={canReorder}
                isFirst={i === 0}
                isLast={i === scripts.length - 1}
                onHover={onHover}
                {...handlers}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Date quick-picks
// ---------------------------------------------------------------------------

function quickRange(kind: 'week' | 'month'): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now);
  if (kind === 'week') {
    const daysSinceMonday = (now.getDay() + 6) % 7;
    start.setDate(now.getDate() - daysSinceMonday);
  } else {
    start.setDate(1);
  }
  return { from: toDateInputValue(start.toISOString()), to: toDateInputValue(now.toISOString()) };
}

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

export const ScriptsTab: React.FC<ScriptsTabProps> = ({
  isAuthenticated,
  onRequireAuth,
  searchQuery: externalSearchQuery = '',
  showToast,
}) => {
  const [loadedScripts, setScripts] = useState<ScriptItem[]>(NO_SCRIPTS);
  const scripts = isAuthenticated ? loadedScripts : NO_SCRIPTS;
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState('');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [listStatusFilter, setListStatusFilter] = useState<ScriptStatus | 'all'>('all');

  // Sorting & filters (persisted). The board only renders after scripts load on the
  // client, so reading localStorage in the initializer cannot cause a hydration mismatch.
  const [initialPrefs] = useState(readViewPrefs);
  const [sorts, setSorts] = useState<Record<ScriptStatus, ScriptSortKey>>(initialPrefs.sorts);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialPrefs.tags);
  const [dateFrom, setDateFrom] = useState(initialPrefs.dateFrom);
  const [dateTo, setDateTo] = useState(initialPrefs.dateTo);

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<ScriptStatus | null>(null);

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<ScriptItem | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isShootDayOpen, setIsShootDayOpen] = useState(false);
  const [readScript, setReadScript] = useState<ScriptItem | null>(null);

  const hoveredIdRef = useRef<string | null>(null);

  // Undo deletions tracking ref: id -> timeout
  const pendingDeletionsRef = useRef<Map<string, { timer: NodeJS.Timeout; script: ScriptItem }>>(new Map());

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long-press on phones so normal scrolling still works
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  // Load scripts on mount / auth change
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetchScripts()
      .then((data) => {
        if (!cancelled) setScripts(normalizePositions(data));
      })
      .catch((err) => console.warn('Failed to load scripts:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    try {
      const prefs: ViewPrefs = { sorts, tags: selectedTags, dateFrom, dateTo };
      window.localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable */
    }
  }, [sorts, selectedTags, dateFrom, dateTo]);

  // ---- Filtering & ordering ---------------------------------------------------

  const effectiveSearch = (externalSearchQuery || localSearch).trim().toLowerCase();

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of scripts) for (const t of s.tags) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [scripts]);

  const filteredScripts = useMemo(() => {
    return scripts.filter((s) => {
      if (effectiveSearch) {
        const hit =
          s.title.toLowerCase().includes(effectiveSearch) ||
          s.body.toLowerCase().includes(effectiveSearch) ||
          (s.correctionsNote || '').toLowerCase().includes(effectiveSearch) ||
          s.tags.some((t) => t.toLowerCase().includes(effectiveSearch));
        if (!hit) return false;
      }
      if (selectedTags.length > 0 && !s.tags.some((t) => selectedTags.includes(t))) return false;
      if (dateFrom || dateTo) {
        const created = toDateInputValue(s.createdAt);
        if (dateFrom && created < dateFrom) return false;
        if (dateTo && created > dateTo) return false;
      }
      return true;
    });
  }, [scripts, effectiveSearch, selectedTags, dateFrom, dateTo]);

  const columns = useMemo(() => {
    const out = {} as Record<ScriptStatus, ScriptItem[]>;
    for (const st of SCRIPT_STATUS_ORDER) {
      out[st] = sortScripts(
        filteredScripts.filter((s) => s.status === st),
        sorts[st]
      );
    }
    return out;
  }, [filteredScripts, sorts]);

  // Posted numbering follows the Posted column's custom order, regardless of filters/sort
  const postedNumbers = useMemo(
    () => new Map(customOrder(scripts, 'posted').map((s, i) => [s.id, i + 1])),
    [scripts]
  );

  const filtersActive = selectedTags.length > 0 || Boolean(dateFrom) || Boolean(dateTo);
  const activeScript = activeId ? scripts.find((s) => s.id === activeId) || null : null;

  const setSortFor = (status: ScriptStatus, key: ScriptSortKey) =>
    setSorts((prev) => ({ ...prev, [status]: key }));

  const clearFilters = () => {
    setSelectedTags([]);
    setDateFrom('');
    setDateTo('');
    setLocalSearch('');
  };

  // ---- Optimistic position / status writes --------------------------------------

  /**
   * Applies moves instantly, saves them in the background and reverts + toasts if any
   * save fails. Resolves to whether everything was saved.
   */
  const applyMoves = useCallback(
    async (moves: PositionMove[]): Promise<boolean> => {
      if (moves.length === 0) return true;
      const byId = new Map(moves.map((m) => [m.id, m]));
      const before = new Map(scripts.filter((s) => byId.has(s.id)).map((s) => [s.id, s]));
      const nowIso = new Date().toISOString();

      setScripts((prev) =>
        prev.map((s) => {
          const m = byId.get(s.id);
          if (!m) return s;
          const status = m.status ?? s.status;
          const entering = status !== s.status;
          return {
            ...s,
            status,
            position: m.position,
            ...(entering ? { updatedAt: nowIso } : {}),
            ...(entering && status === 'shot' && !s.shotAt ? { shotAt: nowIso } : {}),
            ...(entering && status === 'posted'
              ? { postedAt: s.postedAt || nowIso, shotAt: s.shotAt || nowIso }
              : {}),
          };
        })
      );

      try {
        const results = await Promise.all(
          moves.map(async (m) => ({
            id: m.id,
            saved: await updateScriptPlacement(m.id, { position: m.position, status: m.status }),
          }))
        );
        const savedById = new Map(results.map((r) => [r.id, r.saved]));
        setScripts((prev) =>
          prev.map((s) => {
            const saved = savedById.get(s.id);
            return saved ? { ...s, ...saved } : s;
          })
        );
        return true;
      } catch (err) {
        console.error('Failed to save script order:', err);
        setScripts((prev) => prev.map((s) => before.get(s.id) ?? s));
        showToast('Could not save — change reverted', 'delete', errorMessage(err));
        return false;
      }
    },
    [scripts, showToast]
  );

  /** Moves a card to another column: top of it (bottom for Posted, so numbering stays chronological). */
  const moveToColumn = useCallback(
    async (id: string, newStatus: ScriptStatus): Promise<boolean> => {
      const mover = scripts.find((s) => s.id === id);
      if (!mover || mover.status === newStatus) return true;
      const rest = customOrder(scripts, newStatus);
      const index = LANDS_AT_BOTTOM[newStatus] ? rest.length : 0;
      const ok = await applyMoves(planMove(rest, id, index, newStatus));
      if (ok) showToast(`Moved to ${SCRIPT_STATUS_CONFIG[newStatus].label}`, 'success', mover.title);
      return ok;
    },
    [scripts, applyMoves, showToast]
  );

  const handleStatusChange = async (id: string, newStatus: ScriptStatus) => {
    await moveToColumn(id, newStatus);
  };

  const handleAdvanceStatus = (id: string, currentStatus: ScriptStatus) => {
    const nextStatus = SCRIPT_STATUS_CONFIG[currentStatus].nextStatus;
    if (nextStatus) {
      void moveToColumn(id, nextStatus);
    }
  };

  const moveInColumn = (id: string, action: MoveAction) => {
    const mover = scripts.find((s) => s.id === id);
    if (!mover) return;
    const rest = customOrder(scripts, mover.status).filter((s) => s.id !== id);
    const visible = columns[mover.status];
    const vi = visible.findIndex((s) => s.id === id);

    let index: number;
    if (action === 'top') index = 0;
    else if (action === 'bottom') index = rest.length;
    else {
      const neighbour = visible[action === 'up' ? vi - 1 : vi + 1];
      if (!neighbour) return;
      const ni = rest.findIndex((s) => s.id === neighbour.id);
      index = action === 'up' ? ni : ni + 1;
    }
    void applyMoves(planMove(rest, id, index));
  };

  // ---- Drag and drop ---------------------------------------------------------------

  const statusFromOver = (overId: string | number): ScriptStatus | null => {
    if (isColumnId(overId)) return fromColumnId(overId);
    return scripts.find((s) => s.id === overId)?.status ?? null;
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragOver = (e: DragOverEvent) => {
    setOverStatus(e.over ? statusFromOver(e.over.id) : null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverStatus(null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    setOverStatus(null);
    const { active, over } = e;
    if (!over) return;

    const id = String(active.id);
    const mover = scripts.find((s) => s.id === id);
    const targetStatus = statusFromOver(over.id);
    if (!mover || !targetStatus) return;

    if (targetStatus !== mover.status) {
      void moveToColumn(id, targetStatus);
      return;
    }

    // Same column: only reorder while the column is in Custom order
    if (isColumnId(over.id) || over.id === active.id) return;
    if (sorts[mover.status] !== 'custom') {
      showToast('Switch this column to “Custom order” to reorder', 'info');
      return;
    }

    const column = customOrder(scripts, mover.status);
    const oldIndex = column.findIndex((s) => s.id === id);
    const overIndex = column.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || overIndex < 0) return;
    const rest = column.filter((s) => s.id !== id);
    const overInRest = rest.findIndex((s) => s.id === over.id);
    void applyMoves(planMove(rest, id, oldIndex < overIndex ? overInRest + 1 : overInRest));
  };

  // ---- Create / edit / delete ----------------------------------------------------------

  const handleSaveScript = async (data: NewScriptInput | (NewScriptInput & { id: string })) => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }

    if ('id' in data) {
      const original = scripts.find((s) => s.id === data.id);
      const patch: Partial<ScriptItem> & { id: string } = { ...data };
      let extras: PositionMove[] = [];

      // Changing the stage in the form behaves like a drag: land at the top (or bottom for Posted)
      if (original && data.status !== original.status) {
        const rest = customOrder(scripts, data.status);
        const moves = planMove(rest, data.id, LANDS_AT_BOTTOM[data.status] ? rest.length : 0);
        patch.position = moves.find((m) => m.id === data.id)?.position;
        extras = moves.filter((m) => m.id !== data.id);
      }

      const updated = await updateScript(patch);
      setScripts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      showToast('Script updated successfully', 'success', updated.title);
      if (extras.length > 0) void applyMoves(extras);
    } else {
      const tempId = '__new__';
      const rest = customOrder(scripts, data.status);
      const moves = planMove(rest, tempId, LANDS_AT_BOTTOM[data.status] ? rest.length : 0);
      const position = moves.find((m) => m.id === tempId)?.position;
      const created = await createScript({ ...data, position });
      setScripts((prev) => [created, ...prev]);
      showToast('Script added to board', 'success', created.title);
      const extras = moves.filter((m) => m.id !== tempId);
      if (extras.length > 0) void applyMoves(extras);
    }
  };

  const handleBulkImport = async (items: NewScriptInput[]) => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }

    // Keep the pasted order: first pasted script ends up highest in its column
    const positioned: NewScriptInput[] = [];
    for (const st of SCRIPT_STATUS_ORDER) {
      const group = items.filter((it) => (it.status || 'needs_corrections') === st);
      if (group.length === 0) continue;
      const rest = customOrder(scripts, st);
      group.forEach((item, k) => {
        const position = LANDS_AT_BOTTOM[st]
          ? (rest.length ? rest[rest.length - 1].position ?? 0 : 0) + (k + 1) * POSITION_STEP
          : (rest.length ? rest[0].position ?? POSITION_STEP : POSITION_STEP) - (group.length - k) * POSITION_STEP;
        positioned.push({ ...item, position });
      });
    }

    try {
      const createdList = await bulkCreateScripts(positioned);
      setScripts((prev) => [...createdList, ...prev]);
      showToast(`Imported ${createdList.length} scripts to board`, 'success');
    } catch (err) {
      showToast(errorMessage(err) || 'Failed to bulk import scripts', 'info');
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

    showToast('Script deleted', 'delete', itemToDelete.title, handleUndo, 5000);
  };

  const openEdit = (script: ScriptItem) => {
    setEditingScript(script);
    setIsAddEditModalOpen(true);
  };

  const handlers: CardHandlers = {
    onEdit: openEdit,
    onDelete: handleDeleteScript,
    onStatusChange: handleStatusChange,
    onAdvanceStatus: handleAdvanceStatus,
    onMoveInColumn: moveInColumn,
    onMoveToColumn: (id, status) => void moveToColumn(id, status),
    onRead: (s) => setReadScript(s),
  };

  const setHovered = useCallback((id: string | null) => {
    hoveredIdRef.current = id;
  }, []);

  // "R" opens Read Mode for the hovered card (or the first Ready-to-Shoot script)
  const anyModalOpen =
    isAddEditModalOpen || isBulkImportOpen || isShootDayOpen || Boolean(readScript);

  useEffect(() => {
    if (!isAuthenticated || anyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const hovered = hoveredIdRef.current ? scripts.find((s) => s.id === hoveredIdRef.current) : null;
      const fallback = columns.ready_to_shoot[0];
      const chosen = hovered || fallback;
      if (chosen) {
        e.preventDefault();
        setReadScript(chosen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAuthenticated, anyModalOpen, scripts, columns]);

  const readyToShootCount = scripts.filter((s) => s.status === 'ready_to_shoot').length;

  // Keep the Read Mode copy in sync after status changes
  const liveReadScript = readScript ? scripts.find((s) => s.id === readScript.id) || readScript : null;

  const listStatuses = listStatusFilter === 'all' ? SCRIPT_STATUS_ORDER : [listStatusFilter];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl shadow-sm">
        {/* Left: View Mode Toggle & Search */}
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <div className="flex items-center bg-zinc-950 rounded-xl p-1 border border-zinc-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'board' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search title, body, tags..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-950 text-zinc-100 placeholder-zinc-500 rounded-xl border border-zinc-800 focus:outline-none focus:border-indigo-500 transition-all"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-500 hover:text-zinc-300"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Main Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
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

      {/* Filters: tags + created-date range */}
      {isAuthenticated && scripts.length > 0 && (
        <div className="space-y-2.5 p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl">
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1 text-[11px] font-semibold">
              <span className="text-zinc-500 shrink-0 mr-0.5">Tags</span>
              {allTags.map(([tag, count]) => {
                const on = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setSelectedTags((prev) => (on ? prev.filter((t) => t !== tag) : [...prev, tag]))
                    }
                    aria-pressed={on}
                    className={`shrink-0 px-2.5 py-1.5 rounded-full border font-mono transition-colors cursor-pointer ${
                      on
                        ? 'bg-indigo-600/25 text-indigo-200 border-indigo-500/50'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    #{tag} <span className="opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold">
            <span className="text-zinc-500">Created</span>
            {(
              [
                ['All', null],
                ['This week', 'week'],
                ['This month', 'month'],
              ] as const
            ).map(([label, kind]) => {
              const range = kind ? quickRange(kind) : { from: '', to: '' };
              const on = dateFrom === range.from && dateTo === range.to;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setDateFrom(range.from);
                    setDateTo(range.to);
                  }}
                  aria-pressed={on}
                  className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    on
                      ? 'bg-zinc-800 text-white border-zinc-700'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Created from"
              className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 [color-scheme:dark] focus:outline-none focus:border-indigo-500"
            />
            <span className="text-zinc-600">–</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Created to"
              className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 [color-scheme:dark] focus:outline-none focus:border-indigo-500"
            />
            {(filtersActive || localSearch) && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Unauthenticated Banner */}
      {!isAuthenticated && (
        <div className="p-8 text-center bg-zinc-900/60 border border-zinc-800 rounded-3xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100">Video Scripts Production Organizer</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
              Sign in with your Google account to write, batch import from Notepad, track notes, and shoot video scripts distraction-free.
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
              <h3 className="text-base font-bold text-zinc-100 mb-1">No Video Scripts Yet</h3>
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
            /* BOARD VIEW: 4 columns */
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
                {SCRIPT_STATUS_ORDER.map((status) => (
                  <BoardColumn
                    key={status}
                    status={status}
                    scripts={columns[status]}
                    sort={sorts[status]}
                    onSortChange={(key) => setSortFor(status, key)}
                    isDropTarget={Boolean(activeScript) && overStatus === status && activeScript?.status !== status}
                    postedNumbers={postedNumbers}
                    handlers={handlers}
                    onHover={setHovered}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeScript ? (
                  <div className="pointer-events-none rotate-1 shadow-2xl shadow-black/60 opacity-95">
                    <ScriptCard
                      script={activeScript}
                      postedNumber={postedNumbers.get(activeScript.id)}
                      canReorder={false}
                      isFirst
                      isLast
                      {...handlers}
                      onReadFullScreen={undefined}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            /* LIST VIEW */
            <div className="space-y-4">
              {/* Status Filter Pills + sort for the selected stage */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold flex-1 min-w-0">
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
                    const isSelected = listStatusFilter === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setListStatusFilter(st)}
                        className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                          isSelected
                            ? `${conf.badgeBg} ${conf.badgeText} ${conf.badgeBorder} shadow-sm font-bold`
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800/80 hover:text-zinc-200'
                        }`}
                      >
                        {conf.label} ({columns[st].length})
                      </button>
                    );
                  })}
                </div>
                {listStatusFilter !== 'all' && (
                  <SortSelect
                    status={listStatusFilter}
                    value={sorts[listStatusFilter]}
                    onChange={(key) => setSortFor(listStatusFilter, key)}
                  />
                )}
              </div>

              {listStatusFilter === 'all' && (
                <p className="text-[11px] text-zinc-500">
                  Grouped by stage, each in its own column order. Pick a stage to change its sort.
                </p>
              )}

              <div className="space-y-2.5">
                {listStatuses.flatMap((st) =>
                  columns[st].map((script, i, list) => {
                    const { words, speakingTime } = formatScriptMetrics(script.body);
                    const conf = SCRIPT_STATUS_CONFIG[st];
                    const number = postedNumbers.get(script.id);

                    return (
                      <div
                        key={script.id}
                        onClick={() => openEdit(script)}
                        onMouseEnter={() => setHovered(script.id)}
                        onMouseLeave={() => setHovered(null)}
                        className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group shadow-sm"
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${conf.badgeBg} ${conf.badgeText} ${conf.badgeBorder}`}
                            >
                              {conf.label}
                            </span>
                            {st === 'posted' && number !== undefined && (
                              <span className="px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                                #{number}
                              </span>
                            )}
                            <h4 className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors truncate min-w-0">
                              {script.title}
                            </h4>
                          </div>

                          <p className="text-[10px] font-mono text-zinc-500">{scriptDateLabel(script)}</p>

                          <p className="text-xs text-zinc-400 line-clamp-1 font-mono break-words">
                            {script.body.slice(0, 140)}...
                          </p>

                          {st === 'needs_corrections' && script.correctionsNote && (
                            <p className="text-[11px] text-amber-400/90 font-medium break-words">
                              <strong>Notes:</strong> {script.correctionsNote}
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
                            <button
                              type="button"
                              onClick={() => setReadScript(script)}
                              className="flex items-center gap-1.5 min-h-10 px-3.5 text-sm font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md active:scale-95 transition-all cursor-pointer"
                              title="Read Mode (R)"
                              aria-label="Open Read Mode"
                            >
                              <BookOpen className="w-4 h-4" />
                              Read
                            </button>

                            {conf.nextStatus && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceStatus(script.id, script.status)}
                                className="hidden sm:flex items-center gap-1 min-h-10 px-3 text-xs font-bold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                              >
                                {conf.nextActionLabel}
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}

                            <ScriptActionsMenu
                              script={script}
                              canReorder={sorts[st] === 'custom'}
                              isFirst={i === 0}
                              isLast={i === list.length - 1}
                              onMoveInColumn={moveInColumn}
                              onMoveToColumn={(id, status) => void moveToColumn(id, status)}
                            />

                            <button
                              type="button"
                              onClick={() => handleDeleteScript(script.id)}
                              className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete Script"
                              aria-label="Delete Script"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
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
          if (!(await moveToColumn(scriptId, 'shot'))) throw new Error('Could not mark as shot');
        }}
      />

      {/* Read Mode */}
      <FitToScreenModal
        isOpen={Boolean(liveReadScript)}
        onClose={() => setReadScript(null)}
        script={liveReadScript}
        onMarkAsShot={async (scriptId) => {
          if (!(await moveToColumn(scriptId, 'shot'))) throw new Error('Could not mark as shot');
        }}
        showToast={showToast}
      />
    </div>
  );
};
