'use client';

import React, { useState, useEffect } from 'react';
import { CloudUpload, Download, X, Check, AlertCircle, Loader2, Database } from 'lucide-react';
import { Resource } from '@/lib/types';
import {
  getLocalStoredResources,
  markLocalStorageMigrated,
  bulkSaveResources,
} from '@/lib/storage';

interface MigrationBannerProps {
  onMigrationComplete: (migratedResources: Resource[]) => void;
}

export const MigrationBanner: React.FC<MigrationBannerProps> = ({ onMigrationComplete }) => {
  const [localResources, setLocalResources] = useState<Resource[]>([]);
  const [mounted, setMounted] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setLocalResources(getLocalStoredResources());
  }, []);

  if (!mounted || dismissed || localResources.length === 0) {
    return null;
  }

  // Export JSON backup of local data
  const handleExportBackup = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(localResources, null, 2));
    const downloadAnchor = document.createElement('a');
    const fileName = `resovault-local-storage-backup-${new Date().toISOString().split('T')[0]}.json`;
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Migrate local storage into backend database
  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const itemsToMigrate = localResources.map((r) => ({
        url: r.url,
        title: r.title,
        category: r.category,
        tags: r.tags || [],
        notes: r.notes || '',
        isPinned: Boolean(r.isPinned),
        createdAt: r.createdAt,
      }));

      const saved = await bulkSaveResources(itemsToMigrate);
      markLocalStorageMigrated();
      setStatusMessage(`Successfully migrated ${saved.length} resources into your cloud account!`);
      onMigrationComplete(saved);

      setTimeout(() => {
        setLocalResources([]);
      }, 2500);
    } catch (err: any) {
      setStatusMessage(err.message || 'Failed to migrate resources. Please try again.');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="mb-6 bg-gradient-to-r from-indigo-950/60 via-zinc-900 to-indigo-950/60 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden animate-in fade-in slide-in-from-top-3 duration-300">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400 mt-0.5">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-zinc-100">
                Found {localResources.length} local testing resource{localResources.length !== 1 ? 's' : ''} in your browser
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Browser Storage
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
              Import these links into your backend database so they sync automatically across your phone,
              laptop, and all other devices. Your local data will remain safe.
            </p>
            {statusMessage && (
              <p className="text-xs font-medium text-emerald-400 mt-2 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                {statusMessage}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 pt-2 md:pt-0">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700/80 transition-all"
            title="Download JSON backup file to your computer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup</span>
          </button>

          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-60"
          >
            {migrating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Migrating...</span>
              </>
            ) : (
              <>
                <CloudUpload className="w-3.5 h-3.5" />
                <span>Migrate to Cloud</span>
              </>
            )}
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
            title="Dismiss notice (keeps local data untouched)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
