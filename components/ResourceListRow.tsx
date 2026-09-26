'use client';

import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Edit2, Trash2, Folder, Globe, Pin } from 'lucide-react';
import { Resource } from '@/lib/types';
import { getDomain, getFaviconUrl, getCategoryStyle } from '@/lib/utils';

interface ResourceListRowProps {
  resource: Resource;
  onEdit: (resource: Resource) => void;
  onDelete: (id: string) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onResourceClick?: (id: string) => void;
  onCopySuccess?: () => void;
  onTagClick?: (tag: string) => void;
  onCategoryClick?: (category: string) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isFocused?: boolean;
}

export const ResourceListRow: React.FC<ResourceListRowProps> = ({
  resource,
  onEdit,
  onDelete,
  onTogglePin,
  onResourceClick,
  onCopySuccess,
  onTagClick,
  onCategoryClick,
  isSelectMode,
  isSelected,
  onToggleSelect,
  isFocused,
}) => {
  const [copied, setCopied] = useState(false);
  const domain = getDomain(resource.url);
  const faviconUrl = getFaviconUrl(resource.url);
  const catStyle = getCategoryStyle(resource.category);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(resource.url);
    setCopied(true);
    onCopySuccess?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLinkClick = () => {
    onResourceClick?.(resource.id);
  };

  return (
    <div
      className={`group border rounded-xl p-3.5 sm:px-4 sm:py-3 transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isFocused
          ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-md shadow-indigo-500/20'
          : resource.isPinned
          ? 'bg-zinc-900/95 border-amber-500/40 ring-1 ring-amber-500/20 shadow-md'
          : 'bg-zinc-900/80 hover:bg-zinc-900 border-zinc-800/80 hover:border-zinc-700/80 hover:shadow-md'
      } ${isSelected ? 'bg-indigo-950/20 border-indigo-500/50' : ''}`}
    >
      {/* Title & Domain Info */}
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        {/* Select Mode Checkbox */}
        {isSelectMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(resource.id);
            }}
            className="p-0.5 rounded text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer shrink-0 mt-0.5 sm:mt-0"
            aria-label={isSelected ? 'Deselect resource' : 'Select resource'}
          >
            <div
              className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                  : 'border-zinc-600 bg-zinc-800 hover:border-zinc-400'
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </button>
        )}
        {faviconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={faviconUrl}
            alt={domain}
            className="w-6 h-6 rounded-md bg-zinc-800 p-0.5 border border-zinc-700/40 object-contain shrink-0 mt-0.5 sm:mt-0"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <Globe className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5 sm:mt-0" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
              className="font-semibold text-sm sm:text-base text-zinc-100 hover:text-indigo-300 transition-colors inline-flex items-center gap-1.5 truncate max-w-full group-hover:underline underline-offset-2"
            >
              <span className="truncate">{resource.title}</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-indigo-400 shrink-0" />
            </a>

            {/* Category Pill with Consistent Distinct Color */}
            <button
              type="button"
              onClick={() => onCategoryClick?.(resource.category)}
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all ${catStyle.badge} hover:brightness-110 cursor-pointer`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
              <span>{resource.category}</span>
            </button>

            {resource.isPinned && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Pin className="w-2.5 h-2.5 fill-amber-300 rotate-45" /> Pinned
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 flex-wrap">
            <span className="truncate max-w-[180px] sm:max-w-[220px] font-mono text-[11px] text-zinc-400">{domain}</span>
            {typeof resource.clickCount === 'number' && resource.clickCount > 0 && (
              <span className="text-[11px] text-zinc-500 font-mono">
                • {resource.clickCount} click{resource.clickCount !== 1 ? 's' : ''}
              </span>
            )}
            {resource.notes && (
              <span className="hidden md:inline truncate max-w-[320px] text-zinc-500">
                • {resource.notes}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tags & Action Buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60">
        {resource.tags && resource.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap max-w-[180px] sm:max-w-none">
            {resource.tags.slice(0, 2).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                  tag === 'needs-review'
                    ? 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 hover:bg-zinc-800 border-zinc-700/30'
                }`}
              >
                #{tag}
              </button>
            ))}
            {resource.tags.length > 2 && (
              <span className="text-[10px] text-zinc-500 font-medium">
                +{resource.tags.length - 2}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
          {/* Pin Toggle */}
          <button
            type="button"
            onClick={() => onTogglePin?.(resource.id, !resource.isPinned)}
            className={`min-w-[34px] min-h-[34px] p-2 sm:p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              resource.isPinned
                ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                : 'text-zinc-400 hover:text-amber-300 hover:bg-zinc-800'
            }`}
            title={resource.isPinned ? 'Unpin resource' : 'Pin resource to top'}
            aria-label={resource.isPinned ? 'Unpin resource' : 'Pin resource to top'}
          >
            <Pin className={`w-4 h-4 ${resource.isPinned ? 'fill-amber-400 rotate-45' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="min-w-[34px] min-h-[34px] p-2 sm:p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer"
            title={copied ? 'Copied!' : 'Copy URL'}
            aria-label="Copy URL"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => onEdit(resource)}
            className="min-w-[34px] min-h-[34px] p-2 sm:p-1.5 rounded-lg text-zinc-400 hover:text-indigo-300 hover:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer"
            title="Edit"
            aria-label="Edit resource"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(resource.id)}
            className="min-w-[34px] min-h-[34px] p-2 sm:p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer"
            title="Delete"
            aria-label="Delete resource"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
