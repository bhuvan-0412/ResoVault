'use client';

import React from 'react';
import { Folder, FolderOpen, Layers } from 'lucide-react';
import { CategoryStat } from '@/lib/types';

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
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          Categories & Folders
        </h2>
        {activeCategory && (
          <button
            onClick={() => onSelectCategory(null)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
          >
            Clear Filter (Show All)
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-800">
        {/* All Resources Pill/Folder */}
        <button
          onClick={() => onSelectCategory(null)}
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
            activeCategory === null
              ? 'bg-indigo-600/15 border-indigo-500/50 text-indigo-200 shadow-md shadow-indigo-500/10'
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
                ? 'bg-indigo-500/30 text-indigo-300'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {totalCount}
          </span>
        </button>

        {/* Dynamic Category Folders */}
        {categories.map((cat) => {
          const isSelected = activeCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => onSelectCategory(isSelected ? null : cat.name)}
              className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-indigo-600/15 border-indigo-500/50 text-indigo-200 shadow-md shadow-indigo-500/10'
                  : 'bg-zinc-900/80 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              {isSelected ? (
                <FolderOpen className="w-4 h-4 text-indigo-400" />
              ) : (
                <Folder className="w-4 h-4 text-zinc-500" />
              )}
              <span>{cat.name}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  isSelected
                    ? 'bg-indigo-500/30 text-indigo-300'
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
