'use client';

import React from 'react';
import { Bookmark, Folder, Tag as TagIcon, ArrowUpDown } from 'lucide-react';
import { SortOption } from '@/lib/types';

interface StatsBarProps {
  totalResources: number;
  totalCategories: number;
  totalTags: number;
  sortOption: SortOption;
  setSortOption: (sort: SortOption) => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  totalResources,
  totalCategories,
  totalTags,
  sortOption,
  setSortOption,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-zinc-900/60 p-3 sm:px-4 rounded-xl border border-zinc-800/80">
      
      {/* Quick Metrics */}
      <div className="flex items-center gap-4 sm:gap-6 text-xs text-zinc-400">
        <div className="flex items-center gap-1.5 font-medium text-zinc-300">
          <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-bold text-white">{totalResources}</span> Resources
        </div>
        <div className="flex items-center gap-1.5 font-medium text-zinc-300">
          <Folder className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-bold text-white">{totalCategories}</span> Categories
        </div>
        <div className="flex items-center gap-1.5 font-medium text-zinc-300">
          <TagIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-bold text-white">{totalTags}</span> Tags
        </div>
      </div>

      {/* Sort selector */}
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
          className="bg-zinc-950 text-zinc-300 text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-800 focus:outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="newest">Recently Added</option>
          <option value="oldest">Oldest First</option>
          <option value="title-asc">Title (A-Z)</option>
          <option value="title-desc">Title (Z-A)</option>
        </select>
      </div>

    </div>
  );
};
