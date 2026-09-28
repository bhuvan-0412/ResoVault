import { ScriptStatus } from './types';

export function calculateWordCount(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function calculateSpeakingTime(words: number, wordsPerMinute: number = 150): string {
  if (words <= 0) return '0s';
  const totalSeconds = Math.round((words / wordsPerMinute) * 60);
  if (totalSeconds < 60) {
    return `~${totalSeconds}s`;
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return secs > 0 ? `~${mins}m ${secs}s` : `~${mins}m`;
}

export function formatScriptMetrics(text: string): { words: number; speakingTime: string } {
  const words = calculateWordCount(text);
  const speakingTime = calculateSpeakingTime(words);
  return { words, speakingTime };
}

export interface StatusConfig {
  id: ScriptStatus;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  columnBg: string;
  columnBorder: string;
  accentColor: string;
  nextStatus?: ScriptStatus;
  nextActionLabel?: string;
}

export const SCRIPT_STATUS_CONFIG: Record<ScriptStatus, StatusConfig> = {
  needs_corrections: {
    id: 'needs_corrections',
    label: 'Needs Corrections',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/30',
    columnBg: 'bg-amber-950/10',
    columnBorder: 'border-amber-500/20',
    accentColor: 'amber',
    nextStatus: 'ready_to_shoot',
    nextActionLabel: 'Ready to Shoot',
  },
  ready_to_shoot: {
    id: 'ready_to_shoot',
    label: 'Ready to Shoot',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/30',
    columnBg: 'bg-emerald-950/10',
    columnBorder: 'border-emerald-500/20',
    accentColor: 'emerald',
    nextStatus: 'shot',
    nextActionLabel: 'Mark as Shot',
  },
  shot: {
    id: 'shot',
    label: 'Shot',
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-400',
    badgeBorder: 'border-indigo-500/30',
    columnBg: 'bg-indigo-950/10',
    columnBorder: 'border-indigo-500/20',
    accentColor: 'indigo',
    nextStatus: 'posted',
    nextActionLabel: 'Mark as Posted',
  },
  posted: {
    id: 'posted',
    label: 'Posted',
    badgeBg: 'bg-violet-500/10',
    badgeText: 'text-violet-300',
    badgeBorder: 'border-violet-500/30',
    columnBg: 'bg-violet-950/10',
    columnBorder: 'border-violet-500/20',
    accentColor: 'violet',
  },
};

export const SCRIPT_STATUS_ORDER: ScriptStatus[] = [
  'needs_corrections',
  'ready_to_shoot',
  'shot',
  'posted',
];
