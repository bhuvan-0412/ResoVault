'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  Edit2,
  Trash2,
  BookOpen,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  Check,
} from 'lucide-react';
import { ScriptItem, ScriptStatus } from '@/lib/types';
import {
  formatScriptMetrics,
  scriptDateLabel,
  SCRIPT_STATUS_CONFIG,
  SCRIPT_STATUS_ORDER,
} from '@/lib/scripts-utils';

export type MoveAction = 'top' | 'up' | 'down' | 'bottom';

interface ScriptActionsMenuProps {
  script: ScriptItem;
  /** Move up/down/top/bottom only make sense while the column is in Custom order. */
  canReorder: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveInColumn: (id: string, action: MoveAction) => void;
  onMoveToColumn: (id: string, status: ScriptStatus) => void;
}

export const ScriptActionsMenu: React.FC<ScriptActionsMenuProps> = ({
  script,
  canReorder,
  isFirst,
  isLast,
  onMoveInColumn,
  onMoveToColumn,
}) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'main' | 'columns'>('main');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const itemClass =
    'w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer';

  const reorderItems: { action: MoveAction; label: string; icon: React.ReactNode; disabled: boolean }[] = [
    { action: 'top', label: 'Move to top', icon: <ArrowUpToLine className="w-3.5 h-3.5" />, disabled: !canReorder || isFirst },
    { action: 'up', label: 'Move up', icon: <ArrowUp className="w-3.5 h-3.5" />, disabled: !canReorder || isFirst },
    { action: 'down', label: 'Move down', icon: <ArrowDown className="w-3.5 h-3.5" />, disabled: !canReorder || isLast },
    { action: 'bottom', label: 'Move to bottom', icon: <ArrowDownToLine className="w-3.5 h-3.5" />, disabled: !canReorder || isLast },
  ];

  return (
    <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => {
          setView('main');
          setOpen((o) => !o);
        }}
        className="p-2 -m-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
        aria-label="Script actions"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Move / actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 w-52 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60"
        >
          {view === 'main' ? (
            <>
              {reorderItems.map((item) => (
                <button
                  key={item.action}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => run(() => onMoveInColumn(script.id, item.action))}
                  className={itemClass}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
              {!canReorder && (
                <p className="px-3 pb-2 text-[10px] leading-snug text-zinc-500">
                  Switch the column to “Custom order” to reorder.
                </p>
              )}
              <div className="border-t border-zinc-800" />
              <button type="button" role="menuitem" onClick={() => setView('columns')} className={itemClass}>
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span className="flex-1">Move to column</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setView('main')}
                className={`${itemClass} text-zinc-400 border-b border-zinc-800`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
              {SCRIPT_STATUS_ORDER.map((st) => {
                const conf = SCRIPT_STATUS_CONFIG[st];
                const current = st === script.status;
                return (
                  <button
                    key={st}
                    type="button"
                    role="menuitem"
                    disabled={current}
                    onClick={() => run(() => onMoveToColumn(script.id, st))}
                    className={itemClass}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${conf.dotClass}`} />
                    <span className="flex-1">{conf.label}</span>
                    {current && <Check className="w-3.5 h-3.5 text-zinc-400" />}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};

interface ScriptCardProps {
  script: ScriptItem;
  /** "#N" badge for Posted cards (position in the Posted column's custom order). */
  postedNumber?: number;
  canReorder: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (script: ScriptItem) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, newStatus: ScriptStatus) => void;
  onAdvanceStatus?: (id: string, currentStatus: ScriptStatus) => void;
  onMoveInColumn: (id: string, action: MoveAction) => void;
  onMoveToColumn: (id: string, status: ScriptStatus) => void;
  onReadFullScreen?: (script: ScriptItem) => void;
}

export const ScriptCard: React.FC<ScriptCardProps> = ({
  script,
  postedNumber,
  canReorder,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onStatusChange,
  onAdvanceStatus,
  onMoveInColumn,
  onMoveToColumn,
  onReadFullScreen,
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
      className="group bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-4 shadow-sm hover:shadow-xl transition-colors duration-200 cursor-pointer flex flex-col justify-between gap-3 relative"
    >
      {/* Top Row: Number, Title, Actions menu */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-start gap-2 min-w-0">
            {script.status === 'posted' && postedNumber !== undefined && (
              <span
                className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30"
                title="Position in the Posted column (top = #1)"
              >
                #{postedNumber}
              </span>
            )}
            <h3 className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors line-clamp-2 leading-snug break-words">
              {script.title}
            </h3>
          </div>

          <ScriptActionsMenu
            script={script}
            canReorder={canReorder}
            isFirst={isFirst}
            isLast={isLast}
            onMoveInColumn={onMoveInColumn}
            onMoveToColumn={onMoveToColumn}
          />
        </div>

        <p className="text-[10px] font-mono text-zinc-500 mb-1.5">{scriptDateLabel(script)}</p>

        {/* First 2 Lines Preview */}
        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed font-mono whitespace-pre-wrap break-words">
          {previewLines || 'Empty script...'}
        </p>

        {/* Notes on Draft cards */}
        {script.status === 'needs_corrections' && script.correctionsNote && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2 shadow-inner">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="font-semibold block text-[10px] uppercase tracking-wider text-amber-400 mb-0.5">
                Notes
              </span>
              <p className="line-clamp-2 text-[11px] leading-relaxed break-words">
                {script.correctionsNote}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Metrics, Tags, Read + Advance */}
      <div className="pt-2 border-t border-zinc-800/60 flex flex-col gap-2.5 shrink-0">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-indigo-400" />
            <span>{words} words · {speakingTime}</span>
          </span>

          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onEdit(script)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Edit Script"
              aria-label="Edit Script"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(script.id)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Delete Script"
              aria-label="Delete Script"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {script.tags && script.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 min-w-0">
            {script.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 rounded-md text-[10px] bg-zinc-800 text-zinc-400 font-mono truncate max-w-[90px]"
              >
                #{t}
              </span>
            ))}
            {script.tags.length > 3 && (
              <span className="text-[10px] text-zinc-500 font-mono self-center">
                +{script.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex items-stretch gap-2" onClick={(e) => e.stopPropagation()}>
          {onReadFullScreen && (
            <button
              type="button"
              onClick={() => onReadFullScreen(script)}
              className="flex-1 min-h-10 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold shadow-md active:scale-95 transition-all cursor-pointer"
              title="Read Mode (R)"
              aria-label="Open Read Mode"
            >
              <BookOpen className="w-4 h-4" />
              Read
            </button>
          )}

          {statusConfig.nextStatus && (
            <button
              type="button"
              onClick={handleAdvance}
              className={`min-h-10 flex items-center justify-center gap-1 px-3 rounded-xl text-[11px] font-bold transition-all active:scale-95 shadow-sm cursor-pointer ${
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
