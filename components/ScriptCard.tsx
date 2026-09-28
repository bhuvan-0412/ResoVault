'use client';

import React from 'react';
import {
  Clock,
  AlertCircle,
  ChevronRight,
  MoreVertical,
  Edit2,
  Trash2,
  Tag,
  CheckCircle2,
  Clapperboard,
  Sparkles,
  Share2,
} from 'lucide-react';
import { ScriptItem, ScriptStatus } from '@/lib/types';
import {
  formatScriptMetrics,
  SCRIPT_STATUS_CONFIG,
  SCRIPT_STATUS_ORDER,
} from '@/lib/scripts-utils';

interface ScriptCardProps {
  script: ScriptItem;
  onEdit: (script: ScriptItem) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, newStatus: ScriptStatus) => void;
  onAdvanceStatus?: (id: string, currentStatus: ScriptStatus) => void;
}

export const ScriptCard: React.FC<ScriptCardProps> = ({
  script,
  onEdit,
  onDelete,
  onStatusChange,
  onAdvanceStatus,
}) => {
  const { words, speakingTime } = formatScriptMetrics(script.body);
  const statusConfig = SCRIPT_STATUS_CONFIG[script.status];

  // Extract first 2 non-empty lines for preview
  const previewLines = script.body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join('\n');

  const handleAdvance = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (statusConfig.nextStatus) {
      if (onAdvanceStatus) {
        onAdvanceStatus(script.id, script.status);
      } else {
        onStatusChange(script.id, statusConfig.nextStatus);
      }
    }
  };

  return (
    <div
      onClick={() => onEdit(script)}
      className="group bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-4 shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 relative overflow-hidden"
    >
      {/* Top Row: Title, Status Pill, Quick Menu */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors line-clamp-2 leading-snug">
            {script.title}
          </h3>

          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <select
              value={script.status}
              onChange={(e) => onStatusChange(script.id, e.target.value as ScriptStatus)}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border bg-zinc-950 ${statusConfig.badgeBg} ${statusConfig.badgeText} ${statusConfig.badgeBorder} focus:outline-none cursor-pointer`}
              title="Change Status"
            >
              {SCRIPT_STATUS_ORDER.map((st) => (
                <option key={st} value={st} className="bg-zinc-900 text-zinc-200">
                  {SCRIPT_STATUS_CONFIG[st].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* First 2 Lines Preview */}
        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed font-mono whitespace-pre-wrap">
          {previewLines || 'Empty script...'}
        </p>

        {/* Prominent Corrections Note for Needs Corrections Cards */}
        {script.status === 'needs_corrections' && script.correctionsNote && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2 shadow-inner">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="font-semibold block text-[10px] uppercase tracking-wider text-amber-400 mb-0.5">
                Needs to Fix:
              </span>
              <p className="line-clamp-2 text-[11px] leading-relaxed">
                {script.correctionsNote}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row: Metrics, Tags & Advance Button */}
      <div className="pt-2 border-t border-zinc-800/60 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-indigo-400" />
            <span>{words} words · {speakingTime}</span>
          </span>

          {/* Quick Actions (Edit, Delete) */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onEdit(script)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Edit Script"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(script.id)}
              className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Delete Script"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tags and One-Tap Advance Button */}
        <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Tags */}
          <div className="flex flex-wrap gap-1 min-w-0 flex-1">
            {script.tags && script.tags.length > 0 ? (
              script.tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded-md text-[10px] bg-zinc-800 text-zinc-400 font-mono truncate max-w-[80px]"
                >
                  #{t}
                </span>
              ))
            ) : null}
            {script.tags && script.tags.length > 2 && (
              <span className="text-[10px] text-zinc-500 font-mono">
                +{script.tags.length - 2}
              </span>
            )}
          </div>

          {/* One-Tap Advance Button */}
          {statusConfig.nextStatus && (
            <button
              type="button"
              onClick={handleAdvance}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 shadow-sm cursor-pointer ${
                statusConfig.nextStatus === 'ready_to_shoot'
                  ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'
                  : statusConfig.nextStatus === 'shot'
                  ? 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30'
                  : 'bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30'
              }`}
              title={`Advance to ${SCRIPT_STATUS_CONFIG[statusConfig.nextStatus].label}`}
            >
              <span>{statusConfig.nextActionLabel || 'Advance'}</span>
              <ChevronRight className="w-3 h-3 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
