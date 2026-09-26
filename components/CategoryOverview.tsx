'use client';

import React from 'react';
import { Folder, FolderOpen, Layers } from 'lucide-react';
import { CategoryStat } from '@/lib/types';
import { getCategoryStyle } from '@/lib/utils';

interface CategoryOverviewProps {
  categories: CategoryStat[];
  activeCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  totalCount: number;
}

export const CategoryOverview: React.FC<CategoryOverviewProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
  totalCount,
}) => {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          Categories &amp; Folders
        </h2>
        {activeCategory && (
          <button
            onClick={() => onSelectCategory(null)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium cursor-pointer"
          >
            Clear Filter (Show All)
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-0.5 scrollbar-thin scrollbar-thumb-zinc-800 scroll-smooth touch-pan-x">
        {/* All Resources Pill/Folder */}
        <button
          onClick={() => onSelectCategory(null)}
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
            activeCategory === null
              ? 'bg-indigo-600/20 border-indigo-500/60 text-white shadow-md shadow-indigo-600/10 ring-1 ring-indigo-500/30'
              : 'bg-zinc-900/80 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          {activeCategory === null ? (
            <FolderOpen className="w-4 h-4 text-indigo-400" />
          ) : (
            <Folder className="w-4 h-4 text-zinc-500" />
          )}
          <span>All Resources</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              activeCategory === null
                ? 'bg-indigo-500/30 text-indigo-200'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {totalCount}
          </span>
        </button>

        {/* Dynamic Category Folders with Distinct Colors */}
        {categories.map((cat) => {
          const isSelected = activeCategory === cat.name;
          const style = getCategoryStyle(cat.name);

          return (
            <button
              key={cat.name}
              onClick={() => onSelectCategory(isSelected ? null : cat.name)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
                isSelected
                  ? `${style.active} shadow-sm`
                  : 'bg-zinc-900/80 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
              {isSelected ? (
                <FolderOpen className={`w-3.5 h-3.5 ${style.text}`} />
              ) : (
                <Folder className="w-3.5 h-3.5 text-zinc-500" />
              )}
              <span>{cat.name}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  isSelected
                    ? `${style.bg} ${style.text}`
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
