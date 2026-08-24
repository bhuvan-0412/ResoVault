'use client';

import React, { useEffect, useRef } from 'react';
import { Search, Plus, LayoutGrid, List, Download, Sparkles, X, Bookmark, Zap } from 'lucide-react';
import { ViewMode } from '@/lib/types';

interface NavbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onOpenAddModal: () => void;
  onOpenBulkModal: () => void;
  onOpenBackupModal: () => void;
  totalResources: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  onOpenAddModal,
  onOpenBulkModal,
  onOpenBackupModal,
  totalResources,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global '/' keyboard shortcut to focus search bar instantly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchQuery]);

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <Bookmark className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent tracking-tight">
                  Resource Hub
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  v1.1
                </span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">Personal Link Engine</p>
            </div>
          </div>

          {/* Search Bar (Live & Instant) */}
          <div className="flex-1 max-w-xl mx-2 sm:mx-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-indigo-400 transition-colors">
                <Search className="w-4 h-4" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search resources by title, category, tags, or notes... (Press '/' to focus)"
                className="w-full pl-10 pr-10 py-2 text-sm bg-zinc-900/90 hover:bg-zinc-900 text-zinc-100 placeholder-zinc-500 rounded-xl border border-zinc-800 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-200 transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <div className="absolute inset-y-0 right-0 pr-3 hidden md:flex items-center pointer-events-none">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-zinc-500 bg-zinc-800/80 rounded border border-zinc-700/50">
                    /
                  </kbd>
                </div>
              )}
            </div>
          </div>

          {/* Controls & Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center bg-zinc-900 rounded-xl p-1 border border-zinc-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'grid'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
                title="Grid View (Folder Cards)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
                title="Dense List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Backup / Export Button */}
            <button
              onClick={onOpenBackupModal}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 border border-zinc-800/80 transition-all"
              title="Backup & Restore Data (Import / Export JSON)"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Bulk Import Button */}
            <button
              onClick={onOpenBulkModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 text-sm font-semibold transition-all active:scale-95"
              title="Bulk Import Links from Raw Text"
            >
              <Zap className="w-4 h-4 fill-indigo-400 text-indigo-400" />
              <span className="hidden lg:inline">Bulk Import</span>
            </button>

            {/* Add Resource Button */}
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 ring-1 ring-white/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden md:inline">Add Resource</span>
              <span className="md:hidden">Add</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
