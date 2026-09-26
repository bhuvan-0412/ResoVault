'use client';

import React, { useState } from 'react';
import { Zap, Battery, Moon, Sparkles, Brain, CheckCircle2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { EnergyLevel, EnergyLog } from '@/lib/types';

interface SlotPattern {
  timeSlot: string;
  manualLevel: EnergyLevel | null;
  derivedScore: number | null;
  daysRecorded: number;
  hasTwoWeeksData: boolean;
  completedCount: number;
  totalCount: number;
  effectiveLevel: EnergyLevel;
}

interface EnergyPatternViewProps {
  date: string;
  slotPatterns: Record<string, SlotPattern>;
  onTagSlot: (timeSlot: string, level: EnergyLevel) => Promise<void>;
  isLoading?: boolean;
}

export const EnergyPatternView: React.FC<EnergyPatternViewProps> = ({
  date,
  slotPatterns,
  onTagSlot,
  isLoading = false,
}) => {
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [savingSlot, setSavingSlot] = useState<string | null>(null);

  const hours = Object.keys(slotPatterns).length > 0 
    ? Object.keys(slotPatterns).sort()
    : [
        '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
        '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
        '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
      ];

  const handleSelectLevel = async (slot: string, level: EnergyLevel) => {
    setSavingSlot(slot);
    try {
      await onTagSlot(slot, level);
      setActiveSlot(null);
    } catch (err) {
      console.error('Failed to tag energy slot:', err);
    } finally {
      setSavingSlot(null);
    }
  };

  const getLevelStyle = (level: EnergyLevel | null) => {
    switch (level) {
      case 'high':
        return {
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          dot: 'bg-emerald-400',
          label: 'High Energy',
          icon: Zap,
        };
      case 'medium':
        return {
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400',
          label: 'Medium Energy',
          icon: Battery,
        };
      case 'low':
        return {
          bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          dot: 'bg-blue-400',
          label: 'Low Energy',
          icon: Moon,
        };
      default:
        return {
          bg: 'bg-zinc-800/40 text-zinc-500 border-zinc-800',
          dot: 'bg-zinc-600',
          label: 'Not Tagged',
          icon: Battery,
        };
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-sm">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              Weekly Energy &amp; Focus Rhythm
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-semibold border border-indigo-500/20">
                Phase 2
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Tap any hour to tag energy level • System derives patterns after 14 days of data
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-2.5 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> High Focus
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Medium
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400" /> Low / Fatigue
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <span>{isExpanded ? 'Compact View' : 'Detailed Grid'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Horizontal Strip View (Compact) */}
      <div className="overflow-x-auto pb-1">
        <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-18 gap-1.5 min-w-[580px]">
          {hours.map((hour) => {
            const data = slotPatterns[hour] || {
              timeSlot: hour,
              manualLevel: null,
              derivedScore: null,
              daysRecorded: 0,
              hasTwoWeeksData: false,
              effectiveLevel: 'medium',
            };
            const style = getLevelStyle(data.effectiveLevel || data.manualLevel);
            const isSelected = activeSlot === hour;
            const isSaving = savingSlot === hour;

            return (
              <div key={hour} className="relative">
                <button
                  type="button"
                  onClick={() => setActiveSlot(isSelected ? null : hour)}
                  disabled={isSaving}
                  className={`w-full flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-indigo-500 scale-105 bg-zinc-800'
                      : 'hover:bg-zinc-800/80 bg-zinc-950/60'
                  } ${data.manualLevel ? style.bg : 'border-zinc-800/80 text-zinc-400'}`}
                  title={`${hour}: ${data.manualLevel ? 'Manual: ' + data.manualLevel : 'Untagged'}${
                    data.derivedScore !== null ? ` | Learned Score: ${Math.round(data.derivedScore * 100)}%` : ''
                  }`}
                >
                  <span className="text-[10px] font-mono font-bold text-zinc-300">
                    {hour.slice(0, 2)}:00
                  </span>
                  <div className="my-1">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${style.dot}`} />
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-tight">
                    {data.manualLevel ? data.manualLevel.slice(0, 3) : data.hasTwoWeeksData ? 'LRN' : '—'}
                  </span>
                </button>

                {/* Quick Tap-To-Tag Popover */}
                {isSelected && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-zinc-700/80 p-2 rounded-xl shadow-2xl flex flex-col gap-1 w-32 animate-in fade-in zoom-in-95 duration-150">
                    <div className="text-[10px] font-bold text-zinc-300 pb-1 border-b border-zinc-800 text-center">
                      Tag {hour}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectLevel(hour, 'high')}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all text-left cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>High (Peak)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectLevel(hour, 'medium')}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all text-left cursor-pointer"
                    >
                      <Battery className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Medium</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectLevel(hour, 'low')}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 transition-all text-left cursor-pointer"
                    >
                      <Moon className="w-3 h-3 text-blue-400 shrink-0" />
                      <span>Low (Fatigue)</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Detailed Inspection Grid */}
      {isExpanded && (
        <div className="pt-2 border-t border-zinc-800 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs text-zinc-400 pb-1">
            <span className="font-semibold text-zinc-300">Detailed Slot Analytics &amp; Learning Status</span>
            <span className="text-[11px] text-zinc-500">2-week minimum threshold for learned scores</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {hours.map((hour) => {
              const data = slotPatterns[hour];
              if (!data) return null;
              const hasTwoWeeks = data.hasTwoWeeksData;
              const isManual = Boolean(data.manualLevel);

              return (
                <div
                  key={hour}
                  className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-zinc-200">{hour}</span>
                      {isManual ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                          Manual: {data.manualLevel}
                        </span>
                      ) : hasTwoWeeks ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold flex items-center gap-1">
                          <Brain className="w-2.5 h-2.5" /> Learned: {data.effectiveLevel}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 text-zinc-400 font-mono">
                          {data.daysRecorded}/14 days
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {hasTwoWeeks
                        ? `${Math.round((data.derivedScore || 0) * 100)}% completion rate (${data.completedCount}/${data.totalCount})`
                        : `${14 - data.daysRecorded} more day(s) needed for derived score`}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSelectLevel(hour, 'high')}
                      className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                        data.manualLevel === 'high' ? 'bg-emerald-500 text-white' : 'text-zinc-400 hover:text-emerald-400'
                      }`}
                      title="Set High Energy"
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectLevel(hour, 'medium')}
                      className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                        data.manualLevel === 'medium' ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400 hover:text-amber-400'
                      }`}
                      title="Set Medium Energy"
                    >
                      <Battery className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectLevel(hour, 'low')}
                      className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                        data.manualLevel === 'low' ? 'bg-blue-500 text-white' : 'text-zinc-400 hover:text-blue-400'
                      }`}
                      title="Set Low Energy"
                    >
                      <Moon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
