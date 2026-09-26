'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Tag as TagIcon, Folder, Link as LinkIcon, FileText, Check, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { Resource } from '@/lib/types';
import { normalizeUrl, getDomain } from '@/lib/utils';
import { fetchUrlMetadata } from '@/lib/storage';

interface AddEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (resourceData: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'> | Resource) => void;
  existingCategories: string[];
  existingTags: string[];
  editingResource?: Resource | null;
}

export const AddEditModal: React.FC<AddEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingCategories,
  existingTags,
  editingResource,
}) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ url?: string; title?: string }>({});
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);

  // Populate form when editing or resetting
  useEffect(() => {
    if (editingResource) {
      setUrl(editingResource.url);
      setTitle(editingResource.title);
      setCategory(editingResource.category);
      setIsCreatingNewCategory(false);
      setNewCategoryInput('');
      setTags(editingResource.tags || []);
      setNotes(editingResource.notes || '');
    } else {
      setUrl('');
      setTitle('');
      // Default to first category if available or Uncategorized
      setCategory(existingCategories.length > 0 ? existingCategories[0] : 'Work & Projects');
      setIsCreatingNewCategory(false);
      setNewCategoryInput('');
      setTags([]);
      setNotes('');
    }
    setErrors({});
  }, [editingResource, isOpen, existingCategories]);

  if (!isOpen) return null;

  // Auto fetch metadata (Open Graph / YouTube oEmbed)
  const handleAutoFetch = async (targetUrl?: string) => {
    const raw = targetUrl || url;
    const normalized = normalizeUrl(raw);
    if (!normalized || !normalized.includes('.')) return;

    setIsFetchingMeta(true);
    try {
      const meta = await fetchUrlMetadata(normalized);
      if (meta) {
        if (meta.title && (!title.trim() || targetUrl)) {
          setTitle(meta.title);
        }
        if (meta.description && (!notes.trim() || targetUrl)) {
          setNotes(meta.description);
        }
        // Handle failure / generic title gracefully
        if (!meta.isSpecificTitle) {
          setTags((prev) => (prev.includes('needs-review') ? prev : [...prev, 'needs-review']));
        } else {
          setTags((prev) => prev.filter((t) => t !== 'needs-review'));
        }
      } else if (!title.trim()) {
        const domain = getDomain(raw);
        if (domain) {
          const cleanDomain = domain.split('.')[0];
          setTitle(cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1));
          setTags((prev) => (prev.includes('needs-review') ? prev : [...prev, 'needs-review']));
        }
      }
    } catch {
      if (!title.trim()) {
        const domain = getDomain(raw);
        if (domain) {
          const cleanDomain = domain.split('.')[0];
          setTitle(cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1));
          setTags((prev) => (prev.includes('needs-review') ? prev : [...prev, 'needs-review']));
        }
      }
    } finally {
      setIsFetchingMeta(false);
    }
  };

  // Auto suggest title from URL on blur
  const handleUrlBlur = () => {
    if (url.trim() && !title.trim()) {
      handleAutoFetch();
    }
  };

  // Add tag chip
  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim().toLowerCase().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { url?: string; title?: string } = {};

    const normalized = normalizeUrl(url);
    if (!normalized) {
      newErrors.url = 'URL is required';
      setErrors(newErrors);
      return;
    }

    let finalTitle = title.trim();
    let currentTags = [...tags];

    // If title is missing, automatically extract it instead of requiring manual entry
    if (!finalTitle) {
      setIsFetchingMeta(true);
      try {
        const meta = await fetchUrlMetadata(normalized);
        if (meta && meta.title) {
          finalTitle = meta.title.trim();
          if (!meta.isSpecificTitle) {
            if (!currentTags.includes('needs-review')) currentTags.push('needs-review');
          } else {
            currentTags = currentTags.filter((t) => t !== 'needs-review');
          }
        }
      } catch {
        // ignore
      } finally {
        setIsFetchingMeta(false);
      }

      if (!finalTitle) {
        const domain = getDomain(normalized);
        const cleanDomain = domain.split('.')[0] || 'Resource';
        finalTitle = cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1);
        if (!currentTags.includes('needs-review')) currentTags.push('needs-review');
      }
    }

    const finalCategory = isCreatingNewCategory
      ? (newCategoryInput.trim() || 'General')
      : (category.trim() || 'General');

    const resourcePayload = editingResource
      ? {
          ...editingResource,
          url: normalized,
          title: finalTitle,
          category: finalCategory,
          tags: currentTags,
          notes: notes.trim(),
        }
      : {
          url: normalized,
          title: finalTitle,
          category: finalCategory,
          tags: currentTags,
          notes: notes.trim(),
        };

    onSave(resourcePayload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <LinkIcon className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-100">
              {editingResource ? 'Edit Resource' : 'Add New Resource'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* URL Field (Required) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                URL / Link <span className="text-rose-400">*</span>
              </label>
              {url.trim() && (
                <button
                  type="button"
                  onClick={() => handleAutoFetch()}
                  disabled={isFetchingMeta}
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors disabled:opacity-60 cursor-pointer"
                  title="Auto-fetch Title & Notes using Open Graph or YouTube oEmbed"
                >
                  {isFetchingMeta ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Fetching info...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto-fetch info</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={(e) => {
                  const pastedText = e.clipboardData.getData('text');
                  if (pastedText && (!title.trim() || !notes.trim())) {
                    setTimeout(() => handleAutoFetch(pastedText), 50);
                  }
                }}
                onBlur={handleUrlBlur}
                placeholder="e.g. https://youtube.com/watch?v=... or github.com/user/repo"
                className={`w-full px-3.5 py-2.5 bg-zinc-950 text-zinc-100 placeholder-zinc-500 text-base sm:text-sm rounded-xl border ${
                  errors.url ? 'border-rose-500/80 focus:ring-rose-500/20' : 'border-zinc-800 focus:border-indigo-500/80 focus:ring-indigo-500/20'
                } focus:outline-none focus:ring-2 transition-all`}
                autoFocus
              />
              {isFetchingMeta && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                </div>
              )}
            </div>
            {errors.url && (
              <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.url}
              </p>
            )}
          </div>

          {/* Title Field (Auto-extracted or custom) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Title <span className="text-zinc-500 font-normal lowercase">(auto-extracted if left blank)</span>
              </label>
              {isFetchingMeta && (
                <span className="text-xs text-indigo-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Auto-extracting...
                </span>
              )}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Leave blank to auto-fetch, or enter custom title"
              className="w-full px-3.5 py-2.5 bg-zinc-950 text-zinc-100 placeholder-zinc-500 text-base sm:text-sm rounded-xl border border-zinc-800 focus:border-indigo-500/80 focus:ring-indigo-500/20 focus:outline-none focus:ring-2 transition-all"
            />
          </div>

          {/* Category Selector (Existing Dropdown OR Dynamic Custom Category on the fly) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Category
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNewCategory(!isCreatingNewCategory);
                  setNewCategoryInput('');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                {isCreatingNewCategory ? (
                  'Pick from existing list'
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> Type new category
                  </>
                )}
              </button>
            </div>

            {isCreatingNewCategory ? (
              <div className="relative">
                <input
                  type="text"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  placeholder="Enter new category name (e.g. Research, Finance, Books)"
                  className="w-full px-3.5 py-2.5 bg-zinc-950 text-zinc-100 placeholder-zinc-500 text-base sm:text-sm rounded-xl border border-indigo-500/60 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                  autoFocus
                />
              </div>
            ) : (
              <select
                value={category}
                onChange={(e) => {
                  if (e.target.value === '__CREATE_NEW__') {
                    setIsCreatingNewCategory(true);
                    setNewCategoryInput('');
                  } else {
                    setCategory(e.target.value);
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-zinc-950 text-zinc-100 text-base sm:text-sm rounded-xl border border-zinc-800 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all cursor-pointer"
              >
                {existingCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__CREATE_NEW__">+ Create a new category...</option>
              </select>
            )}
          </div>

          {/* Tags Field (Optional, Multi Free-text) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              Tags <span className="text-zinc-500 font-normal lowercase">(optional, press Enter to add)</span>
            </label>
            
            {/* Tag Chips Container */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700/60"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="relative">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Type tag and press Enter (e.g. react, docs, finance)"
                className="w-full px-3.5 py-2.5 bg-zinc-950 text-zinc-100 placeholder-zinc-500 text-base sm:text-sm rounded-xl border border-zinc-800 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
              />
            </div>

            {/* Quick suggested existing tags */}
            {existingTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[11px] text-zinc-500 self-center mr-1">Suggestions:</span>
                {existingTags
                  .filter((t) => !tags.includes(t))
                  .slice(0, 5)
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleAddTag(tag)}
                      className="text-[11px] text-zinc-400 hover:text-indigo-300 bg-zinc-950/80 hover:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-800 transition-colors cursor-pointer"
                    >
                      +{tag}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Notes Field (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              Notes <span className="text-zinc-500 font-normal lowercase">(optional description)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Short note or summary of what this link contains..."
              className="w-full px-3.5 py-2.5 bg-zinc-950 text-zinc-100 placeholder-zinc-500 text-base sm:text-sm rounded-xl border border-zinc-800 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 sm:py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors text-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 sm:py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 active:scale-95 transition-all text-center cursor-pointer"
            >
              {editingResource ? 'Save Changes' : 'Add Resource'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
