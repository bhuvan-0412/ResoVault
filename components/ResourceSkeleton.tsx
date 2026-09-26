'use client';

import React from 'react';
import { ViewMode } from '@/lib/types';

interface ResourceSkeletonProps {
  viewMode: ViewMode;
  count?: number;
}

export const ResourceSkeleton: React.FC<ResourceSkeletonProps> = ({
  viewMode,
  count = 6,
}) => {
  const items = Array.from({ length: count });

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-200">
        {items.map((_, i) => (
          <div
            key={i}
            className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-4"
          >
            <div>
              {/* Header: domain icon + category pill + actions */}
              <div className="flex items-start justify-between gap-3 mb-3.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 animate-pulse shrink-0" />
                  <div className="space-y-1.5 min-w-0">
                    <div className="h-4 w-24 bg-zinc-800 animate-pulse rounded-md" />
                    <div className="h-3 w-16 bg-zinc-800/60 animate-pulse rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-lg bg-zinc-800 animate-pulse" />
                  <div className="w-6 h-6 rounded-lg bg-zinc-800 animate-pulse" />
                </div>
              </div>

              {/* Title line placeholder */}
              <div className="space-y-2 mb-3">
                <div className="h-5 w-4/5 bg-zinc-800 animate-pulse rounded-md" />
                <div className="h-4 w-3/5 bg-zinc-800/70 animate-pulse rounded-md" />
              </div>

              {/* Notes placeholder */}
              <div className="h-9 w-full bg-zinc-950/40 rounded-lg border border-zinc-800/30 p-2">
                <div className="h-3 w-5/6 bg-zinc-800/50 animate-pulse rounded" />
              </div>
            </div>

            {/* Tags row */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-800/50">
              <div className="h-5 w-14 bg-zinc-800 animate-pulse rounded-md" />
              <div className="h-5 w-16 bg-zinc-800 animate-pulse rounded-md" />
              <div className="h-5 w-12 bg-zinc-800 animate-pulse rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // List view skeletons
  return (
    <div className="space-y-2.5 animate-in fade-in duration-200">
      {items.map((_, i) => (
        <div
          key={i}
          className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-6 h-6 rounded-md bg-zinc-800 animate-pulse shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="h-4 w-48 bg-zinc-800 animate-pulse rounded-md" />
                <div className="h-3.5 w-20 bg-zinc-800/80 animate-pulse rounded-md" />
              </div>
              <div className="h-3 w-28 bg-zinc-800/50 animate-pulse rounded" />
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1">
              <div className="h-4 w-12 bg-zinc-800 animate-pulse rounded" />
              <div className="h-4 w-14 bg-zinc-800 animate-pulse rounded" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 rounded-lg bg-zinc-800 animate-pulse" />
              <div className="w-6 h-6 rounded-lg bg-zinc-800 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
