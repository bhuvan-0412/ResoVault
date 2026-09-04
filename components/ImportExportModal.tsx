'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, X, Check, FileJson, AlertCircle, Trash2, RefreshCw, Database, CloudUpload } from 'lucide-react';
import { Resource } from '@/lib/types';
import {
  INITIAL_RESOURCES,
} from '@/lib/utils';
import {
  getLocalStoredResources,
  markLocalStorageMigrated,
  clearLocalStoredResources,
} from '@/lib/storage';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  resources: Resource[];
  onImport: (importedResources: Resource[]) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  resources,
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [localStoredItems, setLocalStoredItems] = useState<Resource[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLocalStoredItems(getLocalStoredResources());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Export current account resources JSON file
  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(resources, null, 2));
    const downloadAnchor = document.createElement('a');
    const fileName = `resovault-backup-${new Date().toISOString().split('T')[0]}.json`;
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export local storage JSON file
  const handleExportLocalStorage = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(localStoredItems, null, 2));
    const downloadAnchor = document.createElement('a');
    const fileName = `resovault-local-storage-backup-${new Date().toISOString().split('T')[0]}.json`;
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Migrate local storage resources into account
  const handleMigrateLocalStorage = () => {
    if (localStoredItems.length === 0) return;
    onImport(localStoredItems);
    markLocalStorageMigrated();
    setImportStatus(`Migrated ${localStoredItems.length} local storage items to your account!`);
    setErrorStatus(null);
    setTimeout(() => {
      setImportStatus(null);
      onClose();
    }, 1500);
  };

  // Import JSON file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          onImport(parsed);
          setImportStatus(`Successfully restored ${parsed.length} resources!`);
          setErrorStatus(null);
          setTimeout(() => {
            setImportStatus(null);
            onClose();
          }, 1500);
        } else {
          setErrorStatus('Invalid JSON format: expected an array of resources.');
        }
      } catch (err) {
        setErrorStatus('Error parsing JSON file. Please ensure it is valid.');
      }
    };
    reader.readAsText(file);
  };

  // Clear all demo data
  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear ALL resources and start with a completely empty hub?')) {
      onImport([]);
      setImportStatus('Cleared all resources.');
      setTimeout(() => {
        setImportStatus(null);
        onClose();
      }, 1500);
    }
  };

  // Reset to initial sample data
  const handleResetDemoData = () => {
    if (confirm('Reset resource hub to default sample links?')) {
      onImport(INITIAL_RESOURCES);
      setImportStatus('Reset to initial sample data.');
      setTimeout(() => {
        setImportStatus(null);
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <FileJson className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100">Backup &amp; Migration Tools</h3>
            <p className="text-xs text-zinc-400">Export, import, or migrate local test data into your account.</p>
          </div>
        </div>

        {importStatus && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" />
            {importStatus}
          </div>
        )}

        {errorStatus && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {errorStatus}
          </div>
        )}

        <div className="space-y-3 mb-6">
          {/* Local Storage Migration Section (if local items exist) */}
          {localStoredItems.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-zinc-900 to-indigo-950/40 border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-zinc-200">Local Browser Storage</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
                  {localStoredItems.length} items
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                You have testing data sitting in your browser. Migrate it to your account so it syncs across all devices, or export it to a file.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleMigrateLocalStorage}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <CloudUpload className="w-3.5 h-3.5" /> Migrate to Account
                </button>
                <button
                  onClick={handleExportLocalStorage}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Export Local
                </button>
              </div>
            </div>
          )}

          {/* Export Button */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-zinc-200">Export Cloud Resources</div>
              <div className="text-[11px] text-zinc-400">Download all {resources.length} resources as JSON</div>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium border border-zinc-700 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>

          {/* Import Button */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-zinc-200">Restore from JSON File</div>
              <div className="text-[11px] text-zinc-400">Upload and merge resources from a `.json` backup file</div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all"
            >
              <Upload className="w-3.5 h-3.5" /> Import
            </button>
          </div>

          {/* Clear All / Reset Options */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
            <div className="text-xs font-semibold text-zinc-300">Data Management</div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleClearAll}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Account Resources
              </button>
              <button
                onClick={handleResetDemoData}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Load Starter Links
              </button>
            </div>
          </div>

        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
