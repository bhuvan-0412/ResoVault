'use client';

import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Edit2, Trash2, Tag as TagIcon, Folder, Pin, FileText, Globe } from 'lucide-react';
import { Resource } from '@/lib/types';
import { getDomain, getFaviconUrl, getDomainType, getCategoryStyle } from '@/lib/utils';

interface ResourceCardProps {
  resource: Resource;
  onEdit: (resource: Resource) => void;
  onDelete: (id: string) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onResourceClick?: (id: string) => void;
  onCopySuccess?: () => void;
  onTagClick?: (tag: string) => void;
  onCategoryClick?: (category: string) => void;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  onEdit,
  onDelete,
  onTogglePin,
  onResourceClick,
  onCopySuccess,
  onTagClick,
  onCategoryClick,
}) => {
  const [copied, setCopied] = useState(false);
  const domain = getDomain(resource.url);
  const domainType = getDomainType(resource.url);
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

  // Helper for rendering specific icon style
  const renderDomainBadge = () => {
    switch (domainType) {
      case 'github':
        return (
          <span className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-100 font-semibold text-xs shrink-0 shadow-inner">
            GH
          </span>
        );
      case 'drive':
        return (
          <span className="w-8 h-8 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0 shadow-inner">
            GD
          </span>
        );
      case 'gdocs':
        return (
          <span className="w-8 h-8 rounded-xl bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0 shadow-inner">
            Doc
          </span>
        );
      case 'youtube':
        return (
          <span className="w-8 h-8 rounded-xl bg-red-950/60 border border-red-800/40 flex items-center justify-center text-red-400 font-bold text-xs shrink-0 shadow-inner">
            YT
          </span>
        );
      case 'figma':
        return (
          <span className="w-8 h-8 rounded-xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400 font-bold text-xs shrink-0 shadow-inner">
            FG
          </span>
        );
      default:
        return faviconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={faviconUrl}
            alt={domain}
            className="w-8 h-8 rounded-xl bg-zinc-800 p-1 border border-zinc-700/50 object-contain shrink-0 shadow-inner"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400 shrink-0">
            <Globe className="w-4 h-4" />
          </span>
        );
    }
  };

  return (
    <div
      className={`group relative bg-zinc-900/90 hover:bg-zinc-900 border rounded-2xl p-4 sm:p-4.5 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col justify-between ${
        resource.isPinned
          ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/[0.04] to-zinc-900/90 ring-1 ring-amber-500/25 shadow-md shadow-amber-500/5'
          : 'border-zinc-800/80 hover:border-zinc-700/90'
      }`}
    >
      <div>
        {/* Header: Icon, Category & Actions */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {renderDomainBadge()}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Category Pill with Distinct Color Coding */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCategoryClick?.(resource.category);
                  }}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer truncate max-w-full ${catStyle.badge} hover:brightness-110`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${catStyle.dot}`} />
                  <span className="truncate">{resource.category}</span>
                </button>
                {resource.isPinned && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <Pin className="w-2.5 h-2.5 fill-amber-300 rotate-45" /> Pinned
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400 truncate mt-1">
                <span className="truncate" title={resource.url}>
                  {domain}
                </span>
                {typeof resource.clickCount === 'number' && resource.clickCount > 0 && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    • {resource.clickCount} click{resource.clickCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar with generous mobile tap targets */}
          <div className="flex items-center gap-0.5 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
            {/* Pin / Favorite Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin?.(resource.id, !resource.isPinned);
              }}
              className={`p-2 sm:p-1.5 rounded-xl transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center ${
                resource.isPinned
                  ? 'text-amber-400 bg-amber-500/15 hover:bg-amber-500/25'
                  : 'text-zinc-500 hover:text-amber-300 hover:bg-zinc-800'
              }`}
              title={resource.isPinned ? 'Unpin resource' : 'Pin resource to top'}
            >
              <Pin className={`w-3.5 h-3.5 ${resource.isPinned ? 'fill-amber-400 rotate-45' : ''}`} />
            </button>
            <button
              onClick={handleCopy}
              className="p-2 sm:p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              title={copied ? 'Copied!' : 'Copy URL'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(resource);
              }}
              className="p-2 sm:p-1.5 rounded-xl text-zinc-400 hover:text-indigo-300 hover:bg-zinc-800 transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="Edit Resource"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(resource.id);
              }}
              className="p-2 sm:p-1.5 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="Delete Resource"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Primary Element: Title Link */}
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          className="group/title flex items-start justify-between gap-2 text-[15px] sm:text-base font-bold text-zinc-100 hover:text-indigo-300 transition-colors mb-2.5 leading-snug line-clamp-2 tracking-tight"
        >
          <span className="group-hover/title:underline decoration-indigo-400/40 underline-offset-2">{resource.title}</span>
          <ExternalLink className="w-4 h-4 text-zinc-500 group-hover/title:text-indigo-400 shrink-0 mt-0.5 transition-colors" />
        </a>

        {/* Notes Preview */}
        {resource.notes && (
          <p className="text-xs text-zinc-400 line-clamp-2 mb-3 bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/40 leading-relaxed">
            {resource.notes}
          </p>
        )}
      </div>

      {/* Secondary Element: Tags Chips Below */}
      {resource.tags && resource.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2.5 border-t border-zinc-800/60 mt-2">
          {resource.tags.map((tag) => (
            <button
              key={tag}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(tag);
              }}
              className={`inline-flex items-center gap-1 text-[10px] font-medium border px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                tag === 'needs-review'
                  ? 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700/40'
              }`}
            >
              <TagIcon className="w-2.5 h-2.5 text-zinc-500" />
              <span>#{tag}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
