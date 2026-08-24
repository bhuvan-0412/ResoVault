'use client';

import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Edit2, Trash2, Tag as TagIcon, Folder, Globe } from 'lucide-react';
import { Resource } from '@/lib/types';
import { getDomain, getFaviconUrl } from '@/lib/utils';

interface ResourceListRowProps {
  resource: Resource;
  onEdit: (resource: Resource) => void;
  onDelete: (id: string) => void;
  onTagClick?: (tag: string) => void;
  onCategoryClick?: (category: string) => void;
}

export const ResourceListRow: React.FC<ResourceListRowProps> = ({
  resource,
  onEdit,
  onDelete,
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

  return (
    <div className="group bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl p-3 sm:px-4 transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
            <span className="truncate max-w-[200px]">{domain}</span>
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
                className="text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/30 transition-colors"
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
