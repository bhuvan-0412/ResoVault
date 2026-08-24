'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  Sparkles,
  Check,
  AlertTriangle,
  Key,
  Folder,
  Tag as TagIcon,
  Globe,
  Loader2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Resource } from '@/lib/types';
import { normalizeUrl, getDomain, getDomainType } from '@/lib/utils';

interface BulkImportItem {
  id: string;
  url: string;
  title: string;
  category: string;
  tags: string[];
  notes?: string;
  isDuplicate: boolean;
  selected: boolean;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingResources: Resource[];
  existingCategories: string[];
  onSaveBulk: (newResources: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  existingResources,
  existingCategories,
  onSaveBulk,
}) => {
  const [step, setStep] = useState<'input' | 'processing' | 'review'>('input');
  const [rawText, setRawText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'gemini' | 'anthropic' | 'openai' | 'auto'>('auto');
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Review table items
  const [reviewItems, setReviewItems] = useState<BulkImportItem[]>([]);

  // Load saved API Key from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('resource_hub_user_llm_key');
      const savedProvider = localStorage.getItem('resource_hub_user_llm_provider');
      if (savedKey) setApiKey(savedKey);
      if (savedProvider) setProvider(savedProvider as any);
    }
  }, []);

  if (!isOpen) return null;

  // Save API key preference locally
  const handleSaveApiKey = (keyVal: string, providerVal: any) => {
    setApiKey(keyVal);
    setProvider(providerVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('resource_hub_user_llm_key', keyVal);
      localStorage.setItem('resource_hub_user_llm_provider', providerVal);
    }
  };

  // Process text and extract links
  const handleExtractAndAnalyze = async () => {
    if (!rawText.trim()) {
      setErrorMsg('Please paste text containing web links to parse.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);
    setStep('processing');

    try {
      const res = await fetch('/api/bulk-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          existingCategories,
          apiKey,
          provider,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setErrorMsg(json.error || 'Failed to process links.');
        setStep('input');
        setLoading(false);
        return;
      }

      const parsedList = json.data || [];

      // Check duplicates against existing resources in the hub
      const existingUrlSet = new Set(
        existingResources.map((r) => normalizeUrl(r.url).toLowerCase())
      );

      const items: BulkImportItem[] = parsedList.map((item: any, idx: number) => {
        const normUrl = normalizeUrl(item.url);
        const isDup = existingUrlSet.has(normUrl.toLowerCase());

        return {
          id: `bulk-${idx}-${Date.now()}`,
          url: normUrl,
          title: item.title || getDomain(normUrl),
          category: item.category || (existingCategories[0] || 'Work & Projects'),
          tags: Array.isArray(item.tags) ? item.tags : [],
          notes: item.notes || '',
          isDuplicate: isDup,
          selected: !isDup, // Default checked if new, unchecked if duplicate
        };
      });

      setReviewItems(items);
      setStep('review');
    } catch (err) {
      console.error('Error in bulk import analysis:', err);
      setErrorMsg('Network error while processing links. Please try again.');
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  // Review table item mutations
  const handleToggleSelectAll = (selectAll: boolean) => {
    setReviewItems(reviewItems.map((item) => ({ ...item, selected: selectAll })));
  };

  const handleToggleRowSelect = (id: string) => {
    setReviewItems(
      reviewItems.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleUpdateRowField = (id: string, field: keyof BulkImportItem, value: any) => {
    setReviewItems(
      reviewItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveAllSelected = () => {
    const selected = reviewItems.filter((i) => i.selected);
    if (selected.length === 0) return;

    const payload = selected.map((item) => ({
      url: item.url,
      title: item.title,
      category: item.category,
      tags: item.tags,
      notes: item.notes,
    }));

    onSaveBulk(payload);
    onClose();
  };

  const selectedCount = reviewItems.filter((i) => i.selected).length;
  const duplicateCount = reviewItems.filter((i) => i.isDuplicate).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-100">AI Bulk Import</h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Fast Batch
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Paste raw chat text or link lists — auto-scraped &amp; AI categorized in seconds.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {step === 'input' && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  apiKey
                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                }`}
                title="AI Key Settings"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{apiKey ? 'AI Key Saved' : 'AI Settings'}</span>
                {showSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* STEP 1: RAW TEXTINPUT VIEW */}
        {step === 'input' && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            
            {/* Optional AI Key Settings Drawer */}
            {showSettings && (
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    LLM API Key Configuration (Optional)
                  </span>
                  <span className="text-[11px] text-zinc-500">Saved locally in browser</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => handleSaveApiKey(e.target.value, provider)}
                      placeholder="Paste Gemini, Anthropic Claude, or OpenAI API key..."
                      className="w-full px-3 py-2 bg-zinc-900 text-zinc-100 text-xs rounded-lg border border-zinc-800 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <select
                      value={provider}
                      onChange={(e) => handleSaveApiKey(apiKey, e.target.value as any)}
                      className="w-full px-3 py-2 bg-zinc-900 text-zinc-100 text-xs rounded-lg border border-zinc-800 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="auto">Auto Detect Key</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="openai">OpenAI GPT-4o</option>
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400">
                  💡 Note: If no API key is entered, the app automatically uses smart domain rules to categorize links instantly.
                </p>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Paste Raw Unstructured Text
              </label>
              <textarea
                rows={10}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Paste WhatsApp chats, emails, or link lists here...\n\nExample:\nHey! Check out this React documentation: https://github.com/facebook/react\nHere is our Q3 project drive: https://drive.google.com/drive/folders/...\nAlso read this styling guide: https://tailwindcss.com/docs`}
                className="w-full px-4 py-3 bg-zinc-950 text-zinc-100 placeholder-zinc-500 text-sm rounded-xl border border-zinc-800 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all resize-none font-mono"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-zinc-500">
                Supports WhatsApp text, Slack messages, emails, or raw URL lists.
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExtractAndAnalyze}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 active:scale-95 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  Extract &amp; Analyze Links
                </button>
              </div>
            </div>

          </div>
        )}

        {/* STEP 2: PROCESSING STATE */}
        {step === 'processing' && (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-4 flex-1">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 animate-pulse">
                <Sparkles className="w-8 h-8" />
              </div>
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin absolute -top-2 -right-2" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Extracting &amp; Analyzing Links...</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                Fetching web titles in parallel, checking for duplicates, and applying AI categories.
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: INTERACTIVE REVIEW TABLE */}
        {step === 'review' && (
          <div className="flex flex-col flex-1 min-h-0">
            
            {/* Review Header Banner */}
            <div className="px-6 py-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-zinc-300">
                  Extracted <strong className="text-white">{reviewItems.length}</strong> links
                </span>
                {duplicateCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-medium">
                    <AlertTriangle className="w-3 h-3" /> {duplicateCount} duplicate(s) flagged (unchecked)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleSelectAll(true)}
                  className="text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Select All
                </button>
                <span className="text-zinc-600">•</span>
                <button
                  onClick={() => handleToggleSelectAll(false)}
                  className="text-zinc-400 hover:text-zinc-200 font-medium"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Scrollable Table */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {reviewItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    item.selected
                      ? 'bg-zinc-900 border-zinc-700/80 shadow-md'
                      : 'bg-zinc-950/60 border-zinc-800/60 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleRowSelect(item.id)}
                      className="mt-1 text-indigo-400 hover:text-indigo-300 transition-colors shrink-0"
                    >
                      {item.selected ? (
                        <CheckSquare className="w-5 h-5 fill-indigo-600/20 text-indigo-400" />
                      ) : (
                        <Square className="w-5 h-5 text-zinc-600" />
                      )}
                    </button>

                    {/* Content Fields */}
                    <div className="flex-1 min-w-0 space-y-2">
                      
                      {/* URL & Duplicate Badge Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Globe className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="text-xs text-zinc-400 truncate" title={item.url}>
                            {item.url}
                          </span>
                        </div>
                        {item.isDuplicate && (
                          <span className="px-2 py-0.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md shrink-0">
                            Already in Hub
                          </span>
                        )}
                      </div>

                      {/* Editable Title, Category & Tags Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        
                        {/* Title Input */}
                        <div className="sm:col-span-5">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateRowField(item.id, 'title', e.target.value)}
                            placeholder="Resource Title"
                            className="w-full px-2.5 py-1.5 bg-zinc-950 text-zinc-100 text-xs rounded-lg border border-zinc-800 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>

                        {/* Category Dropdown */}
                        <div className="sm:col-span-4">
                          <select
                            value={item.category}
                            onChange={(e) => handleUpdateRowField(item.id, 'category', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-zinc-950 text-zinc-100 text-xs rounded-lg border border-zinc-800 focus:border-indigo-500 focus:outline-none"
                          >
                            {existingCategories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                            {!existingCategories.includes(item.category) && (
                              <option value={item.category}>+ {item.category} (New)</option>
                            )}
                          </select>
                        </div>

                        {/* Tags Input (comma separated) */}
                        <div className="sm:col-span-3">
                          <input
                            type="text"
                            value={item.tags.join(', ')}
                            onChange={(e) =>
                              handleUpdateRowField(
                                item.id,
                                'tags',
                                e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
                              )
                            }
                            placeholder="Tags (comma sep)"
                            className="w-full px-2.5 py-1.5 bg-zinc-950 text-zinc-100 text-xs rounded-lg border border-zinc-800 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>

                      </div>

                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer Bar */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                ← Back to Raw Text
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={handleSaveAllSelected}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    selectedCount > 0
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/25 active:scale-95'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  Save Selected ({selectedCount} Links)
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
