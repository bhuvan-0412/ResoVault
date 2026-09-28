'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clapperboard,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Sliders,
  Volume2,
  Clock,
  RotateCcw,
  CheckSquare,
  Square,
  Maximize2,
  Minimize2,
  Eye,
} from 'lucide-react';
import { ScriptItem } from '@/lib/types';
import { formatScriptMetrics } from '@/lib/scripts-utils';

interface ShootDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableScripts: ScriptItem[];
  onMarkAsShot: (scriptId: string) => Promise<void>;
}

const FONT_SIZES = [
  { label: 'S', size: 'text-lg leading-relaxed' },
  { label: 'M', size: 'text-xl leading-relaxed' },
  { label: 'L', size: 'text-2xl leading-relaxed' },
  { label: 'XL', size: 'text-3xl leading-relaxed' },
  { label: '2XL', size: 'text-4xl leading-relaxed' },
  { label: '3XL', size: 'text-5xl leading-relaxed' },
];

export const ShootDayModal: React.FC<ShootDayModalProps> = ({
  isOpen,
  onClose,
  availableScripts,
  onMarkAsShot,
}) => {
  // Step: 'setup' (pick & order batch) or 'prompter' (distraction-free shoot mode) or 'completed'
  const [step, setStep] = useState<'setup' | 'prompter' | 'completed'>('setup');
  
  // Setup state
  const [batchScripts, setBatchScripts] = useState<ScriptItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Prompter settings
  const [fontIndex, setFontIndex] = useState(2); // default 'L' (24px)
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState<number>(2); // 1 = slow, 2 = normal, 3 = fast, 4 = turbo
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [shotScriptIds, setShotScriptIds] = useState<Set<string>>(new Set());

  // Swipe gesture tracking
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  // Auto-scroll animation ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRafRef = useRef<number | null>(null);

  // Initialize batch scripts on open (defaulting to ready_to_shoot scripts)
  useEffect(() => {
    if (isOpen) {
      const readyScripts = availableScripts.filter((s) => s.status === 'ready_to_shoot');
      // If no ready_to_shoot, fallback to all unposted scripts
      const initial = readyScripts.length > 0
        ? readyScripts
        : availableScripts.filter((s) => s.status !== 'posted');
      setBatchScripts(initial);
      setCurrentIndex(0);
      setStep('setup');
      setShotScriptIds(new Set());
      setIsAutoScrolling(false);

      // Load saved font size from localStorage
      if (typeof window !== 'undefined') {
        const savedFont = localStorage.getItem('resovault_shoot_font_index');
        if (savedFont !== null) {
          const idx = parseInt(savedFont, 10);
          if (!isNaN(idx) && idx >= 0 && idx < FONT_SIZES.length) {
            setFontIndex(idx);
          }
        }
      }
    }
  }, [isOpen, availableScripts]);

  // Screen Wake Lock API
  useEffect(() => {
    let wakeLockSentinel: any = null;

    if (step === 'prompter' && typeof window !== 'undefined' && 'wakeLock' in navigator) {
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
            console.log('Screen Wake Lock denied or not supported:', err);
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
  }, [step]);

  // Save font size preference
  const handleUpdateFontIndex = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < FONT_SIZES.length) {
      setFontIndex(newIndex);
      if (typeof window !== 'undefined') {
        localStorage.setItem('resovault_shoot_font_index', newIndex.toString());
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (step !== 'prompter') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextScript();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevScript();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsAutoScrolling((prev) => !prev);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleExitPrompter();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, currentIndex, batchScripts.length]);

  // Auto-scroll loop
  useEffect(() => {
    if (step !== 'prompter' || !isAutoScrolling) {
      if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);
      return;
    }

    let lastTimestamp = performance.now();
    const scrollStep = (timestamp: number) => {
      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      if (scrollContainerRef.current) {
        // speed 1 = ~25px/sec, speed 2 = ~50px/sec, speed 3 = ~90px/sec, speed 4 = ~150px/sec
        const pixelsPerMs = [0.02, 0.045, 0.08, 0.14][scrollSpeed - 1] || 0.045;
        scrollContainerRef.current.scrollTop += elapsed * pixelsPerMs;
      }
      autoScrollRafRef.current = requestAnimationFrame(scrollStep);
    };

    autoScrollRafRef.current = requestAnimationFrame(scrollStep);
    return () => {
      if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);
    };
  }, [step, isAutoScrolling, scrollSpeed]);

  if (!isOpen) return null;

  // Ordering handlers in Setup
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setBatchScripts((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === batchScripts.length - 1) return;
    setBatchScripts((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleToggleInclude = (script: ScriptItem) => {
    if (batchScripts.some((s) => s.id === script.id)) {
      setBatchScripts(batchScripts.filter((s) => s.id !== script.id));
    } else {
      setBatchScripts([...batchScripts, script]);
    }
  };

  const handleStartShooting = () => {
    if (batchScripts.length === 0) return;
    setCurrentIndex(0);
    setStep('prompter');
    setIsAutoScrolling(false);
  };

  const handleNextScript = () => {
    setIsAutoScrolling(false);
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    if (currentIndex < batchScripts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setStep('completed');
    }
  };

  const handlePrevScript = () => {
    setIsAutoScrolling(false);
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleMarkCurrentAsShot = async () => {
    const currentScript = batchScripts[currentIndex];
    if (!currentScript) return;

    try {
      await onMarkAsShot(currentScript.id);
      setShotScriptIds((prev) => new Set(prev).add(currentScript.id));
      handleNextScript();
    } catch (err) {
      console.error('Failed to mark script as shot:', err);
    }
  };

  const handleExitPrompter = () => {
    setIsAutoScrolling(false);
    setStep('setup');
    onClose();
  };

  // Touch Swipe Handlers for mobile gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartXRef.current || !touchEndXRef.current) return;
    const distance = touchStartXRef.current - touchEndXRef.current;
    const isLeftSwipe = distance > 70;
    const isRightSwipe = distance < -70;

    if (isLeftSwipe) {
      handleNextScript();
    } else if (isRightSwipe) {
      handlePrevScript();
    }

    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  const currentScript = batchScripts[currentIndex];
  const { words, speakingTime } = currentScript ? formatScriptMetrics(currentScript.body) : { words: 0, speakingTime: '0s' };

  // Calculate total batch speaking time in setup
  const totalBatchWords = batchScripts.reduce((acc, s) => acc + formatScriptMetrics(s.body).words, 0);
  const totalBatchSpeaking = formatScriptMetrics(
    batchScripts.map((s) => s.body).join(' ')
  ).speakingTime;

  return (
    <>
      {/* 1. SETUP / BATCH SELECTION SCREEN */}
      {step === 'setup' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/25">
                  <Clapperboard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    Shoot-Day Session Setup
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Pick scripts to shoot today and arrange your filming order
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300">
                <div className="flex items-center gap-2 font-medium">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Batch contains <strong>{batchScripts.length}</strong> script(s) · {totalBatchWords} total words (~{totalBatchSpeaking} filming)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setBatchScripts(availableScripts.filter((s) => s.status !== 'posted'))}
                  className="text-xs text-emerald-400 hover:underline cursor-pointer"
                >
                  Select All Unposted
                </button>
              </div>

              {availableScripts.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-xs">
                  No scripts in your vault yet. Add or import scripts first!
                </div>
              ) : (
                <div className="space-y-2">
                  {availableScripts.map((script) => {
                    const isSelected = batchScripts.some((s) => s.id === script.id);
                    const orderIndex = batchScripts.findIndex((s) => s.id === script.id);
                    const { words: w, speakingTime: st } = formatScriptMetrics(script.body);

                    return (
                      <div
                        key={script.id}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-zinc-950/90 border-emerald-500/40 shadow-sm'
                            : 'bg-zinc-950/40 border-zinc-800/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleInclude(script)}
                            className="text-zinc-400 hover:text-emerald-400 transition-colors shrink-0 cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Square className="w-5 h-5 text-zinc-600" />
                            )}
                          </button>

                          {isSelected && (
                            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                              {orderIndex + 1}
                            </span>
                          )}

                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm font-bold text-zinc-100 truncate">
                              {script.title}
                            </h4>
                            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                              {w} words · {st} speaking
                              {script.status === 'ready_to_shoot' && (
                                <span className="ml-2 text-emerald-400 font-semibold">• Ready to Shoot</span>
                              )}
                              {script.status === 'needs_corrections' && (
                                <span className="ml-2 text-amber-400 font-semibold">• Needs Corrections</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={orderIndex === 0}
                              onClick={() => handleMoveUp(orderIndex)}
                              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                              title="Move Up in shooting order"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={orderIndex === batchScripts.length - 1}
                              onClick={() => handleMoveDown(orderIndex)}
                              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                              title="Move Down in shooting order"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/60">
              <span className="text-xs text-zinc-400 font-mono">
                {batchScripts.length} script(s) queued
              </span>
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
                  disabled={batchScripts.length === 0}
                  onClick={handleStartShooting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-xl shadow-emerald-600/30 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Clapperboard className="w-4 h-4" />
                  <span>Start Shooting ({batchScripts.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. FULL-SCREEN DISTRACTION-FREE PROMPTER / READING VIEW */}
      {step === 'prompter' && currentScript && (
        <div
          className="fixed inset-0 z-50 bg-black text-zinc-100 flex flex-col select-none touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top Control Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md shrink-0">
            {/* Left: Progress info & exit */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExitPrompter}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Exit</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold">
                  Script {currentIndex + 1} of {batchScripts.length}
                </span>
                {wakeLockActive && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Awake
                  </span>
                )}
              </div>
            </div>

            {/* Middle: Title & Metrics */}
            <div className="hidden md:flex flex-col items-center max-w-sm">
              <h2 className="text-xs font-bold text-zinc-200 truncate max-w-xs">
                {currentScript.title}
              </h2>
              <span className="text-[10px] text-zinc-400 font-mono">
                {words} words · {speakingTime}
              </span>
            </div>

            {/* Right: Teleprompter & Font Controls */}
            <div className="flex items-center gap-2">
              {/* Teleprompter Auto-scroll toggle */}
              <div className="flex items-center bg-zinc-900 rounded-xl border border-zinc-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isAutoScrolling
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                  title="Toggle Teleprompter Auto-scroll (Spacebar)"
                >
                  {isAutoScrolling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{isAutoScrolling ? 'Pause' : 'Scroll'}</span>
                </button>
                {isAutoScrolling && (
                  <select
                    value={scrollSpeed}
                    onChange={(e) => setScrollSpeed(Number(e.target.value))}
                    className="bg-transparent text-[11px] font-mono text-zinc-300 px-1 py-1 focus:outline-none cursor-pointer"
                    title="Scroll Speed"
                  >
                    <option value={1} className="bg-zinc-900">1x</option>
                    <option value={2} className="bg-zinc-900">2x</option>
                    <option value={3} className="bg-zinc-900">3x</option>
                    <option value={4} className="bg-zinc-900">4x</option>
                  </select>
                )}
              </div>

              {/* Font Size Selector (A- / A+) */}
              <div className="flex items-center bg-zinc-900 rounded-xl border border-zinc-800 p-0.5">
                <button
                  type="button"
                  disabled={fontIndex === 0}
                  onClick={() => handleUpdateFontIndex(fontIndex - 1)}
                  className="px-2 py-1 text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                  title="Smaller Text"
                >
                  A−
                </button>
                <span className="text-[10px] font-mono text-zinc-500 px-1">
                  {FONT_SIZES[fontIndex].label}
                </span>
                <button
                  type="button"
                  disabled={fontIndex === FONT_SIZES.length - 1}
                  onClick={() => handleUpdateFontIndex(fontIndex + 1)}
                  className="px-2 py-1 text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                  title="Larger Text"
                >
                  A+
                </button>
              </div>
            </div>
          </div>

          {/* Main Reading Canvas */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-4 sm:px-12 md:px-24 py-8 sm:py-16 space-y-8 scroll-smooth"
          >
            {/* Script Heading */}
            <div className="max-w-4xl mx-auto border-b border-zinc-800/80 pb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs uppercase font-mono tracking-widest text-emerald-400 font-bold">
                  Take #{currentIndex + 1}
                </span>
                <span className="text-xs text-zinc-500 font-mono">
                  • {words} words • {speakingTime} speaking
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {currentScript.title}
              </h1>
              {currentScript.correctionsNote && (
                <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm">
                  <strong>Fix Reminder:</strong> {currentScript.correctionsNote}
                </div>
              )}
            </div>

            {/* Script Text Body with adjustable font size */}
            <div className="max-w-4xl mx-auto pb-32">
              <div
                className={`font-sans font-normal text-zinc-100 whitespace-pre-wrap selection:bg-emerald-500 selection:text-black tracking-wide ${FONT_SIZES[fontIndex].size}`}
                style={{ wordBreak: 'break-word' }}
              >
                {currentScript.body}
              </div>
            </div>
          </div>

          {/* Bottom Production Controls Bar (Large Mobile Tap Targets) */}
          <div className="px-4 sm:px-8 py-3.5 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md shrink-0 flex items-center justify-between gap-3">
            {/* Previous Script Button */}
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={handlePrevScript}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 min-h-[50px] px-5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-xs sm:text-sm disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Previous Script</span>
              <span className="sm:hidden">Prev</span>
            </button>

            {/* Prominent Mark As Shot Button */}
            <button
              type="button"
              onClick={handleMarkCurrentAsShot}
              className="flex-[2] sm:flex-initial flex items-center justify-center gap-2.5 min-h-[50px] px-6 sm:px-8 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer ring-1 ring-white/20"
            >
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              <span>Mark as Shot &amp; Next</span>
            </button>

            {/* Next Script Button */}
            <button
              type="button"
              disabled={currentIndex >= batchScripts.length - 1}
              onClick={handleNextScript}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 min-h-[50px] px-5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-xs sm:text-sm disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 cursor-pointer"
            >
              <span className="hidden sm:inline">Next Script</span>
              <span className="sm:hidden">Next</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. SESSION COMPLETED CONGRATULATIONS SCREEN */}
      {step === 'completed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-emerald-500/30 mx-auto">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-white">
                Shoot Day Session Complete! 🎉
              </h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                You wrapped <strong>{batchScripts.length}</strong> script(s) today.
                {shotScriptIds.size > 0 && (
                  <span> {shotScriptIds.size} marked as Shot in your vault!</span>
                )}
              </p>
            </div>

            <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl flex items-center justify-around text-xs font-mono">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Scripts</span>
                <span className="text-emerald-400 font-bold text-base">{batchScripts.length}</span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Est. Words</span>
                <span className="text-zinc-200 font-bold text-base">{totalBatchWords}</span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">Spoken Time</span>
                <span className="text-indigo-400 font-bold text-base">{totalBatchSpeaking}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setStep('setup');
                onClose();
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-xl shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            >
              Back to Scripts Board
            </button>
          </div>
        </div>
      )}
    </>
  );
};
