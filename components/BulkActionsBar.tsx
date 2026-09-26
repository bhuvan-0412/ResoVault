'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  Trash2,
  Folder,
  Tag as TagIcon,
  X,
  Plus,
  Minus,
  Check,
  ChevronDown,
} from 'lucide-react';
import { getCategoryStyle } from '@/lib/utils';

interface BulkActionsBarProps {
  selectedCount: number;
  totalFilteredCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
  onBulkRecategorize: (category: string) => void;
  onBulkAddTag: (tag: string) => void;
  onBulkRemoveTag: (tag: string) => void;
  onCloseSelectMode: () => void;
  existingCategories: string[];
  existingTags: string[];
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  totalFilteredCount,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onBulkRecategorize,
  onBulkAddTag,
  onBulkRemoveTag,
  onCloseSelectMode,
  existingCategories,
  existingTags,
}) => {
  const [activePopover, setActivePopover] = useState<'category' | 'addTag' | 'removeTag' | null>(null);
  const [newCatInput, setNewCatInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [removeTagInput, setRemoveTagInput] = useState('');
  const barRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isAllSelected = selectedCount > 0 && selectedCount === totalFilteredCount;

  return (
    <div
      ref={barRef}
      className="fixed bottom-5 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-40 max-w-2xl w-full bg-zinc-900/95 backdrop-blur-xl border border-indigo-500/40 rounded-2xl shadow-2xl p-3 sm:px-4 text-xs animate-in slide-in-from-bottom-5 duration-200"
    >
      {/* Top row: selection info & actions */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap">
        
        {/* Selection count & toggle all */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isAllSelected ? onDeselectAll : onSelectAll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold cursor-pointer transition-colors"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-indigo-400" />
            ) : (
              <Square className="w-4 h-4 text-zinc-400" />
            )}
            <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
          </button>

          <span className="font-bold text-white px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {selectedCount} selected
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
          {/* Change Category Button */}
          <div className="relative">
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() =>
                setActivePopover(activePopover === 'category' ? null : 'category')
              }
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5 text-indigo-400" />
              <span>Category</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {/* Category Popover */}
            {activePopover === 'category' && (
              <div className="absolute bottom-full mb-2 left-0 sm:left-auto sm:right-0 w-60 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-2.5 space-y-2 z-50 animate-in fade-in duration-100">
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
                  Move {selectedCount} to Category:
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {existingCategories.map((cat) => {
                    const style = getCategoryStyle(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          onBulkRecategorize(cat);
                          setActivePopover(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
                      >
                        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                        <span className="truncate">{cat}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    placeholder="New category..."
                    className="w-full px-2 py-1 bg-zinc-900 text-zinc-100 text-xs rounded-lg border border-zinc-800 focus:outline-none focus:border-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCatInput.trim()) {
                        e.preventDefault();
                        onBulkRecategorize(newCatInput.trim());
                        setNewCatInput('');
                        setActivePopover(null);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!newCatInput.trim()}
                    onClick={() => {
                      if (newCatInput.trim()) {
                        onBulkRecategorize(newCatInput.trim());
                        setNewCatInput('');
                        setActivePopover(null);
                      }
                    }}
                    className="p-1 rounded-lg bg-indigo-600 text-white disabled:opacity-40 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add Tag Button */}
          <div className="relative">
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => setActivePopover(activePopover === 'addTag' ? null : 'addTag')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Tag</span>
            </button>

            {/* Add Tag Popover */}
            {activePopover === 'addTag' && (
              <div className="absolute bottom-full mb-2 left-0 sm:left-auto sm:right-0 w-56 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-2.5 space-y-2 z-50 animate-in fade-in duration-100">
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
                  Add Tag to {selectedCount} items:
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="e.g. read-later"
                    className="w-full px-2 py-1 bg-zinc-900 text-zinc-100 text-xs rounded-lg border border-zinc-800 focus:outline-none focus:border-indigo-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault();
                        onBulkAddTag(tagInput.trim());
                        setTagInput('');
                        setActivePopover(null);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!tagInput.trim()}
                    onClick={() => {
                      if (tagInput.trim()) {
                        onBulkAddTag(tagInput.trim());
                        setTagInput('');
                        setActivePopover(null);
                      }
                    }}
                    className="p-1 rounded-lg bg-indigo-600 text-white disabled:opacity-40 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
                {existingTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto">
                    {existingTags.slice(0, 6).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          onBulkAddTag(t);
                          setActivePopover(null);
                        }}
                        className="text-[10px] text-zinc-400 hover:text-indigo-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800"
                      >
                        +{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Remove Tag Button */}
          <div className="relative">
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => setActivePopover(activePopover === 'removeTag' ? null : 'removeTag')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors disabled:opacity-40 cursor-pointer"
              title="Remove a tag from selected"
            >
              <Minus className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Untag</span>
            </button>

            {/* Remove Tag Popover */}
            {activePopover === 'removeTag' && (
              <div className="absolute bottom-full mb-2 right-0 w-56 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-2.5 space-y-2 z-50 animate-in fade-in duration-100">
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
                  Remove Tag from selection:
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={removeTagInput}
                    onChange={(e) => setRemoveTagInput(e.target.value)}
                    placeholder="Tag name to remove..."
                    className="w-full px-2 py-1 bg-zinc-900 text-zinc-100 text-xs rounded-lg border border-zinc-800 focus:outline-none focus:border-rose-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && removeTagInput.trim()) {
                        e.preventDefault();
                        onBulkRemoveTag(removeTagInput.trim());
                        setRemoveTagInput('');
                        setActivePopover(null);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!removeTagInput.trim()}
                    onClick={() => {
                      if (removeTagInput.trim()) {
                        onBulkRemoveTag(removeTagInput.trim());
                        setRemoveTagInput('');
                        setActivePopover(null);
                      }
                    }}
                    className="p-1 rounded-lg bg-rose-600 text-white disabled:opacity-40 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bulk Delete Button */}
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={onBulkDelete}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold transition-colors disabled:opacity-40 cursor-pointer"
            title="Delete selected resources (Undo available)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          {/* Close Select Mode */}
          <button
            type="button"
            onClick={onCloseSelectMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Exit Select Mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
