'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Send,
  CheckCircle2,
  Calendar,
  Zap,
  AlertCircle,
  Clock,
  MapPin,
  CheckSquare,
  Edit2,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { ParsedCandidateItem, DayOfWeek } from '@/lib/types';

interface NaturalLanguageScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EXAMPLE_PROMPTS = [
  'Gym every MWF 6am to 7:30am at Campus Rec Center',
  'Club meeting Thursdays from 17:00 to 18:30 in Student Union Room 204',
  'Operating Systems lecture every Tuesday & Thursday 10:00 to 11:30 AM',
  'Weekly team sprint planning Mondays 09:30 to 10:30 on Zoom',
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const NaturalLanguageScheduleModal: React.FC<NaturalLanguageScheduleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'input' | 'confirm' | 'success'>('input');
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<ParsedCandidateItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('input');
    setText('');
    setCandidates([]);
    setError(null);
    setSuccessMessage('');
  };

  const handleParse = async (promptToUse?: string) => {
    const query = promptToUse !== undefined ? promptToUse : text;
    if (!query.trim()) {
      setError('Please type or select a description of your commitments');
      return;
    }

    setParsing(true);
    setError(null);

    try {
      const res = await fetch('/api/schedule/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: query.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse text');

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('Could not identify specific commitments from this text. Try specifying a day and time.');
      }

      setCandidates(data.candidates);
      setStep('confirm');
    } catch (err: any) {
      setError(err.message || 'Failed to process natural language input');
    } finally {
      setParsing(false);
    }
  };

  const handleToggleSelect = (index: number) => {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleUpdateCandidate = (index: number, field: keyof ParsedCandidateItem, value: any) => {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleConfirmSave = async () => {
    const selectedItems = candidates.filter((c) => c.selected);
    if (selectedItems.length === 0) {
      setError('Please select at least one item to save');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/schedule/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          items: selectedItems,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save confirmed items');

      setSuccessMessage(data.message || 'Successfully saved commitments to your schedule!');
      setStep('success');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save items');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                Natural Language Schedule Parser
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
                  {step === 'input' ? 'Step 1: Input' : step === 'confirm' ? 'Step 2: Confirm' : 'Complete'}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                {step === 'confirm'
                  ? 'Review & edit parsed commitments before saving'
                  : 'Type your weekly commitments in plain English'}
              </p>
            </div>
          </div>
          <button
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
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: FREE-TEXT INPUT */}
          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Type what you have going on this week:
                </label>
                <textarea
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. gym every MWF 6am, club meeting Thursdays at 5pm in student hall, study group Sundays 2pm..."
                  className="w-full p-3.5 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none"
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold text-zinc-400 mb-2 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Quick sample inputs (click to try):
                </p>
                <div className="space-y-1.5">
                  {EXAMPLE_PROMPTS.map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setText(ex);
                        handleParse(ex);
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-zinc-950/70 hover:bg-zinc-800/80 border border-zinc-800/80 text-xs text-zinc-300 transition-all group flex items-start gap-2"
                    >
                      <span className="text-indigo-400 font-mono">→</span>
                      <span>&ldquo;{ex}&rdquo;</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CONFIRMATION & EDIT SCREEN */}
          {step === 'confirm' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-semibold text-zinc-300">
                  Parsed Commitments ({candidates.filter((c) => c.selected).length} selected)
                </span>
                <span className="text-[11px] text-zinc-500">
                  Uncheck to discard, or edit details inline:
                </span>
              </div>

              <div className="space-y-2.5">
                {candidates.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      item.selected
                        ? 'bg-zinc-950/90 border-indigo-500/40 shadow-sm'
                        : 'bg-zinc-950/40 border-zinc-800/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => handleToggleSelect(idx)}
                        className="mt-1 h-4 w-4 rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />

                      {/* Item Details */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateCandidate(idx, 'title', e.target.value)}
                            placeholder="Commitment title"
                            className="flex-1 px-2.5 py-1 text-xs font-semibold bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-100 focus:outline-none focus:border-indigo-500"
                          />
                          <select
                            value={item.type}
                            onChange={(e) => handleUpdateCandidate(idx, 'type', e.target.value)}
                            className="px-2 py-1 text-[11px] font-medium bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-300 focus:outline-none"
                          >
                            <option value="class">Fixed Class</option>
                            <option value="task">One-Off Task</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {/* Day */}
                          <div>
                            <select
                              value={item.dayOfWeek}
                              onChange={(e) =>
                                handleUpdateCandidate(idx, 'dayOfWeek', parseInt(e.target.value, 10))
                              }
                              className="w-full px-2 py-1 text-[11px] bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-300 focus:outline-none"
                            >
                              {DAY_NAMES.map((name, dIdx) => (
                                <option key={dIdx} value={dIdx}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Start Time */}
                          <div>
                            <input
                              type="time"
                              value={item.startTime}
                              onChange={(e) => handleUpdateCandidate(idx, 'startTime', e.target.value)}
                              className="w-full px-2 py-1 text-[11px] bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-300 focus:outline-none"
                            />
                          </div>

                          {/* End Time */}
                          <div>
                            <input
                              type="time"
                              value={item.endTime}
                              onChange={(e) => handleUpdateCandidate(idx, 'endTime', e.target.value)}
                              className="w-full px-2 py-1 text-[11px] bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-300 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                          <input
                            type="text"
                            value={item.location || ''}
                            onChange={(e) => handleUpdateCandidate(idx, 'location', e.target.value)}
                            placeholder="Location (e.g. Gym, Room 204, Zoom)"
                            className="w-full px-2 py-0.5 text-[11px] bg-zinc-900 rounded border border-zinc-800 text-zinc-300 placeholder-zinc-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS CONFIRMATION */}
          {step === 'success' && (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-zinc-100">{successMessage}</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                All reviewed items have been saved. Your timetable and daily schedule generator will incorporate these slots immediately.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          {step === 'input' && (
            <>
              <p className="text-[11px] text-zinc-500">
                You will get to review &amp; edit before anything is saved
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
                  disabled={parsing || !text.trim()}
                  onClick={() => handleParse()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {parsing ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Parsing...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Parse Commitments</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <button
                type="button"
                onClick={() => setStep('input')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Back to edit text</span>
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
                  disabled={saving || candidates.filter((c) => c.selected).length === 0}
                  onClick={handleConfirmSave}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Save Confirmed ({candidates.filter((c) => c.selected).length})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Done &amp; View Schedule
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
