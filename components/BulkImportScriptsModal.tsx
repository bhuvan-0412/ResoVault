'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Zap,
  CheckSquare,
  Square,
  ArrowRight,
  Info,
} from 'lucide-react';
import { ScriptItem, ScriptStatus } from '@/lib/types';
import { formatScriptMetrics, SCRIPT_STATUS_CONFIG, SCRIPT_STATUS_ORDER } from '@/lib/scripts-utils';

interface BulkImportScriptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (scripts: Omit<ScriptItem, 'id' | 'createdAt' | 'updatedAt' | 'shotAt' | 'postedAt'>[]) => Promise<void>;
}

interface ParsedCandidateScript {
  id: string;
  title: string;
  body: string;
  status: ScriptStatus;
  correctionsNote?: string;
  tags: string[];
  selected: boolean;
}

const SAMPLE_DUMP = `---
Script 1: 3 Mistakes Beginners Make with Video Lighting
Stop putting your key light directly in front of your face. It flattens all dimension and makes you look like a webcam potato.
Instead, move your main light 45 degrees to the left or right, and slightly higher than eye level pointing down.
Add a warm backlight behind your opposite shoulder to separate yourself from the background.
Comment "LIGHT" and I'll send you my complete $50 studio setup guide!

---
Script 2: How I Write 10 Scripts in Under 60 Minutes
Batching is the only way creators survive.
First, spend 10 minutes gathering 10 raw hooks from viral videos in your niche.
Second, spend 30 minutes filling in the 3-step value meat for each hook.
Third, spend 20 minutes drafting strong CTAs.
Never write and shoot on the same day. Write on Monday, batch shoot on Wednesday.

---
Script 3: The Secret to High Audio Quality on Mobile
Your built-in phone mic is actually decent, but only if you are within 12 inches of the phone.
If you're sitting further away in an untreated room with reverb, sound bounces everywhere.
Grab a cheap $20 lavalier mic or hang a thick blanket right outside the camera frame to kill echoes.
Follow for daily video production hacks.`;

export const BulkImportScriptsModal: React.FC<BulkImportScriptsModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);
  const [methodUsed, setMethodUsed] = useState<'llm' | 'heuristic' | null>(null);
  const [candidates, setCandidates] = useState<ParsedCandidateScript[]>([]);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('input');
    setRawText('');
    setCandidates([]);
    setError(null);
    setInfoBanner(null);
    setMethodUsed(null);
  };

  const handleParse = async (textToUse?: string) => {
    const textToSubmit = textToUse !== undefined ? textToUse : rawText;
    if (!textToSubmit.trim()) {
      setError('Please paste script text into the box.');
      return;
    }

    setParsing(true);
    setError(null);
    setInfoBanner(null);

    try {
      const res = await fetch('/api/scripts/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: textToSubmit }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to split scripts');
      }

      if (!data.scripts || data.scripts.length === 0) {
        throw new Error('No scripts could be extracted from the text.');
      }

      setCandidates(
        data.scripts.map((s: any, idx: number) => ({
          id: s.id || `candidate_${Date.now()}_${idx}`,
          title: s.title || `Script ${idx + 1}`,
          body: s.body || '',
          status: (s.status as ScriptStatus) || 'needs_corrections',
          correctionsNote: s.correctionsNote || '',
          tags: Array.isArray(s.tags) ? s.tags : ['imported'],
          selected: true,
        }))
      );
      setMethodUsed(data.method || 'heuristic');
      setInfoBanner(data.message || null);
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Error occurred while splitting scripts.');
    } finally {
      setParsing(false);
    }
  };

  const handleToggleSelectAll = (selectAll: boolean) => {
    setCandidates((prev) => prev.map((c) => ({ ...c, selected: selectAll })));
  };

  const handleBatchSetStatus = (newStatus: ScriptStatus) => {
    setCandidates((prev) =>
      prev.map((c) => (c.selected ? { ...c, status: newStatus } : c))
    );
  };

  const handleUpdateCandidate = (
    index: number,
    field: keyof ParsedCandidateScript,
    value: any
  ) => {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleConfirmSave = async () => {
    const selectedItems = candidates.filter((c) => c.selected);
    if (selectedItems.length === 0) {
      setError('Please select at least one script to import.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const itemsToSave = selectedItems.map((c) => ({
        title: c.title.trim() || 'Untitled Script',
        body: c.body,
        status: c.status,
        correctionsNote: c.correctionsNote?.trim() || null,
        tags: c.tags,
      }));

      await onImportSuccess(itemsToSave);
      handleReset();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save imported scripts to database.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = candidates.filter((c) => c.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                Bulk Import Scripts from Notepad
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  {step === 'input' ? 'Step 1: Paste Text' : `Step 2: Review (${selectedCount} selected)`}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                {step === 'input'
                  ? 'Paste raw script dumps. Preserves your exact wording with zero rewriting.'
                  : 'Review detected scripts, edit titles or body inline, and set production status'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: RAW INPUT */}
          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Paste raw script dump from Notepad or Notes:
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    Separators like <code className="text-zinc-300 bg-black/40 px-1 rounded">---</code>, <code className="text-zinc-300 bg-black/40 px-1 rounded">Script 1</code>, or blank lines supported
                  </span>
                </div>
                <textarea
                  rows={12}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste your big batch of video scripts here...&#10;&#10;---&#10;Script 1: Hook and body text...&#10;&#10;---&#10;Script 2: Another script..."
                  className="w-full p-4 text-xs sm:text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono leading-relaxed"
                />
              </div>

              {/* Exact wording guarantee note */}
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Zero Rewriting Guarantee:</strong> The parser will split separate scripts and suggest titles for each. Your script text will NEVER be edited, shortened, or hallucinated.
                </div>
              </div>

              {/* Sample loader */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setRawText(SAMPLE_DUMP);
                  }}
                  className="text-xs text-zinc-400 hover:text-indigo-400 underline transition-colors cursor-pointer"
                >
                  Click here to load a 3-script sample dump to test
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & CONFIRM */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Info banner about method used */}
              {infoBanner && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  methodUsed === 'llm'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-zinc-800/80 border-zinc-700/80 text-zinc-300'
                }`}>
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
                  <span className="leading-relaxed">{infoBanner}</span>
                </div>
              )}

              {/* Batch toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(selectedCount !== candidates.length)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {selectedCount === candidates.length ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-500" />
                    )}
                    <span>
                      {selectedCount === candidates.length ? 'Deselect All' : 'Select All'} ({selectedCount}/{candidates.length})
                    </span>
                  </button>
                </div>

                {/* Batch status dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 shrink-0">Set status for selected:</span>
                  <select
                    onChange={(e) => handleBatchSetStatus(e.target.value as ScriptStatus)}
                    defaultValue=""
                    className="px-2.5 py-1 text-xs font-semibold bg-zinc-900 rounded-lg border border-zinc-700 text-zinc-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="" disabled>Choose Batch Status...</option>
                    {SCRIPT_STATUS_ORDER.map((st) => (
                      <option key={st} value={st}>
                        {SCRIPT_STATUS_CONFIG[st].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cards List */}
              <div className="space-y-4">
                {candidates.map((item, idx) => {
                  const { words, speakingTime } = formatScriptMetrics(item.body);
                  const statusConf = SCRIPT_STATUS_CONFIG[item.status];

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all ${
                        item.selected
                          ? 'bg-zinc-950/90 border-indigo-500/40 shadow-sm'
                          : 'bg-zinc-950/30 border-zinc-800/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleUpdateCandidate(idx, 'selected', !item.selected)}
                          className="mt-1 text-zinc-400 hover:text-indigo-400 transition-colors cursor-pointer"
                        >
                          {item.selected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-600" />
                          )}
                        </button>

                        {/* Script Editor */}
                        <div className="flex-1 space-y-2.5 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex-1 flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-500 font-mono">
                                #{idx + 1}
                              </span>
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => handleUpdateCandidate(idx, 'title', e.target.value)}
                                placeholder="Script title..."
                                className="flex-1 px-2.5 py-1 text-xs font-bold bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-100 focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={item.status}
                                onChange={(e) =>
                                  handleUpdateCandidate(idx, 'status', e.target.value as ScriptStatus)
                                }
                                className={`px-2 py-1 text-xs font-semibold rounded-lg border bg-zinc-900 ${statusConf.badgeText} border-zinc-800 focus:outline-none cursor-pointer`}
                              >
                                {SCRIPT_STATUS_ORDER.map((st) => (
                                  <option key={st} value={st}>
                                    {SCRIPT_STATUS_CONFIG[st].label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Body Textarea */}
                          <div>
                            <textarea
                              rows={4}
                              value={item.body}
                              onChange={(e) => handleUpdateCandidate(idx, 'body', e.target.value)}
                              className="w-full p-2.5 text-xs bg-zinc-900/90 rounded-lg border border-zinc-800 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                            />
                            <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-1 font-mono">
                              <span>{words} words · {speakingTime} speaking</span>
                              <span>{item.body.split('\n').length} line(s)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 shrink-0">
          {step === 'input' ? (
            <>
              <p className="text-[11px] text-zinc-500">
                You will review each detected script before anything is saved
              </p>
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
                  disabled={parsing || !rawText.trim()}
                  onClick={() => handleParse()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {parsing ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Splitting Scripts...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Split &amp; Review</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('input')}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Back to Raw Input</span>
              </button>
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
                  disabled={saving || selectedCount === 0}
                  onClick={handleConfirmSave}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving to Vault...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Import Confirmed ({selectedCount})</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
