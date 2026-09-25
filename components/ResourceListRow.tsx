'use client';

import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Edit2, Trash2, Tag as TagIcon, Folder, Globe, Pin } from 'lucide-react';
import { Resource } from '@/lib/types';
import { getDomain, getFaviconUrl } from '@/lib/utils';

interface ResourceListRowProps {
  resource: Resource;
  onEdit: (resource: Resource) => void;
  onDelete: (id: string) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onResourceClick?: (id: string) => void;
  onTagClick?: (tag: string) => void;
  onCategoryClick?: (category: string) => void;
}

export const ResourceListRow: React.FC<ResourceListRowProps> = ({
  resource,
  onEdit,
  onDelete,
  onTogglePin,
  onResourceClick,
  onTagClick,
  onCategoryClick,
}) => {
  const [copied, setCopied] = useState(false);
  const domain = getDomain(resource.url);
  const faviconUrl = getFaviconUrl(resource.url);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(resource.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLinkClick = () => {
    onResourceClick?.(resource.id);
  };

  return (
    <div
      className={`group border rounded-xl p-3 sm:px-4 transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        resource.isPinned
          ? 'bg-zinc-900/95 border-amber-500/40 ring-1 ring-amber-500/20 shadow-md'
          : 'bg-zinc-900/80 hover:bg-zinc-900 border-zinc-800/80 hover:border-zinc-700/80'
      }`}
    >
      {/* Title & Domain Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {faviconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={faviconUrl}
            alt={domain}
            className="w-6 h-6 rounded-md bg-zinc-800 p-0.5 border border-zinc-700/40 object-contain shrink-0"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <Globe className="w-5 h-5 text-zinc-500 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
              className="font-semibold text-sm text-zinc-100 hover:text-indigo-300 transition-colors inline-flex items-center gap-1.5 truncate"
            >
              <span className="truncate">{resource.title}</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-indigo-400 shrink-0" />
            </a>

            <button
              onClick={() => onCategoryClick?.(resource.category)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-2 py-0.5 rounded-md transition-colors"
            >
              <Folder className="w-2.5 h-2.5" />
              <span>{resource.category}</span>
            </button>

            {resource.isPinned && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Pin className="w-2.5 h-2.5 fill-amber-300 rotate-45" /> Pinned
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
            <span className="truncate max-w-[200px]">{domain}</span>
            {typeof resource.clickCount === 'number' && resource.clickCount > 0 && (
              <span className="text-[11px] text-zinc-500 font-mono">
                • {resource.clickCount} click{resource.clickCount !== 1 ? 's' : ''}
              </span>
            )}
            {resource.notes && (
              <span className="hidden md:inline truncate max-w-[300px] text-zinc-500">
                • {resource.notes}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tags & Action Buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        {resource.tags && resource.tags.length > 0 && (
          <div className="hidden lg:flex items-center gap-1">
            {resource.tags.slice(0, 3).map((tag) => (
              <button
                key={tag}
                onClick={() => onTagClick?.(tag)}
                className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                  tag === 'needs-review'
                    ? 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 border-zinc-700/30'
                }`}
              >
                #{tag}
              </button>
            ))}
            {resource.tags.length > 3 && (
              <span className="text-[10px] text-zinc-500 font-medium">
                +{resource.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          {/* Pin Toggle */}
          <button
            onClick={() => onTogglePin?.(resource.id, !resource.isPinned)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              resource.isPinned
                ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                : 'text-zinc-500 hover:text-amber-300 hover:bg-zinc-800'
            }`}
            title={resource.isPinned ? 'Unpin resource' : 'Pin resource to top'}
          >
            <Pin className={`w-4 h-4 ${resource.isPinned ? 'fill-amber-400 rotate-45' : ''}`} />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title={copied ? 'Copied!' : 'Copy URL'}
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onEdit(resource)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-300 hover:bg-zinc-800 transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(resource.id)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
