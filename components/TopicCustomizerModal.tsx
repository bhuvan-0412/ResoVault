'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Sliders, Tag as TagIcon, Plus, Sparkles, Loader2 } from 'lucide-react';

const AVAILABLE_TOPICS = [
  'Technology',
  'AI & Machine Learning',
  'Development',
  'Product Management',
  'Design',
  'Startups & Business',
  'Cybersecurity',
  'Video & Media',
];

interface TopicCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTopics: string[];
  currentKeywords: string[];
  onSaved: (topics: string[], keywords: string[]) => void;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
}

export const TopicCustomizerModal: React.FC<TopicCustomizerModalProps> = ({
  isOpen,
  onClose,
  currentTopics,
  currentKeywords,
  onSaved,
  isAuthenticated,
  onRequireAuth,
}) => {
  const [selectedTopics, setSelectedTopics] = useState<string[]>(currentTopics);
  const [keywords, setKeywords] = useState<string[]>(currentKeywords);
  const [keywordInput, setKeywordInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setSelectedTopics(currentTopics);
    setKeywords(currentKeywords);
    setSavedSuccess(false);
  }, [currentTopics, currentKeywords, isOpen]);

  if (!isOpen) return null;

  const toggleTopic = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      if (selectedTopics.length === 1) return; // keep at least one
      setSelectedTopics(selectedTopics.filter((t) => t !== topic));
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  const handleAddKeyword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = keywordInput.trim().toLowerCase().replace(/^#/, '');
    if (clean && !keywords.includes(clean)) {
      setKeywords([...keywords, clean]);
    }
    setKeywordInput('');
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  const handleSave = async () => {
    if (!isAuthenticated) {
      onClose();
      onRequireAuth();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/news/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: selectedTopics,
          customKeywords: keywords,
        }),
      });

      if (res.ok) {
        setSavedSuccess(true);
        onSaved(selectedTopics, keywords);
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (err) {
      console.error('Error saving topics:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Personalize Your Digest</h3>
              <p className="text-xs text-zinc-400">Select domains &amp; keywords for your curated daily digest.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Topics Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2.5">
              Core Topics &amp; Domains
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_TOPICS.map((topic) => {
                const isSelected = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all text-left ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500/50 text-indigo-200 shadow-sm'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <span>{topic}</span>
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                        isSelected ? 'bg-indigo-600 text-white' : 'border border-zinc-700'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Keywords Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Custom Focus Keywords
              </label>
              <span className="text-[11px] text-zinc-500">Boost articles containing these terms</span>
            </div>
            <form onSubmit={handleAddKeyword} className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="e.g. react, nextjs, figma, deepseek..."
                  className="w-full px-3.5 py-2 bg-zinc-950 text-zinc-100 placeholder-zinc-500 text-xs rounded-xl border border-zinc-800 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>

            {/* Keyword Badges */}
            {keywords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 text-indigo-300 border border-zinc-700/60 text-xs"
                  >
                    <TagIcon className="w-3 h-3 text-indigo-400" />
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="hover:text-rose-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">No custom keywords added yet.</p>
            )}
          </div>

          {/* Engagement Weighting Note */}
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Smart Recommendation:</strong> Articles in topics you frequently click will be automatically
              given priority in your daily digest over time.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Update My Digest</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
