'use client';

import React, { useState, useMemo } from 'react';
import { Sparkles, Clock, History, ExternalLink, Copy, Check, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { Resource } from '@/lib/types';
import { getDomain, getFaviconUrl, getCategoryStyle } from '@/lib/utils';

interface RecentShelfProps {
  resources: Resource[];
  onResourceClick: (id: string) => void;
  onCopySuccess: () => void;
  onCategoryClick?: (category: string) => void;
}

export const RecentShelf: React.FC<RecentShelfProps> = ({
  resources,
  onResourceClick,
  onCopySuccess,
  onCategoryClick,
}) => {
  const [mode, setMode] = useState<'added' | 'opened'>('added');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const recentlyAdded = useMemo(() => {
    return [...resources]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [resources]);

  const recentlyOpened = useMemo(() => {
    return [...resources]
      .filter((r) => r.lastOpenedAt || (r.clickCount && r.clickCount > 0))
      .sort((a, b) => {
        const timeA = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
        const timeB = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return (b.clickCount || 0) - (a.clickCount || 0);
      })
      .slice(0, 8);
  }, [resources]);

  const currentList = mode === 'added' ? recentlyAdded : recentlyOpened;

  const handleCopy = (e: React.MouseEvent, id: string, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    onCopySuccess();
    setTimeout(() => setCopiedId(null), 1800);
  };

  if (resources.length === 0) return null;

  return (
    <div className="mb-5 bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-zinc-900/90 rounded-2xl border border-zinc-800/80 overflow-hidden shadow-lg">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 border-b border-zinc-800/60 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* Segmented Switch */}
          <div className="flex items-center bg-zinc-950 p-0.5 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setMode('added');
                setIsCollapsed(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'added'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Recently Added</span>
              <span className="text-[10px] opacity-75 font-mono">({recentlyAdded.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('opened');
                setIsCollapsed(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'opened'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Recently Opened</span>
              <span className="text-[10px] opacity-75 font-mono">({recentlyOpened.length})</span>
            </button>
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer"
        >
          <span>{isCollapsed ? 'Show' : 'Hide'}</span>
          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Shelf Body: horizontally scrollable row of mini cards */}
      {!isCollapsed && (
        <div className="p-3 sm:p-3.5 overflow-x-auto no-scrollbar">
          {currentList.length > 0 ? (
            <div className="flex items-stretch gap-2.5 min-w-max pb-0.5">
              {currentList.map((resource) => {
                const domain = getDomain(resource.url);
                const faviconUrl = getFaviconUrl(resource.url);
                const catStyle = getCategoryStyle(resource.category);
                const isCopied = copiedId === resource.id;

                return (
                  <div
                    key={resource.id}
                    className="group relative flex flex-col justify-between w-56 sm:w-64 bg-zinc-950/70 hover:bg-zinc-900 border border-zinc-800/70 hover:border-indigo-500/40 rounded-xl p-2.5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {/* Top: icon + category + copy action */}
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {faviconUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={faviconUrl}
                            alt={domain}
                            className="w-4 h-4 rounded bg-zinc-800 object-contain shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        )}
                        <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[90px]">
                          {domain}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleCopy(e, resource.id, resource.url)}
                          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Copy Link"
                          aria-label="Copy link"
                        >
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Middle: Title clickable */}
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onResourceClick(resource.id)}
                      className="text-xs font-semibold text-zinc-200 group-hover:text-indigo-300 transition-colors line-clamp-1 mb-2 inline-flex items-center gap-1"
                      title={resource.title}
                    >
                      <span className="truncate">{resource.title}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-indigo-400 shrink-0 transition-opacity" />
                    </a>

                    {/* Bottom: Category tag */}
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-800/40 text-[10px]">
                      <button
                        type="button"
                        onClick={() => onCategoryClick?.(resource.category)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md ${catStyle.badge} hover:brightness-110 truncate max-w-[130px] cursor-pointer`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
                        <span className="truncate">{resource.category}</span>
                      </button>

                      {mode === 'opened' && resource.clickCount ? (
                        <span className="text-zinc-500 font-mono text-[9px]">
                          {resource.clickCount} click{resource.clickCount > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-zinc-500 font-mono text-[9px]">
                          {new Date(resource.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 py-3 text-center">
              {mode === 'opened' ? 'No opened links yet. Click resources to start tracking history!' : 'No resources found.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
