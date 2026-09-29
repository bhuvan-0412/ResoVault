'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  CheckCircle2,
  Zap,
  Maximize,
  Minimize,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Clock,
  FileText,
} from 'lucide-react';
import { ScriptItem } from '@/lib/types';
import { formatScriptMetrics, SCRIPT_STATUS_CONFIG } from '@/lib/scripts-utils';

interface FitToScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  script: ScriptItem | null;
  onMarkAsShot: (scriptId: string) => Promise<void>;
  showToast?: (
    message: string,
    type?: 'success' | 'delete' | 'pin' | 'copy' | 'info',
    subtext?: string
  ) => void;
}

const MIN_READABLE_FONT = 18; // Sensible minimum readable size for filming (18px)
const MAX_READABLE_FONT = 76; // Upper bound for short punchy scripts / hooks

export const FitToScreenModal: React.FC<FitToScreenModalProps> = ({
  isOpen,
  onClose,
  script,
  onMarkAsShot,
  showToast,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sizing state
  const [optimalFontSize, setOptimalFontSize] = useState<number>(24);
  const [manualFontSize, setManualFontSize] = useState<number | null>(null);
  const [isLongScript, setIsLongScript] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMarkingShot, setIsMarkingShot] = useState(false);
  const [hasMarkedShot, setHasMarkedShot] = useState(false);

  // The active font size (manual override if user tweaked it, otherwise calculated optimal)
  const currentFontSize = manualFontSize !== null ? manualFontSize : optimalFontSize;

  // Reset local state when script changes
  useEffect(() => {
    if (script) {
      setManualFontSize(null);
      setHasMarkedShot(script.status === 'shot' || script.status === 'posted');
    }
  }, [script]);

  // Calculate the largest font size that fits the script body without scrolling
  const calculateFit = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure || !script || !script.body.trim()) return;

    // Available dimensions inside container with safety margins
    const availableWidth = Math.max(container.clientWidth - 16, 200);
    const availableHeight = Math.max(container.clientHeight - 24, 150);

    // Lock measurement box to exact available width
    measure.style.width = `${availableWidth}px`;

    // 1. Check if the script fits at the minimum readable font size
    measure.style.fontSize = `${MIN_READABLE_FONT}px`;
    const heightAtMin = measure.scrollHeight;

    if (heightAtMin > availableHeight) {
      // Script is too long to fit even at minimum readable font size
      setOptimalFontSize(MIN_READABLE_FONT);
      setIsLongScript(true);
      return;
    }

    // 2. Binary search for the largest font size (between MIN_READABLE_FONT and MAX_READABLE_FONT)
    setIsLongScript(false);
    let low = MIN_READABLE_FONT;
    let high = MAX_READABLE_FONT;
    let best = MIN_READABLE_FONT;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      measure.style.fontSize = `${mid}px`;

      if (measure.scrollHeight <= availableHeight && measure.scrollWidth <= availableWidth + 8) {
        best = mid;
        low = mid + 1; // Try larger
      } else {
        high = mid - 1; // Too big
      }
    }

    setOptimalFontSize(best);
  }, [script]);

  // Recalculate on open, script change, or resize
  useEffect(() => {
    if (!isOpen || !script) return;

    // Use requestAnimationFrame to ensure the container layout is fully calculated
    const rafId = requestAnimationFrame(() => {
      calculateFit();
    });

    const handleResize = () => {
      calculateFit();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // If fonts are still loading, recalculate when ready
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        calculateFit();
      });
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isOpen, script, calculateFit]);

  // Screen Wake Lock API to prevent sleep while filming
  useEffect(() => {
    let wakeLockSentinel: any = null;

    if (isOpen && typeof window !== 'undefined' && 'wakeLock' in navigator) {
      try {
        (navigator as any).wakeLock
          .request('screen')
          .then((lock: any) => {
            wakeLockSentinel = lock;
            setWakeLockActive(true);
            lock.addEventListener('release', () => {
              setWakeLockActive(false);
            });
          })
          .catch((err: any) => {
            console.log('Screen Wake Lock denied:', err);
            setWakeLockActive(false);
          });
      } catch (err) {
        console.warn('Wake Lock error:', err);
      }
    } else {
      setWakeLockActive(false);
    }

    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [isOpen]);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard navigation: Escape to exit, +/- to nudge font, F to toggle fullscreen
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setManualFontSize((prev) => Math.min((prev ?? optimalFontSize) + 2, MAX_READABLE_FONT));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setManualFontSize((prev) => Math.max((prev ?? optimalFontSize) - 2, MIN_READABLE_FONT));
      } else if (e.key === '0') {
        e.preventDefault();
        setManualFontSize(null);
      } else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Toggle native fullscreen if user presses F
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, optimalFontSize]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  const handleMarkAsShotClick = async () => {
    if (!script || isMarkingShot) return;
    setIsMarkingShot(true);
    try {
      await onMarkAsShot(script.id);
      setHasMarkedShot(true);
      if (showToast) {
        showToast(`"${script.title}" marked as Shot!`, 'success');
      }
    } catch (err) {
      console.error('Failed to mark as shot:', err);
      if (showToast) {
        showToast('Failed to update status', 'delete');
      }
    } finally {
      setIsMarkingShot(false);
    }
  };

  if (!isOpen || !script) return null;

  const { words, speakingTime } = formatScriptMetrics(script.body);
  const statusConfig = SCRIPT_STATUS_CONFIG[script.status];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fit-to-Screen Reader: ${script.title}`}
      className="fixed inset-0 z-50 bg-zinc-950 text-white flex flex-col select-none overflow-hidden animate-in fade-in duration-150"
    >
      {/* Hidden offscreen measurement clone for zero-flicker binary-search calculations */}
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -9999,
          left: -9999,
          visibility: 'hidden',
          pointerEvents: 'none',
          lineHeight: 1.45,
          letterSpacing: '0.015em',
          wordBreak: 'break-word',
        }}
        className="font-sans font-normal whitespace-pre-wrap px-4 sm:px-8"
      >
        {script.body}
      </div>

      {/* TOP BAR: Distraction-free controls & script info */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur flex items-center justify-between gap-2 shrink-0 z-10">
        {/* Left: Close Button & Script Info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-all cursor-pointer shrink-0"
            title="Exit Fit-to-Screen (Esc)"
            aria-label="Exit Fit-to-Screen"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-zinc-100 truncate">
                {script.title}
              </h2>
              <span
                className={`hidden md:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConfig.badgeBg} ${statusConfig.badgeText} ${statusConfig.badgeBorder}`}
              >
                {statusConfig.label}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 font-mono truncate">
              {words} words · {speakingTime} speaking
            </p>
          </div>
        </div>

        {/* Right: Wake Lock, Font Adjustment, Mark As Shot, Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Wake Lock Status Badge */}
          {wakeLockActive && (
            <div
              className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium"
              title="Screen Wake Lock is active — screen will not sleep while filming"
            >
              <Zap className="w-3 h-3 fill-emerald-400" />
              <span>Awake</span>
            </div>
          )}

          {/* Font Controls (A- / Auto / A+) */}
          <div className="flex items-center bg-zinc-900 rounded-xl border border-zinc-800 p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() =>
                setManualFontSize((prev) => Math.max((prev ?? optimalFontSize) - 2, MIN_READABLE_FONT))
              }
              disabled={currentFontSize <= MIN_READABLE_FONT}
              className="px-2 py-1 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
              title="Smaller font (-)"
            >
              A−
            </button>

            <button
              type="button"
              onClick={() => setManualFontSize(null)}
              className={`px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                manualFontSize === null
                  ? 'text-emerald-400 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title={
                manualFontSize === null
                  ? `Auto-Fit: ${optimalFontSize}px`
                  : 'Click to reset back to Auto-Fit'
              }
            >
              {manualFontSize === null ? `Fit ${optimalFontSize}px` : `${currentFontSize}px`}
            </button>

            <button
              type="button"
              onClick={() =>
                setManualFontSize((prev) => Math.min((prev ?? optimalFontSize) + 2, MAX_READABLE_FONT))
              }
              disabled={currentFontSize >= MAX_READABLE_FONT}
              className="px-2 py-1 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
              title="Larger font (+)"
            >
              A+
            </button>
          </div>

          {/* Mark as Shot Button */}
          <button
            type="button"
            onClick={handleMarkAsShotClick}
            disabled={isMarkingShot}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 ${
              hasMarkedShot
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
            }`}
            title={hasMarkedShot ? 'Script is marked as Shot' : 'Mark this script as Shot'}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${hasMarkedShot ? 'text-emerald-400' : 'text-white'}`} />
            <span className="hidden sm:inline">
              {hasMarkedShot ? 'Marked as Shot' : 'Mark as Shot'}
            </span>
          </button>

          {/* Browser Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:flex p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* LONG SCRIPT NOTICE BANNER */}
      {isLongScript && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-300 gap-2 shrink-0 animate-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2 mx-auto">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              This script is long — showing at minimum readable size ({MIN_READABLE_FONT}px). Scroll
              down to read the rest.
            </span>
          </div>
        </div>
      )}

      {/* CORRECTIONS NOTE REMINDER (if any) */}
      {script.status === 'needs_corrections' && script.correctionsNote && (
        <div className="bg-zinc-900 border-b border-amber-500/30 px-4 py-2 flex items-center justify-center gap-2 text-xs text-amber-400 shrink-0">
          <span className="font-bold uppercase tracking-wider text-[10px] text-amber-500">
            Note:
          </span>
          <span className="truncate max-w-2xl text-amber-300 font-medium">
            {script.correctionsNote}
          </span>
        </div>
      )}

      {/* MAIN VIEWPORT CANVAS */}
      <main
        ref={containerRef}
        className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 md:px-12 py-4 sm:py-8 flex flex-col min-h-0 relative"
      >
        <div
          ref={scrollContainerRef}
          className={`w-full h-full flex flex-col ${
            isLongScript
              ? 'overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent'
              : 'overflow-hidden justify-center'
          }`}
        >
          <article
            style={{
              fontSize: `${currentFontSize}px`,
              lineHeight: 1.45,
              wordBreak: 'break-word',
              letterSpacing: '0.012em',
            }}
            className="w-full font-sans font-normal text-zinc-100 whitespace-pre-wrap selection:bg-emerald-500 selection:text-black tracking-wide transition-[font-size] duration-150"
          >
            {script.body}
          </article>
        </div>
      </main>

      {/* COMPACT FOOTER HINT */}
      <footer className="h-8 px-4 border-t border-zinc-900 bg-zinc-950/80 flex items-center justify-between text-[11px] text-zinc-500 font-mono shrink-0">
        <span className="hidden sm:inline">
          Press <kbd className="px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">Esc</kbd> to return
        </span>
        <span className="mx-auto sm:mx-0">
          Fit-to-Screen Reader • {isLongScript ? 'Scroll mode' : 'Zero scroll'}
        </span>
        <span className="hidden sm:inline">
          Use <kbd className="px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">+</kbd> / <kbd className="px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">−</kbd> to fine-tune
        </span>
      </footer>
    </div>
  );
};
