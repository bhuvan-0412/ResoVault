'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, Trash2, Pin, Copy, Sparkles, X, Info } from 'lucide-react';

export type ToastType = 'success' | 'delete' | 'pin' | 'copy' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  subtext?: string;
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:bottom-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full"
    >
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastMessage: React.FC<{ toast: ToastItem; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 2800);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const renderIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'pin':
        return <Pin className="w-4 h-4 text-amber-400 fill-amber-400 rotate-45 shrink-0" />;
      case 'copy':
        return <Copy className="w-4 h-4 text-indigo-400 shrink-0" />;
      case 'info':
      default:
        return <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-emerald-500/30 bg-zinc-950/95';
      case 'delete':
        return 'border-rose-500/30 bg-zinc-950/95';
      case 'pin':
        return 'border-amber-500/30 bg-zinc-950/95';
      case 'copy':
        return 'border-indigo-500/30 bg-zinc-950/95';
      default:
        return 'border-zinc-800 bg-zinc-950/95';
    }
  };

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200 ${getBorderColor()}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
          {renderIcon()}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-100 truncate">{toast.message}</p>
          {toast.subtext && <p className="text-[11px] text-zinc-400 truncate">{toast.subtext}</p>}
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition-colors shrink-0 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
