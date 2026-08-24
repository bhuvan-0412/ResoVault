'use client';

import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Edit2, Trash2, Tag as TagIcon, Folder, Pin, FileText, Globe } from 'lucide-react';
import { Resource } from '@/lib/types';
import { getDomain, getFaviconUrl, getDomainType } from '@/lib/utils';

interface ResourceCardProps {
  resource: Resource;
  onEdit: (resource: Resource) => void;
  onDelete: (id: string) => void;
  onTagClick?: (tag: string) => void;
  onCategoryClick?: (category: string) => void;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  onEdit,
  onDelete,
  onTagClick,
  onCategoryClick,
}) => {
  const [copied, setCopied] = useState(false);
  const domain = getDomain(resource.url);
  const domainType = getDomainType(resource.url);
  const faviconUrl = getFaviconUrl(resource.url);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(resource.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper for rendering specific icon style
  const renderDomainBadge = () => {
    switch (domainType) {
      case 'github':
        return (
          <span className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-100 font-semibold text-xs shrink-0">
            GH
          </span>
        );
      case 'drive':
        return (
          <span className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
            GD
          </span>
        );
      case 'gdocs':
        return (
          <span className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
            Doc
          </span>
        );
      case 'youtube':
        return (
          <span className="w-8 h-8 rounded-lg bg-red-950/60 border border-red-800/40 flex items-center justify-center text-red-400 font-bold text-xs shrink-0">
            YT
          </span>
        );
      case 'figma':
        return (
          <span className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400 font-bold text-xs shrink-0">
            FG
          </span>
        );
      default:
        return faviconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={faviconUrl}
            alt={domain}
            className="w-8 h-8 rounded-lg bg-zinc-800 p-1 border border-zinc-700/50 object-contain shrink-0"
            onError={(e) => {
              // fallback if favicon fails
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400 shrink-0">
            <Globe className="w-4 h-4" />
          </span>
        );
    }
  };

  return (
    <div className="group relative bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800/90 hover:border-zinc-700/80 rounded-2xl p-4 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between">
      <div>
        {/* Header: Icon, Category & Actions */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {renderDomainBadge()}
            <div className="min-w-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCategoryClick?.(resource.category);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-2 py-0.5 rounded-md transition-colors truncate max-w-full"
              >
                <Folder className="w-3 h-3 shrink-0" />
                <span className="truncate">{resource.category}</span>
              </button>
              <div className="text-[11px] text-zinc-400 truncate mt-0.5" title={resource.url}>
                {domain}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title={copied ? 'Copied!' : 'Copy URL'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(resource);
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-300 hover:bg-zinc-800 transition-colors"
              title="Edit Resource"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(resource.id);
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
              title="Delete Resource"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Title Link (Opens in New Tab) */}
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group/title flex items-start gap-2 text-base font-semibold text-zinc-100 hover:text-indigo-300 transition-colors mb-2 leading-snug line-clamp-2"
        >
          <span>{resource.title}</span>
          <ExternalLink className="w-4 h-4 text-zinc-400 group-hover/title:text-indigo-400 shrink-0 mt-0.5 transition-colors" />
        </a>

        {/* Notes Preview */}
        {resource.notes && (
          <p className="text-xs text-zinc-400 line-clamp-2 mb-3 bg-zinc-950/40 p-2 rounded-lg border border-zinc-800/40">
            {resource.notes}
          </p>
        )}
      </div>

      {/* Tags Chips */}
      {resource.tags && resource.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-800/50 mt-2">
          {resource.tags.map((tag) => (
            <button
              key={tag}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(tag);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/40 px-2 py-0.5 rounded-md transition-colors"
            >
              <TagIcon className="w-2.5 h-2.5 text-zinc-500" />
              <span>{tag}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
