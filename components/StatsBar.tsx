'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bookmark,
  Folder,
  Tag as TagIcon,
  ArrowUpDown,
  Filter,
  X,
  Check,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { SortOption, CategoryStat } from '@/lib/types';
import { getCategoryStyle } from '@/lib/utils';

interface StatsBarProps {
  totalResources: number;
  filteredResourcesCount: number;
  categories: CategoryStat[];
  activeCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  tagFilterMode: 'AND' | 'OR';
  setTagFilterMode: (mode: 'AND' | 'OR') => void;
  sortOption: SortOption;
  setSortOption: (sort: SortOption) => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  totalResources,
  filteredResourcesCount,
  categories,
  activeCategory,
  onSelectCategory,
  allTags,
  selectedTags,
  onToggleTag,
  onClearTags,
  tagFilterMode,
  setTagFilterMode,
  sortOption,
  setSortOption,
}) => {
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Close tag dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTagsList = allTags.filter((t) =>
    t.toLowerCase().includes(tagSearch.toLowerCase().trim())
  );

  return (
    <div className="mb-6 space-y-2.5">
      {/* Upper Bar: Counts & Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/60 p-3 sm:px-4 rounded-xl border border-zinc-800/80">
        
        {/* Quick Metrics */}
        <div className="flex items-center gap-4 sm:gap-6 text-xs text-zinc-400 flex-wrap">
          <div className="flex items-center gap-1.5 font-medium text-zinc-300">
            <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-bold text-white">{totalResources}</span> Resources
            {filteredResourcesCount !== totalResources && (
              <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20 font-mono">
                {filteredResourcesCount} shown
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 font-medium text-zinc-300">
            <Folder className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-bold text-white">{categories.length}</span> Categories
          </div>
          <div className="flex items-center gap-1.5 font-medium text-zinc-300">
            <TagIcon className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-bold text-white">{allTags.length}</span> Tags
          </div>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <span className="text-xs text-zinc-500 font-medium">Sort:</span>
          <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1.5 rounded-lg border border-zinc-800 flex-1 sm:flex-initial">
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-transparent text-zinc-200 text-xs font-medium focus:outline-none cursor-pointer w-full"
            >
              <option value="newest" className="bg-zinc-900 text-zinc-100">Recently Added (Newest)</option>
              <option value="oldest" className="bg-zinc-900 text-zinc-100">Oldest First</option>
              <option value="title-asc" className="bg-zinc-900 text-zinc-100">Title (A-Z)</option>
              <option value="title-desc" className="bg-zinc-900 text-zinc-100">Title (Z-A)</option>
              <option value="mru" className="bg-zinc-900 text-zinc-100">Most Recently Used</option>
              <option value="most-used" className="bg-zinc-900 text-zinc-100">Most Used (Top Clicks)</option>
              <option value="least-used" className="bg-zinc-900 text-zinc-100">Least Used / Never Opened</option>
            </select>
          </div>
        </div>

      </div>

      {/* Lower Filter Controls: Category Single-Select Dropdown & Tag Multi-Select Filter with AND/OR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-900/40 p-3 sm:px-4 rounded-xl border border-zinc-800/60 text-xs">
        
        {/* Left Side: Category Single-Select Dropdown */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold text-zinc-300">Category:</span>
          </div>

          <div className="relative">
            <select
              value={activeCategory || ''}
              onChange={(e) => onSelectCategory(e.target.value ? e.target.value : null)}
              className="bg-zinc-950 text-zinc-200 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="" className="bg-zinc-900 text-zinc-300">
                All Categories ({totalResources})
              </option>
              {categories.map((c) => (
                <option key={c.name} value={c.name} className="bg-zinc-900 text-zinc-100">
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
          </div>

          {activeCategory && (() => {
            const catStyle = getCategoryStyle(activeCategory);
            return (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${catStyle.badge}`}>
                <span className={`w-2 h-2 rounded-full ${catStyle.dot}`} />
                <span>{activeCategory}</span>
                <button
                  type="button"
                  onClick={() => onSelectCategory(null)}
                  className="hover:opacity-75 transition-opacity ml-1 cursor-pointer"
                  title="Clear category filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })()}
        </div>

        {/* Right Side: Multi-Select Tag Filter with AND/OR Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* AND / OR Segmented Switch (Active when tags are selected) */}
          {selectedTags.length > 1 && (
            <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
              <button
                type="button"
                onClick={() => setTagFilterMode('AND')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  tagFilterMode === 'AND'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Resource must have ALL selected tags"
              >
                AND (All)
              </button>
              <button
                type="button"
                onClick={() => setTagFilterMode('OR')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  tagFilterMode === 'OR'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Resource can have ANY selected tag"
              >
                OR (Any)
              </button>
            </div>
          )}

          {/* Multi-Select Tags Dropdown Trigger */}
          <div className="relative" ref={tagDropdownRef}>
            <button
              type="button"
              onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                selectedTags.length > 0
                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40 shadow-sm'
                  : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <TagIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {selectedTags.length === 0
                  ? 'Filter by Tags'
                  : `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''} selected (${tagFilterMode})`}
              </span>
              <ChevronDown className="w-3 h-3 text-zinc-500 ml-0.5" />
            </button>

            {/* Dropdown Popover (with mobile safe-viewport constraints) */}
            {isTagDropdownOpen && (
              <div className="absolute right-0 sm:right-0 mt-2 w-64 max-w-[calc(100vw-2.5rem)] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-2.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="mb-2">
                  <input
                    type="text"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Search tags..."
                    className="w-full px-2.5 py-1.5 bg-zinc-900 text-zinc-100 text-xs rounded-lg border border-zinc-800 focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                </div>

                {/* AND / OR toggle in dropdown */}
                <div className="flex items-center justify-between px-1 py-1 mb-2 border-b border-zinc-800/80 text-[11px] text-zinc-400">
                  <span>Match condition:</span>
                  <div className="flex items-center bg-zinc-900 rounded border border-zinc-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => setTagFilterMode('AND')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        tagFilterMode === 'AND' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
                      }`}
                    >
                      AND
                    </button>
                    <button
                      type="button"
                      onClick={() => setTagFilterMode('OR')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        tagFilterMode === 'OR' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
                      }`}
                    >
                      OR
                    </button>
                  </div>
                </div>

                {/* Tag Checklist */}
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {filteredTagsList.length > 0 ? (
                    filteredTagsList.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => onToggleTag(tag)}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                              : 'text-zinc-300 hover:bg-zinc-900'
                          }`}
                        >
                          <span className="truncate">#{tag}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="py-3 text-center text-zinc-500 text-xs">No tags match search</div>
                  )}
                </div>

                {selectedTags.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500">{selectedTags.length} active</span>
                    <button
                      type="button"
                      onClick={onClearTags}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Tag Chips */}
          {selectedTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedTags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => onToggleTag(t)}
                    className="hover:text-rose-300 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={onClearTags}
                className="text-[11px] text-zinc-400 hover:text-rose-300 underline cursor-pointer ml-0.5"
              >
                Clear tags
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
