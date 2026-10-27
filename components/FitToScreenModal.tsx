'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  CheckCircle2,
  Maximize,
  Minimize,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Sun,
  Moon,
  AlignJustify,
  Square,
} from 'lucide-react';
import { ScriptItem } from '@/lib/types';
import { formatScriptMetrics, splitBlocks, SCRIPT_STATUS_CONFIG } from '@/lib/scripts-utils';

/**
 * Read Mode: shows a script one block (paragraph) at a time, very large, for memorising
 * and saying it to camera. Previously the "Fit to Screen" reader.
 */

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

const MIN_FONT = 16;
const MAX_FONT = 200;
const FONT_STEP = 4;
const CONTROLS_FADE_MS = 3000;
const SWIPE_MIN_PX = 50;
const LINE_HEIGHTS = [1.2, 1.5, 1.8] as const;
const PREFS_KEY = 'resovault.readmode.v1';

type ReadTheme = 'dark' | 'light';

interface ReadPrefs {
  fontSize: number;
  lineHeight: number;
  theme: ReadTheme;
}

const DEFAULT_PREFS: ReadPrefs = { fontSize: 48, lineHeight: 1.5, theme: 'dark' };

const clampFont = (n: number) => Math.min(MAX_FONT, Math.max(MIN_FONT, n));

function loadPrefs(): ReadPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ReadPrefs>;
    return {
      fontSize: typeof parsed.fontSize === 'number' ? clampFont(parsed.fontSize) : DEFAULT_PREFS.fontSize,
      lineHeight:
        typeof parsed.lineHeight === 'number' && (LINE_HEIGHTS as readonly number[]).includes(parsed.lineHeight)
          ? parsed.lineHeight
          : DEFAULT_PREFS.lineHeight,
      theme: parsed.theme === 'light' ? 'light' : 'dark',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const THEMES: Record<
  ReadTheme,
  { root: string; panel: string; button: string; active: string; muted: string; track: string; hiddenBox: string }
> = {
  dark: {
    root: 'bg-zinc-950 text-zinc-100',
    panel: 'bg-zinc-900/90 border-zinc-700/80 text-zinc-200',
    button: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700',
    active: 'bg-indigo-600 text-white border-indigo-500',
    muted: 'text-zinc-400',
    track: 'bg-zinc-800',
    hiddenBox: 'border-zinc-700 text-zinc-500',
  },
  light: {
    root: 'bg-stone-50 text-zinc-900',
    panel: 'bg-white/95 border-zinc-300 text-zinc-800',
    button: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300',
    active: 'bg-indigo-600 text-white border-indigo-600',
    muted: 'text-zinc-500',
    track: 'bg-zinc-200',
    hiddenBox: 'border-zinc-300 text-zinc-400',
  },
};

interface ReadModeSessionProps {
  script: ScriptItem;
  onClose: () => void;
  onMarkAsShot: (scriptId: string) => Promise<void>;
  showToast?: FitToScreenModalProps['showToast'];
}

const ReadModeSession: React.FC<ReadModeSessionProps> = ({ script, onClose, onMarkAsShot, showToast }) => {
  const blocks = useMemo(() => splitBlocks(script.body), [script.body]);
  const lastIndex = Math.max(blocks.length - 1, 0);

  const [rawIndex, setIndex] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [mode, setMode] = useState<'block' | 'full'>('block');
  const [prefs, setPrefs] = useState<ReadPrefs>(loadPrefs);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMarkingShot, setIsMarkingShot] = useState(false);

  const index = Math.min(rawIndex, lastIndex);
  const theme = THEMES[prefs.theme];
  const fontPx = Math.round(prefs.fontSize);
  const hasMarkedShot = script.status === 'shot' || script.status === 'posted';
  const statusConfig = SCRIPT_STATUS_CONFIG[script.status];
  const { words, speakingTime } = formatScriptMetrics(script.body);

  const contentRef = useRef<HTMLDivElement>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchRef = useRef<{
    startX: number;
    startY: number;
    multi: boolean;
    pinchDist: number;
    pinchFont: number;
  }>({ startX: 0, startY: 0, multi: false, pinchDist: 0, pinchFont: 0 });

  // ---- Preferences -------------------------------------------------------
  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable (private mode etc.) */
    }
  }, [prefs]);

  const setFont = useCallback((fn: (current: number) => number) => {
    setPrefs((p) => ({ ...p, fontSize: clampFont(fn(p.fontSize)) }));
  }, []);

  // ---- Auto-fading controls ----------------------------------------------
  const scheduleFade = useCallback(() => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_FADE_MS);
  }, []);

  const poke = useCallback(() => {
    setControlsVisible(true);
    scheduleFade();
  }, [scheduleFade]);

  useEffect(() => {
    scheduleFade();
    const events = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel'] as const;
    events.forEach((ev) => window.addEventListener(ev, poke, { passive: true }));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, poke));
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [poke, scheduleFade]);

  // ---- Lock page scroll while open ----------------------------------------
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // ---- Screen Wake Lock (re-acquired when the tab becomes visible again) ---
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        if (!('wakeLock' in navigator)) return;
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        setWakeLockActive(true);
        lock.addEventListener('release', () => setWakeLockActive(false));
      } catch {
        setWakeLockActive(false);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => {});
    };
  }, []);

  // ---- Fullscreen -----------------------------------------------------------
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  }, []);

  // ---- Navigation -----------------------------------------------------------
  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(lastIndex, Math.max(0, Math.min(i, lastIndex) + delta)));
      setHidden(false);
    },
    [lastIndex]
  );

  // Every block starts scrolled to the top
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [index, mode]);

  // ---- Keyboard ---------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const onInput = target instanceof HTMLInputElement;
      const onButton = target instanceof HTMLButtonElement;
      const key = e.key;

      if (key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (key === '+' || key === '=') {
        e.preventDefault();
        setFont((f) => f + FONT_STEP);
      } else if (key === '-' || key === '_') {
        e.preventDefault();
        setFont((f) => f - FONT_STEP);
      } else if (key === 'h' || key === 'H') {
        e.preventDefault();
        setHidden((h) => !h);
      } else if (key === 'f' || key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (mode === 'block' && !onInput && key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      } else if (mode === 'block' && !onInput && key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      } else if (mode === 'block' && key === ' ' && !onButton && !onInput) {
        e.preventDefault();
        go(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, go, onClose, setFont, toggleFullscreen]);

  // ---- Ctrl/Cmd + wheel (and trackpad pinch) zoom -----------------------------
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = (Math.sign(-e.deltaY) * Math.min(Math.abs(e.deltaY), 40)) / 10;
      setFont((f) => f + delta);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setFont]);

  // ---- Touch: pinch to zoom, swipe to navigate ---------------------------------
  const distance = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = touchRef.current;
    if (e.touches.length === 2) {
      t.multi = true;
      t.pinchDist = distance(e.touches);
      t.pinchFont = prefs.fontSize;
    } else if (e.touches.length === 1 && !t.multi) {
      t.startX = e.touches[0].clientX;
      t.startY = e.touches[0].clientY;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const t = touchRef.current;
    if (e.touches.length === 2 && t.pinchDist > 0) {
      const next = (t.pinchFont * distance(e.touches)) / t.pinchDist;
      setPrefs((p) => ({ ...p, fontSize: clampFont(next) }));
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touchRef.current;
    if (e.touches.length > 0) return;
    const wasMulti = t.multi;
    t.multi = false;
    t.pinchDist = 0;
    if (wasMulti || mode !== 'block') return;

    const dx = e.changedTouches[0].clientX - t.startX;
    const dy = e.changedTouches[0].clientY - t.startY;
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx < 0 ? 1 : -1);
    }
  };

  // Tap right / left half = next / previous (a tap reveals hidden text first)
  const onContentClick = (e: React.MouseEvent) => {
    if (mode !== 'block') return;
    if (hidden) {
      setHidden(false);
      return;
    }
    go(e.clientX > window.innerWidth / 2 ? 1 : -1);
  };

  // ---- Mark as shot ---------------------------------------------------------------
  const handleMarkAsShotClick = async () => {
    if (isMarkingShot || hasMarkedShot) return;
    setIsMarkingShot(true);
    try {
      await onMarkAsShot(script.id);
      showToast?.(`"${script.title}" marked as Shot!`, 'success');
    } catch (err) {
      console.error('Failed to mark as shot:', err);
      showToast?.('Failed to update status', 'delete');
    } finally {
      setIsMarkingShot(false);
    }
  };

  // Keep keyboard focus off the buttons so Space always means "next"
  const noFocus = (e: React.MouseEvent) => e.preventDefault();

  const iconBtn = `h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${theme.button}`;
  const progress = blocks.length > 0 ? ((index + 1) / blocks.length) * 100 : 0;
  const fade = `transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;

  const textStyle: React.CSSProperties = { fontSize: `${fontPx}px`, lineHeight: prefs.lineHeight };
  const hiddenPlaceholder = (
    <div
      className={`flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-16 text-base font-medium ${theme.hiddenBox}`}
      style={{ fontSize: '1rem', lineHeight: 1.4 }}
    >
      <EyeOff className="w-5 h-5" />
      Text hidden — say it from memory, then tap to reveal
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Read Mode: ${script.title}`}
      className={`fixed inset-0 z-[60] flex flex-col overflow-hidden select-none ${theme.root}`}
    >
      {/* Thin progress bar (always visible) */}
      <div className={`absolute top-0 inset-x-0 h-1 z-20 ${theme.track}`} aria-hidden="true">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-200"
          style={{ width: mode === 'block' ? `${progress}%` : '100%' }}
        />
      </div>

      {/* Reading area */}
      <div
        ref={contentRef}
        onClick={onContentClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col touch-pan-y"
      >
        <div className="my-auto w-full max-w-5xl mx-auto px-5 sm:px-10 pt-20 pb-24">
          {blocks.length === 0 ? (
            <p className={`text-center text-lg ${theme.muted}`}>This script is empty.</p>
          ) : hidden ? (
            hiddenPlaceholder
          ) : mode === 'block' ? (
            <p
              style={textStyle}
              className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-medium text-center sm:text-left"
            >
              {blocks[index]}
            </p>
          ) : (
            <div style={textStyle} className="break-words [overflow-wrap:anywhere] font-medium">
              {blocks.map((block, i) => (
                <p key={i} className="whitespace-pre-wrap" style={{ marginBottom: '0.9em' }}>
                  {block}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top bar */}
      <header className={`absolute top-1 inset-x-0 z-10 px-3 pt-2 sm:px-5 ${fade}`}>
        <div className={`flex items-center gap-2 rounded-2xl border px-2 py-1.5 backdrop-blur ${theme.panel}`}>
          <button type="button" onMouseDown={noFocus} onClick={onClose} className={iconBtn} aria-label="Exit Read Mode (Esc)" title="Exit (Esc)">
            <X className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold truncate">{script.title}</h2>
            <p className={`text-[11px] font-mono truncate ${theme.muted}`}>
              {mode === 'block'
                ? `Block ${blocks.length === 0 ? 0 : index + 1} / ${blocks.length}`
                : `Full script · ${blocks.length} ${blocks.length === 1 ? 'block' : 'blocks'}`}
              <span className="hidden sm:inline">
                {' '}· {words} words · {speakingTime} · {statusConfig.label}
                {wakeLockActive ? ' · screen awake' : ''}
              </span>
            </p>
          </div>

          <button
            type="button"
            onMouseDown={noFocus}
            onClick={handleMarkAsShotClick}
            disabled={isMarkingShot || hasMarkedShot}
            className={`h-11 shrink-0 flex items-center gap-1.5 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer disabled:cursor-default ${
              hasMarkedShot
                ? 'bg-emerald-600/20 text-emerald-500 border-emerald-500/40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
            }`}
            title={hasMarkedShot ? 'Already marked as Shot' : 'Mark this script as Shot'}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">{hasMarkedShot ? 'Shot' : 'Mark as Shot'}</span>
          </button>

          <button
            type="button"
            onMouseDown={noFocus}
            onClick={toggleFullscreen}
            className={iconBtn}
            aria-label={isFullscreen ? 'Exit full screen (F)' : 'Full screen (F)'}
            title={isFullscreen ? 'Exit full screen (F)' : 'Full screen (F)'}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Bottom controls */}
      <footer className={`absolute bottom-0 inset-x-0 z-10 px-3 pb-3 sm:px-5 sm:pb-4 ${fade}`}>
        <div className={`mx-auto max-w-3xl space-y-2 rounded-2xl border p-2.5 backdrop-blur ${theme.panel}`}>
          {/* Font size */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onMouseDown={noFocus}
              onClick={() => setFont((f) => f - FONT_STEP)}
              disabled={fontPx <= MIN_FONT}
              className={iconBtn}
              aria-label="Smaller text (−)"
              title="Smaller text (−)"
            >
              <Minus className="w-5 h-5" />
            </button>
            <input
              type="range"
              min={MIN_FONT}
              max={MAX_FONT}
              step={1}
              value={fontPx}
              onChange={(e) => setFont(() => Number(e.target.value))}
              aria-label="Font size"
              className="flex-1 min-w-0 h-11 accent-indigo-500 cursor-pointer"
            />
            <button
              type="button"
              onMouseDown={noFocus}
              onClick={() => setFont((f) => f + FONT_STEP)}
              disabled={fontPx >= MAX_FONT}
              className={iconBtn}
              aria-label="Larger text (+)"
              title="Larger text (+)"
            >
              <Plus className="w-5 h-5" />
            </button>
            <span className={`w-12 shrink-0 text-right text-xs font-mono ${theme.muted}`}>{fontPx}px</span>
          </div>

          {/* Spacing, theme, mode */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1" role="group" aria-label="Line spacing">
              {LINE_HEIGHTS.map((lh) => (
                <button
                  key={lh}
                  type="button"
                  onMouseDown={noFocus}
                  onClick={() => setPrefs((p) => ({ ...p, lineHeight: lh }))}
                  className={`h-11 min-w-11 px-2.5 rounded-xl border text-xs font-mono font-semibold transition-colors cursor-pointer ${
                    prefs.lineHeight === lh ? theme.active : theme.button
                  }`}
                  aria-pressed={prefs.lineHeight === lh}
                  title={`Line spacing ${lh}`}
                >
                  {lh}
                </button>
              ))}
            </div>

            <button
              type="button"
              onMouseDown={noFocus}
              onClick={() => setPrefs((p) => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' }))}
              className={iconBtn}
              aria-label={prefs.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={prefs.theme === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              {prefs.theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onMouseDown={noFocus}
              onClick={() => setMode((m) => (m === 'block' ? 'full' : 'block'))}
              className={`h-11 flex-1 min-w-[9rem] flex items-center justify-center gap-2 px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${theme.button}`}
            >
              {mode === 'block' ? <AlignJustify className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {mode === 'block' ? 'Show full script' : 'One block at a time'}
            </button>
          </div>

          {/* Navigation + Hide */}
          <div className="flex items-stretch gap-2">
            {mode === 'block' && (
              <button
                type="button"
                onMouseDown={noFocus}
                onClick={() => go(-1)}
                disabled={index <= 0}
                className={`h-14 flex-1 flex items-center justify-center gap-1.5 rounded-xl border text-sm font-bold transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${theme.button}`}
                aria-label="Previous block (←)"
              >
                <ChevronLeft className="w-5 h-5" />
                Prev
              </button>
            )}
            <button
              type="button"
              onMouseDown={noFocus}
              onClick={() => setHidden((h) => !h)}
              className={`h-14 flex-1 flex items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                hidden ? theme.active : theme.button
              }`}
              aria-pressed={hidden}
              title="Hide / reveal text (H)"
            >
              {hidden ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              {hidden ? 'Reveal' : 'Hide'}
            </button>
            {mode === 'block' && (
              <button
                type="button"
                onMouseDown={noFocus}
                onClick={() => go(1)}
                disabled={index >= lastIndex}
                className="h-14 flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                aria-label="Next block (→ or Space)"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export const FitToScreenModal: React.FC<FitToScreenModalProps> = ({
  isOpen,
  onClose,
  script,
  onMarkAsShot,
  showToast,
}) => {
  if (!isOpen || !script) return null;
  // Keyed by script so each session starts at block 1 with text visible
  return <ReadModeSession key={script.id} script={script} onClose={onClose} onMarkAsShot={onMarkAsShot} showToast={showToast} />;
};
