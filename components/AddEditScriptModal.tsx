'use client';

import React, { useState } from 'react';
import { X, AlertCircle, Clock, FileText, Tag, CheckCircle2 } from 'lucide-react';
import { NewScriptInput, ScriptItem, ScriptStatus } from '@/lib/types';
import {
  formatScriptMetrics,
  fromDateInputValue,
  SCRIPT_STATUS_CONFIG,
  SCRIPT_STATUS_ORDER,
  toDateInputValue,
} from '@/lib/scripts-utils';

interface AddEditScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (scriptData: NewScriptInput | (NewScriptInput & { id: string })) => Promise<void>;
  editingScript: ScriptItem | null;
}

const ScriptForm: React.FC<Omit<AddEditScriptModalProps, 'isOpen'>> = ({
  onClose,
  onSave,
  editingScript,
}) => {
  const [title, setTitle] = useState(editingScript?.title || '');
  const [body, setBody] = useState(editingScript?.body || '');
  const [status, setStatus] = useState<ScriptStatus>(editingScript?.status || 'needs_corrections');
  const [correctionsNote, setCorrectionsNote] = useState(editingScript?.correctionsNote || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(editingScript?.tags || []);
  const [shotOn, setShotOn] = useState(toDateInputValue(editingScript?.shotAt));
  const [postedOn, setPostedOn] = useState(toDateInputValue(editingScript?.postedAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { words, speakingTime } = formatScriptMetrics(body);

  const handleAddTag = () => {
    const clean = tagInput.trim().toLowerCase().replace(/^[#,\s]+/, '');
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for the script.');
      return;
    }
    if (!body.trim()) {
      setError('Please provide script content / body text.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Blank date = "now" for a newly entered stage; existing dates are kept
      const showsShot = status === 'shot' || status === 'posted';
      const shotAt = showsShot && shotOn ? fromDateInputValue(shotOn) : undefined;
      const postedAt = status === 'posted' && postedOn ? fromDateInputValue(postedOn) : undefined;

      const scriptPayload: NewScriptInput = {
        title: title.trim(),
        body: body.trim(),
        status,
        correctionsNote: correctionsNote.trim() || null,
        tags,
        ...(shotAt ? { shotAt } : {}),
        ...(postedAt ? { postedAt } : {}),
      };

      await onSave(editingScript ? { ...scriptPayload, id: editingScript.id } : scriptPayload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save script');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">
                {editingScript ? 'Edit Video Script' : 'Add New Video Script'}
              </h3>
              <p className="text-xs text-zinc-400">
                Draft, refine, and track production status
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title & Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Script Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 5 Habits That Ruined My Focus (And How I Fixed Them)"
                className="w-full px-3.5 py-2 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Production Stage
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ScriptStatus)}
                className="w-full px-3 py-2 text-xs font-medium bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-200 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
              >
                {SCRIPT_STATUS_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {SCRIPT_STATUS_CONFIG[st].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Shot / Posted dates (backfill old videos) */}
          {(status === 'shot' || status === 'posted') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="script-shot-on" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Shot on
                </label>
                <input
                  id="script-shot-on"
                  type="date"
                  value={shotOn}
                  onChange={(e) => setShotOn(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                />
              </div>
              {status === 'posted' && (
                <div>
                  <label htmlFor="script-posted-on" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Posted on
                  </label>
                  <input
                    id="script-posted-on"
                    type="date"
                    value={postedOn}
                    onChange={(e) => setPostedOn(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>
              )}
              <p className="sm:col-span-2 -mt-1 text-[11px] text-zinc-500">
                Leave blank to use today. Set an earlier date to backfill old videos.
              </p>
            </div>
          )}

          {/* Script Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Script Body <span className="text-red-400">*</span>
              </label>
              <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-indigo-400" />
                <span>{words} words · {speakingTime} speaking</span>
              </span>
            </div>
            <textarea
              required
              rows={9}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Paste or write your full video script here. Include hooks, transitions, and calls-to-action..."
              className="w-full p-3.5 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-y font-mono leading-relaxed"
            />
          </div>

          {/* Corrections Note (Always accessible, highlighted when Needs Corrections) */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            status === 'needs_corrections'
              ? 'bg-amber-500/5 border-amber-500/30'
              : 'bg-zinc-950/40 border-zinc-800/80'
          }`}>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertCircle className={`w-3.5 h-3.5 ${status === 'needs_corrections' ? 'text-amber-400' : 'text-zinc-400'}`} />
                <span>Notes (what still needs work?)</span>
              </span>
              {status === 'needs_corrections' && (
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                  Shown on card
                </span>
              )}
            </label>
            <textarea
              rows={2}
              value={correctionsNote}
              onChange={(e) => setCorrectionsNote(e.target.value)}
              placeholder="e.g. Re-write the 3rd hook; check the stats on line 12; shorten the sponsor segue..."
              className="w-full p-2.5 text-xs bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-zinc-400" />
              <span>Tags</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag and press Enter (e.g. reel, tutorial, finance)..."
                className="flex-1 px-3 py-1.5 text-xs bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Add Tag
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-zinc-800 border border-zinc-700 text-zinc-300"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/60">
          <div className="text-[11px] text-zinc-500">
            {editingScript ? 'Changes save directly to your cloud vault' : 'Will be organized into your scripts board'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !title.trim() || !body.trim()}
              onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{editingScript ? 'Update Script' : 'Save Script'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AddEditScriptModal: React.FC<AddEditScriptModalProps> = ({ isOpen, ...rest }) => {
  if (!isOpen) return null;
  // Keyed so the form starts fresh each time it opens or switches script
  return <ScriptForm key={rest.editingScript?.id ?? 'new'} {...rest} />;
};
