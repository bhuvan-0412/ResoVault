'use client';

import React, { useEffect, useState } from 'react';
import { X, ChevronUp, ChevronDown, Pencil, GitMerge, Trash2, FolderCog, Loader2, AlertCircle } from 'lucide-react';
import { CategoryStat } from '@/lib/types';
import { getCategoryStyle } from '@/lib/utils';
import { deleteCategory, mergeCategory, renameCategory, reorderCategories } from '@/lib/storage';
import { ToastItem } from '@/components/Toast';

export interface FolderChange {
  renamedFrom?: string;
  renamedTo?: string;
  /** Folder that no longer exists (deleted or merged away) */
  removed?: string;
  movedTo?: string;
}

interface ManageFoldersModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryStat[];
  onChanged: (change?: FolderChange) => Promise<void> | void;
  showToast: (message: string, type?: ToastItem['type'], subtext?: string) => void;
}

type PanelMode = 'rename' | 'merge' | 'delete';

interface Panel {
  name: string;
  mode: PanelMode;
}

const linkWord = (n: number) => `${n} link${n === 1 ? '' : 's'}`;

// State lives in the inner dialog so it resets every time the modal is opened
export const ManageFoldersModal: React.FC<ManageFoldersModalProps> = ({ isOpen, ...props }) => {
  if (!isOpen) return null;
  return <ManageFoldersDialog {...props} />;
};

const ManageFoldersDialog: React.FC<Omit<ManageFoldersModalProps, 'isOpen'>> = ({
  onClose,
  categories,
  onChanged,
  showToast,
}) => {
  // Order comes straight from the saved order; every change refreshes it via onChanged
  const order = React.useMemo(() => categories.map((c) => c.name), [categories]);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [destination, setDestination] = useState('');
  const [panelError, setPanelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = React.useMemo(() => {
    const map: Record<string, number> = {};
    categories.forEach((c) => {
      map[c.name] = c.count;
    });
    return map;
  }, [categories]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const openPanel = (name: string, mode: PanelMode) => {
    setPanel({ name, mode });
    setRenameValue(name);
    setDestination('');
    setPanelError(null);
  };

  const closePanel = () => {
    setPanel(null);
    setPanelError(null);
  };

  const handleMove = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= order.length || busy) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    const result = await reorderCategories(next);
    if (!result.ok) {
      setBusy(false);
      showToast('Could not reorder folders', 'error', result.error);
      return;
    }
    await onChanged();
    setBusy(false);
  };

  const handleRename = async () => {
    if (!panel) return;
    const clean = renameValue.trim();
    if (!clean) {
      setPanelError('Folder name cannot be empty.');
      return;
    }
    if (clean === panel.name) {
      closePanel();
      return;
    }
    const clash = order.find((n) => n !== panel.name && n.toLowerCase() === clean.toLowerCase());
    if (clash) {
      setPanelError(`A folder named "${clash}" already exists.`);
      setDestination(clash);
      return;
    }
    setBusy(true);
    const result = await renameCategory(panel.name, clean);
    setBusy(false);
    if (!result.ok) {
      setPanelError(result.error);
      showToast('Rename failed', 'error', result.error);
      return;
    }
    showToast(`Renamed to "${clean}"`, 'success', `${linkWord(counts[panel.name] || 0)} updated`);
    closePanel();
    await onChanged({ renamedFrom: panel.name, renamedTo: clean });
  };

  const handleMerge = async () => {
    if (!panel || !destination) return;
    setBusy(true);
    const result = await mergeCategory(panel.name, destination);
    setBusy(false);
    if (!result.ok) {
      setPanelError(result.error);
      showToast('Merge failed', 'error', result.error);
      return;
    }
    showToast(`Merged into "${destination}"`, 'success', `${linkWord(counts[panel.name] || 0)} moved`);
    const removed = panel.name;
    closePanel();
    await onChanged({ removed, movedTo: destination });
  };

  const handleDelete = async () => {
    if (!panel) return;
    const count = counts[panel.name] || 0;
    if (count > 0 && !destination) return;
    setBusy(true);
    const result = await deleteCategory(panel.name, count > 0 ? destination : undefined);
    setBusy(false);
    if (!result.ok) {
      setPanelError(result.error);
      showToast('Delete failed', 'error', result.error);
      return;
    }
    showToast(
      `Deleted "${panel.name}"`,
      'delete',
      count > 0 ? `${linkWord(count)} moved to "${destination}"` : undefined
    );
    const removed = panel.name;
    closePanel();
    await onChanged({ removed, movedTo: count > 0 ? destination : undefined });
  };

  const actionBtn =
    'inline-flex items-center gap-1.5 px-2.5 min-h-[36px] rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  const renderPanel = (name: string, mode: PanelMode) => {
    const others = order.filter((n) => n !== name);
    const count = counts[name] || 0;

    return (
      <div className="mt-2 p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5 animate-in fade-in duration-150">
        {mode === 'rename' && (
          <>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              New name
            </label>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => {
                setRenameValue(e.target.value);
                setPanelError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
              }}
              autoFocus
              className="w-full px-3 py-2.5 bg-zinc-900 text-zinc-100 text-base sm:text-sm rounded-lg border border-zinc-800 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
            <p className="text-[11px] text-zinc-500">
              Renames the folder and all {linkWord(count)} filed in it.
            </p>
          </>
        )}

        {mode === 'merge' && (
          <>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Move all {linkWord(count)} into
            </label>
            <select
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setPanelError(null);
              }}
              className="w-full px-3 py-2.5 bg-zinc-900 text-zinc-100 text-base sm:text-sm rounded-lg border border-zinc-800 focus:border-indigo-500/80 focus:outline-none cursor-pointer"
            >
              <option value="">Choose a folder…</option>
              {others.map((n) => (
                <option key={n} value={n}>
                  {n} ({counts[n] || 0})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-zinc-500">&quot;{name}&quot; is deleted after its links are moved.</p>
          </>
        )}

        {mode === 'delete' && (
          <>
            {count > 0 ? (
              <>
                <p className="text-xs text-amber-200">
                  &quot;{name}&quot; has {linkWord(count)}. Choose where to move them before deleting.
                </p>
                <select
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    setPanelError(null);
                  }}
                  className="w-full px-3 py-2.5 bg-zinc-900 text-zinc-100 text-base sm:text-sm rounded-lg border border-zinc-800 focus:border-indigo-500/80 focus:outline-none cursor-pointer"
                >
                  <option value="">Move links to…</option>
                  {others.map((n) => (
                    <option key={n} value={n}>
                      {n} ({counts[n] || 0})
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-xs text-zinc-300">&quot;{name}&quot; is empty. Delete this folder?</p>
            )}
          </>
        )}

        {panelError && (
          <div className="flex items-start gap-1.5 text-xs text-rose-300">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="min-w-0 break-words">
              <p>{panelError}</p>
              {mode === 'rename' && destination && (
                <button
                  type="button"
                  onClick={() => {
                    setPanel({ name, mode: 'merge' });
                    setPanelError(null);
                  }}
                  className="mt-1 text-indigo-300 hover:text-indigo-200 underline cursor-pointer"
                >
                  Merge into &quot;{destination}&quot; instead
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={closePanel}
            disabled={busy}
            className={`${actionBtn} border-transparent text-zinc-400 hover:text-zinc-200`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={mode === 'rename' ? handleRename : mode === 'merge' ? handleMerge : handleDelete}
            disabled={busy || (mode === 'merge' && !destination) || (mode === 'delete' && count > 0 && !destination)}
            className={`${actionBtn} ${
              mode === 'delete'
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500/60'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/60'
            }`}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {mode === 'rename' ? 'Rename' : mode === 'merge' ? 'Merge' : count > 0 ? 'Move & delete' : 'Delete'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage folders"
        className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <FolderCog className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-zinc-100">Manage folders</h2>
              <p className="text-[11px] text-zinc-500">Rename, merge, delete or reorder</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-w-[36px] min-h-[36px] p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1">
          {order.length === 0 && <li className="text-sm text-zinc-500 text-center py-6">No folders yet.</li>}
          {order.map((name, index) => {
            const style = getCategoryStyle(name);
            const count = counts[name] || 0;
            const expanded = panel?.name === name;
            return (
              <li key={name} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                  <span className="text-sm font-medium text-zinc-100 truncate flex-1 min-w-0">{name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${style.bg} ${style.text}`}>
                    {count}
                  </span>
                  <div className="flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={busy || index === 0}
                      aria-label={`Move ${name} up`}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={busy || index === order.length - 1}
                      aria-label={`Move ${name} down`}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => openPanel(name, 'rename')}
                    disabled={busy}
                    className={`${actionBtn} border-zinc-800 text-zinc-300 hover:bg-zinc-800`}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => openPanel(name, 'merge')}
                    disabled={busy || order.length < 2}
                    className={`${actionBtn} border-zinc-800 text-zinc-300 hover:bg-zinc-800`}
                  >
                    <GitMerge className="w-3.5 h-3.5" /> Merge into…
                  </button>
                  <button
                    type="button"
                    onClick={() => openPanel(name, 'delete')}
                    disabled={busy}
                    className={`${actionBtn} border-rose-500/30 text-rose-300 hover:bg-rose-500/10`}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>

                {expanded && panel && renderPanel(name, panel.mode)}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
