'use client';

import React, { useState } from 'react';
import { X, Sparkles, Send, CheckCircle2, Calendar, Zap, AlertCircle } from 'lucide-react';

interface NaturalLanguageScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EXAMPLE_PROMPTS = [
  "I have Distributed Systems lecture every Tuesday & Thursday from 10:00 to 11:30 AM, and I'm a night owl who loves working out in the evening.",
  "Gym workout every Monday, Wednesday, and Friday from 17:30 to 19:00. I wake up early at 7 AM and focus best in the morning.",
  "I have a weekly product review meeting every Monday from 14:00 to 15:30. Prefer 50-minute deep work focus intervals.",
];

export const NaturalLanguageScheduleModal: React.FC<NaturalLanguageScheduleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<{ message: string; addedEventsCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParse = async (promptToUse?: string) => {
    const query = promptToUse !== undefined ? promptToUse : text;
    if (!query.trim()) {
      setError('Please type or select a description of your schedule or habits');
      return;
    }

    setParsing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/schedule/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: query.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse text');

      setResult({
        message: data.message || 'Successfully parsed commitments and habits!',
        addedEventsCount: data.addedEvents ? data.addedEvents.length : 0,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to process natural language input');
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                AI Natural Language Assistant
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
                  Smart Parser
                </span>
              </h3>
              <p className="text-xs text-zinc-400">Describe your routine, classes, or habits in plain English</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{result.message}</span>
              </div>
              <p className="text-zinc-400 text-[11px] pl-6">
                Your timetable generator will now incorporate these habits and recurring slots automatically.
              </p>
            </div>
          )}

          {/* Text Area */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Describe your routine, commitments, or chronotype:
            </label>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. I have AI lecture every Tuesday and Thursday from 11:00 to 12:30. I'm a night owl who sleeps around 1 AM and likes working out in the evening..."
              className="w-full p-3 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none"
            />
          </div>

          {/* Example Prompts */}
          <div>
            <p className="text-[11px] font-semibold text-zinc-400 mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Try one of these examples:
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
                  className="w-full text-left p-2 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/80 border border-zinc-800/80 text-xs text-zinc-300 transition-all group"
                >
                  <span className="text-indigo-400 group-hover:text-indigo-300 font-mono mr-1.5">→</span>
                  &ldquo;{ex}&rdquo;
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <p className="text-[11px] text-zinc-500">
            Powered by ML • Auto-extracts commitments &amp; preferences
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Close
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
                  <span>Parse &amp; Apply</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
