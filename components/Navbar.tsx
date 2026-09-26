'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ViewMode, User, AppTab } from '@/lib/types';
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  Download,
  Sparkles,
  X,
  Bookmark,
  Zap,
  User as UserIcon,
  LogOut,
  LogIn,
  ChevronDown,
  Flame,
  Newspaper,
  Calendar,
  CalendarClock,
} from 'lucide-react';

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onOpenAddModal: () => void;
  onOpenBulkModal: () => void;
  onOpenBackupModal: () => void;
  totalResources: number;
  user: User | null;
  onOpenAuthModal: (mode?: 'login' | 'signup') => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  onOpenAddModal,
  onOpenBulkModal,
  onOpenBackupModal,
  totalResources,
  user,
  onOpenAuthModal,
  onLogout,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : user?.email ? user.email.charAt(0).toUpperCase() : '?';

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/80 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* DESKTOP VIEW (md:flex) */}
        <div className="hidden md:flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <Bookmark className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent tracking-tight">
                  ResoVault
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Cloud Sync
                </span>
              </div>
              <p className="text-xs text-zinc-400">Cross-Device Resource Engine</p>
            </div>
          </div>

          {/* Primary Navigation Tabs */}
          <div className="flex items-center bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('vault')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'vault'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Vault</span>
              {totalResources > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-black/30 text-zinc-300 font-mono">
                  {totalResources}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('news')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'news'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${activeTab === 'news' ? 'text-amber-300 fill-amber-300' : 'text-amber-400'}`} />
              <span>Daily Digest</span>
              <span className="flex h-1.5 w-1.5 relative ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'schedule'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <CalendarClock className={`w-3.5 h-3.5 ${activeTab === 'schedule' ? 'text-violet-200' : 'text-violet-400'}`} />
              <span>Schedule</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                AI
              </span>
            </button>
          </div>

          {/* Search Bar */}
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
                placeholder={
                  activeTab === 'vault'
                    ? "Search resources by title, category, tags, or notes... (Press '/' to focus)"
                    : activeTab === 'news'
                    ? "Search articles or switch to Vault... (Press '/' to focus)"
                    : "Search schedule, todos, or switch to Vault... (Press '/' to focus)"
                }
                className="w-full pl-10 pr-10 py-2 text-sm bg-zinc-900/90 hover:bg-zinc-900 text-zinc-100 placeholder-zinc-500 rounded-xl border border-zinc-800 focus:outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
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
            <div className="flex items-center bg-zinc-900 rounded-xl p-1 border border-zinc-800">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
                title="Grid View (Folder Cards)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
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
              type="button"
              onClick={onOpenBackupModal}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 border border-zinc-800/80 transition-all cursor-pointer"
              title="Backup & Restore Data (Import / Export JSON)"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Bulk Import Button */}
            <button
              type="button"
              onClick={onOpenBulkModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 text-sm font-semibold transition-all active:scale-95 cursor-pointer"
              title="Bulk Import Links from Raw Text"
            >
              <Zap className="w-4 h-4 fill-indigo-400 text-indigo-400" />
              <span className="hidden lg:inline">Bulk Import</span>
            </button>

            {/* Add Resource Button */}
            <button
              type="button"
              onClick={onOpenAddModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 ring-1 ring-white/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Resource</span>
            </button>

            {/* User Account / Auth Section */}
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800 text-zinc-200 transition-all cursor-pointer"
                  title={user.email}
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name || user.email}
                      className="w-7 h-7 rounded-lg object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                      {userInitial}
                    </div>
                  )}
                  <span className="text-xs font-medium max-w-[100px] truncate">
                    {user.name || user.email.split('@')[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                      <p className="text-xs font-semibold text-zinc-100 truncate">{user.name || 'Google User'}</p>
                      <p className="text-[11px] text-zinc-400 truncate">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuthModal('login')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
                title="Sign in with Google Account"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign In</span>
              </button>
            )}
          </div>

        </div>

        {/* MOBILE VIEW (md:hidden) */}
        <div className="flex md:hidden flex-col gap-2.5 py-2.5">
          {/* Mobile Top Row: Logo & Main Actions */}
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Bookmark className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-bold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
                ResoVault
              </h1>
            </div>

            {/* Mobile Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded text-xs transition-all ${
                    viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500'
                  }`}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded text-xs transition-all ${
                    viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500'
                  }`}
                  aria-label="List view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Bulk Import */}
              <button
                type="button"
                onClick={onOpenBulkModal}
                className="min-w-[34px] min-h-[34px] p-2 rounded-lg bg-zinc-900 text-indigo-300 border border-indigo-500/30 flex items-center justify-center cursor-pointer"
                title="Bulk Import"
                aria-label="Bulk Import"
              >
                <Zap className="w-4 h-4 fill-indigo-400 text-indigo-400" />
              </button>

              {/* Add Resource */}
              <button
                type="button"
                onClick={onOpenAddModal}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add</span>
              </button>

              {/* User Avatar / Login */}
              {user ? (
                <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="min-w-[34px] min-h-[34px] rounded-lg p-1 bg-zinc-900 border border-zinc-800 flex items-center justify-center cursor-pointer"
                  aria-label="Account"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name || user.email}
                      className="w-6 h-6 rounded-md object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                      {userInitial}
                    </div>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('login')}
                  className="px-2.5 py-1.5 rounded-lg bg-white text-zinc-900 text-xs font-semibold shadow-sm cursor-pointer"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>

          {/* Mobile User Dropdown Popover */}
          {user && showUserMenu && (
            <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 shadow-xl animate-in fade-in duration-100">
              <div className="px-2 py-1 border-b border-zinc-800 mb-1">
                <p className="text-xs font-semibold text-zinc-100 truncate">{user.name || 'Google User'}</p>
                <p className="text-[11px] text-zinc-400 truncate">{user.email}</p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={onOpenBackupModal}
                  className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white py-1 px-2 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-400" /> Backup / Export
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 py-1 px-2 rounded-lg cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Log Out
                </button>
              </div>
            </div>
          )}

          {/* Mobile Row 2: Nav Tabs */}
          <div className="flex items-center justify-between bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('vault')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'vault'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Vault</span>
              {totalResources > 0 && (
                <span className="ml-0.5 px-1 py-0.2 rounded-full text-[9px] bg-black/40 text-zinc-300 font-mono">
                  {totalResources}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('news')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'news'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Digest</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'schedule'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5 text-violet-400" />
              <span>Schedule</span>
            </button>
          </div>

          {/* Mobile Row 3: Search Bar (with 16px text-base font size to avoid mobile viewport zoom) */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search resources, tags, or notes..."
              className="w-full pl-9 pr-9 py-2 bg-zinc-900 text-zinc-100 placeholder-zinc-500 text-base sm:text-sm rounded-xl border border-zinc-800 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-200 cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>
    </header>
  );
};
