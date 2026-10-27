import { ScriptItem, ScriptStatus } from './types';

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
  helper: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  columnBg: string;
  columnBorder: string;
  accentColor: string;
  dotClass: string;
  nextStatus?: ScriptStatus;
  nextActionLabel?: string;
}

// DB status values are unchanged; only the labels differ from the old 4 stages.
export const SCRIPT_STATUS_CONFIG: Record<ScriptStatus, StatusConfig> = {
  needs_corrections: {
    id: 'needs_corrections',
    label: 'Draft',
    helper: 'Written, still needs work',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/30',
    columnBg: 'bg-amber-950/10',
    columnBorder: 'border-amber-500/20',
    accentColor: 'amber',
    dotClass: 'bg-amber-400 shadow-sm shadow-amber-400/50',
    nextStatus: 'ready_to_shoot',
    nextActionLabel: 'Mark Ready',
  },
  ready_to_shoot: {
    id: 'ready_to_shoot',
    label: 'Ready to Shoot',
    helper: 'Polished, ready for the camera',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/30',
    columnBg: 'bg-emerald-950/10',
    columnBorder: 'border-emerald-500/20',
    accentColor: 'emerald',
    dotClass: 'bg-emerald-400 shadow-sm shadow-emerald-400/50',
    nextStatus: 'shot',
    nextActionLabel: 'Mark as Shot',
  },
  shot: {
    id: 'shot',
    label: 'Shot / Editing',
    helper: 'Filmed, needs editing',
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-400',
    badgeBorder: 'border-indigo-500/30',
    columnBg: 'bg-indigo-950/10',
    columnBorder: 'border-indigo-500/20',
    accentColor: 'indigo',
    dotClass: 'bg-indigo-400 shadow-sm shadow-indigo-400/50',
    nextStatus: 'posted',
    nextActionLabel: 'Mark as Posted',
  },
  posted: {
    id: 'posted',
    label: 'Posted',
    helper: 'Live and published',
    badgeBg: 'bg-violet-500/10',
    badgeText: 'text-violet-300',
    badgeBorder: 'border-violet-500/30',
    columnBg: 'bg-violet-950/10',
    columnBorder: 'border-violet-500/20',
    accentColor: 'violet',
    dotClass: 'bg-violet-400 shadow-sm shadow-violet-400/50',
  },
};

export const SCRIPT_STATUS_ORDER: ScriptStatus[] = [
  'needs_corrections',
  'ready_to_shoot',
  'shot',
  'posted',
];

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export type ScriptSortKey =
  | 'custom'
  | 'created_desc'
  | 'created_asc'
  | 'updated_desc'
  | 'updated_asc'
  | 'shot_desc'
  | 'shot_asc'
  | 'posted_desc'
  | 'posted_asc'
  | 'title_asc'
  | 'title_desc'
  | 'length_asc'
  | 'length_desc';

export const SORT_LABELS: Record<ScriptSortKey, string> = {
  custom: 'Custom order',
  created_desc: 'Created · newest',
  created_asc: 'Created · oldest',
  updated_desc: 'Updated · newest',
  updated_asc: 'Updated · oldest',
  shot_desc: 'Shot date · newest',
  shot_asc: 'Shot date · oldest',
  posted_desc: 'Posted date · newest',
  posted_asc: 'Posted date · oldest',
  title_asc: 'Title A–Z',
  title_desc: 'Title Z–A',
  length_asc: 'Length · shortest',
  length_desc: 'Length · longest',
};

export function sortOptionsFor(status: ScriptStatus): ScriptSortKey[] {
  const keys: ScriptSortKey[] = ['custom', 'created_desc', 'created_asc', 'updated_desc', 'updated_asc'];
  if (status === 'shot' || status === 'posted') keys.push('shot_desc', 'shot_asc');
  if (status === 'posted') keys.push('posted_desc', 'posted_asc');
  keys.push('title_asc', 'title_desc', 'length_asc', 'length_desc');
  return keys;
}

export const DEFAULT_SORTS: Record<ScriptStatus, ScriptSortKey> = {
  needs_corrections: 'custom',
  ready_to_shoot: 'custom',
  shot: 'custom',
  posted: 'custom',
};

export function isScriptSortKey(value: unknown): value is ScriptSortKey {
  return typeof value === 'string' && value in SORT_LABELS;
}

const time = (iso?: string | null): number => (iso ? new Date(iso).getTime() : 0);

export const POSITION_STEP = 1000;
const MIN_POSITION_GAP = 0.001;

/** Default order for a column when a script has no position yet (matches the SQL backfill). */
function defaultCompare(status: ScriptStatus): (a: ScriptItem, b: ScriptItem) => number {
  switch (status) {
    case 'needs_corrections':
      return (a, b) => time(b.createdAt) - time(a.createdAt);
    case 'ready_to_shoot':
      return (a, b) => time(a.updatedAt) - time(b.updatedAt);
    case 'shot':
      return (a, b) => time(a.shotAt || a.createdAt) - time(b.shotAt || b.createdAt);
    default:
      return (a, b) =>
        time(a.postedAt || a.shotAt || a.createdAt) - time(b.postedAt || b.shotAt || b.createdAt);
  }
}

/** Gives every script a position. Rows that already have one are untouched; the rest follow the default order. */
export function normalizePositions(scripts: ScriptItem[]): ScriptItem[] {
  const assigned = new Map<string, number>();
  for (const status of SCRIPT_STATUS_ORDER) {
    const column = scripts.filter((s) => s.status === status);
    const missing = column.filter((s) => s.position == null).sort(defaultCompare(status));
    if (missing.length === 0) continue;
    const base = column.reduce((max, s) => (s.position != null ? Math.max(max, s.position) : max), 0);
    missing.forEach((s, i) => assigned.set(s.id, base + (i + 1) * POSITION_STEP));
  }
  if (assigned.size === 0) return scripts;
  return scripts.map((s) => (assigned.has(s.id) ? { ...s, position: assigned.get(s.id) } : s));
}

const byPosition = (a: ScriptItem, b: ScriptItem) =>
  (a.position ?? 0) - (b.position ?? 0) || time(a.createdAt) - time(b.createdAt);

/** Scripts of one status in custom (position) order. */
export function customOrder(scripts: ScriptItem[], status: ScriptStatus): ScriptItem[] {
  return scripts.filter((s) => s.status === status).sort(byPosition);
}

export function sortScripts(list: ScriptItem[], key: ScriptSortKey): ScriptItem[] {
  const copy = [...list];
  const byTitle = (a: ScriptItem, b: ScriptItem) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  switch (key) {
    case 'custom':
      return copy.sort(byPosition);
    case 'created_desc':
      return copy.sort((a, b) => time(b.createdAt) - time(a.createdAt));
    case 'created_asc':
      return copy.sort((a, b) => time(a.createdAt) - time(b.createdAt));
    case 'updated_desc':
      return copy.sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
    case 'updated_asc':
      return copy.sort((a, b) => time(a.updatedAt) - time(b.updatedAt));
    case 'shot_desc':
      return copy.sort((a, b) => time(b.shotAt) - time(a.shotAt));
    case 'shot_asc':
      return copy.sort((a, b) => time(a.shotAt) - time(b.shotAt));
    case 'posted_desc':
      return copy.sort((a, b) => time(b.postedAt) - time(a.postedAt));
    case 'posted_asc':
      return copy.sort((a, b) => time(a.postedAt) - time(b.postedAt));
    case 'title_asc':
      return copy.sort(byTitle);
    case 'title_desc':
      return copy.sort((a, b) => byTitle(b, a));
    case 'length_asc':
      return copy.sort((a, b) => calculateWordCount(a.body) - calculateWordCount(b.body));
    case 'length_desc':
      return copy.sort((a, b) => calculateWordCount(b.body) - calculateWordCount(a.body));
  }
}

// ---------------------------------------------------------------------------
// Fractional positions
// ---------------------------------------------------------------------------

/**
 * Cards entering these columns land at the bottom instead of the top, so the newest
 * posted video gets the highest number (#1 stays the first one ever posted).
 */
export const LANDS_AT_BOTTOM: Record<ScriptStatus, boolean> = {
  needs_corrections: false,
  ready_to_shoot: false,
  shot: false,
  posted: true,
};

export interface PositionMove {
  id: string;
  position: number;
  status?: ScriptStatus;
}

/**
 * Plans the writes needed to put `moverId` at `index` of `rest` (the target column in
 * custom order, mover excluded). Normally only the mover is written, at the midpoint of
 * its new neighbours. If that gap has become too small the whole column is renumbered.
 */
export function planMove(
  rest: ScriptItem[],
  moverId: string,
  index: number,
  status?: ScriptStatus
): PositionMove[] {
  const at = Math.max(0, Math.min(index, rest.length));
  const prev = rest[at - 1]?.position ?? null;
  const next = rest[at]?.position ?? null;

  let position: number;
  let crowded = false;
  if (prev === null && next === null) position = POSITION_STEP;
  else if (prev === null) position = (next as number) - POSITION_STEP;
  else if (next === null) position = prev + POSITION_STEP;
  else {
    position = (prev + next) / 2;
    crowded = next - prev < MIN_POSITION_GAP * 2;
  }

  if (!crowded) return [{ id: moverId, position, status }];

  const order = rest.map((s) => s.id);
  order.splice(at, 0, moverId);
  const current = new Map(rest.map((s) => [s.id, s.position]));
  const moves: PositionMove[] = [];
  order.forEach((id, i) => {
    const target = (i + 1) * POSITION_STEP;
    if (id === moverId) moves.push({ id, position: target, status });
    else if (current.get(id) !== target) moves.push({ id, position: target });
  });
  return moves;
}

// ---------------------------------------------------------------------------
// Dates & blocks
// ---------------------------------------------------------------------------

export function formatShortDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** The date line shown on a card: "Posted 12 Oct", "Shot 3 Oct", "Created 5 Oct". */
export function scriptDateLabel(script: ScriptItem): string {
  switch (script.status) {
    case 'posted':
      return `Posted ${formatShortDate(script.postedAt || script.shotAt || script.createdAt)}`;
    case 'shot':
      return `Shot ${formatShortDate(script.shotAt || script.createdAt)}`;
    case 'ready_to_shoot':
      return `Updated ${formatShortDate(script.updatedAt)}`;
    default:
      return `Created ${formatShortDate(script.createdAt)}`;
  }
}

/** ISO timestamp -> local YYYY-MM-DD for <input type="date">. */
export function toDateInputValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local YYYY-MM-DD -> ISO at local noon (avoids off-by-one-day across timezones). */
export function fromDateInputValue(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).toISOString();
}

/** One paragraph (separated by blank lines) = one block. */
export function splitBlocks(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
}
