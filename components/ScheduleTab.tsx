'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flame,
  Plus,
  Sparkles,
  RefreshCw,
  CheckSquare,
  Repeat,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Tag,
  Trash2,
  Edit2,
  CalendarDays,
  ShieldAlert,
  ArrowRight,
  Zap,
  MapPin,
  Camera,
} from 'lucide-react';
import {
  FixedEvent,
  TodoItem,
  GeneratedSchedule,
  ScheduleBlock,
  ScheduleConflict,
  ScheduleStats,
  SchedulePreferences,
  EnergyLevel,
  EnergyLog,
  BlockFeedback,
} from '@/lib/types';
import { AddEditFixedEventModal } from './AddEditFixedEventModal';
import { AddEditTodoModal } from './AddEditTodoModal';
import { NaturalLanguageScheduleModal } from './NaturalLanguageScheduleModal';
import { UploadTimetableModal } from './UploadTimetableModal';
import { EnergyPatternView } from './EnergyPatternView';

interface ScheduleTabProps {
  isAuthenticated: boolean;
  onRequireAuth: () => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  isAuthenticated,
  onRequireAuth,
}) => {
  // Selected date for timetable (default: today)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Active sub-view: 'timetable' | 'todos' | 'fixed' | 'energy' | 'preferences'
  const [activeSubView, setActiveSubView] = useState<'timetable' | 'todos' | 'fixed' | 'energy' | 'preferences'>('timetable');

  // Core data states
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [fixedEvents, setFixedEvents] = useState<FixedEvent[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [energyLogs, setEnergyLogs] = useState<EnergyLog[]>([]);
  const [slotPatterns, setSlotPatterns] = useState<Record<string, any>>({});
  const [activeEnergyPopoverBlockId, setActiveEnergyPopoverBlockId] = useState<string | null>(null);
  const [activeFeedbackBlockId, setActiveFeedbackBlockId] = useState<string | null>(null);
  const [showCategoryStreaks, setShowCategoryStreaks] = useState(false);
  const [stats, setStats] = useState<ScheduleStats>({
    streakDays: 0,
    longestStreakDays: 0,
    dailyCompletionRate: 0,
    weeklyCompletionRate: 0,
    completedBlocksCount: 0,
    totalBlocksCount: 0,
    categoryStreaks: [],
  });
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [preferences, setPreferences] = useState<SchedulePreferences | null>(null);

  // Loading states
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  // Modals
  const [isAddFixedOpen, setIsAddFixedOpen] = useState(false);
  const [editingFixed, setEditingFixed] = useState<FixedEvent | null>(null);
  const [isAddTodoOpen, setIsAddTodoOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isUploadImageModalOpen, setIsUploadImageModalOpen] = useState(false);

  // Filter for todos
  const [todoFilter, setTodoFilter] = useState<'all' | 'open' | 'completed'>('open');

  // 1. Fetch user data (fixed classes, deadlines, preferences, conflicts, energy logs)
  const loadBaseData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [fixedRes, todosRes, conflictsRes, statsRes, energyRes] = await Promise.all([
        fetch('/api/schedule/fixed-classes'),
        fetch('/api/schedule/deadlines'),
        fetch('/api/schedule/conflicts'),
        fetch(`/api/schedule/completions?date=${selectedDate}`),
        fetch(`/api/schedule/energy?date=${selectedDate}`),
      ]);

      if (fixedRes.ok) {
        const data = await fixedRes.json();
        setFixedEvents(data.classes || data.events || []);
      }
      if (todosRes.ok) {
        const data = await todosRes.json();
        setTodos(data.deadlines || data.todos || []);
      }
      if (conflictsRes.ok) {
        const data = await conflictsRes.json();
        setConflicts(data.conflicts || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        if (data.stats) setStats(data.stats);
      }
      if (energyRes.ok) {
        const energyData = await energyRes.json();
        setEnergyLogs(energyData.logs || []);
        setSlotPatterns(energyData.slotPatterns || {});
      }
    } catch (err) {
      console.warn('Error loading schedule base data:', err);
    }
  }, [isAuthenticated, selectedDate]);

  // Tag Energy for a Time Slot (Quick Tap-to-Tag)
  const handleTagEnergySlot = async (timeSlot: string, level: EnergyLevel) => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }

    const hourSlot = timeSlot.includes(':') ? timeSlot.slice(0, 2) + ':00' : '09:00';
    // Optimistic UI update
    setSlotPatterns((prev) => ({
      ...prev,
      [hourSlot]: {
        ...(prev[hourSlot] || { timeSlot: hourSlot }),
        manualLevel: level,
        effectiveLevel: level,
      },
    }));

    try {
      const res = await fetch('/api/schedule/energy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          timeBlock: hourSlot,
          energyLevel: level,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.log) {
          setEnergyLogs((prev) => [...prev.filter((l) => l.timeBlock !== hourSlot), data.log]);
        }
      }
    } catch (err) {
      console.error('Failed to tag energy slot:', err);
    }
  };

  // 2. Fetch or generate timetable for selected date
  const loadTimetable = useCallback(async (force = false) => {
    if (!isAuthenticated) {
      setLoadingSchedule(false);
      return;
    }
    setLoadingSchedule(true);
    try {
      if (force) setRegenerating(true);

      const endpoint = force ? '/api/schedule/generate' : `/api/schedule/generate?date=${selectedDate}`;
      const options = force
        ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: selectedDate, forceRegenerate: true }),
        }
        : { method: 'GET' };

      const res = await fetch(endpoint, options);
      const data = await res.json();

      if (res.status === 409) {
        // Conflict detected
        setConflicts(data.conflicts || []);
      } else if (res.ok) {
        setSchedule(data.schedule || null);
        if (data.conflicts) setConflicts(data.conflicts);
      }

      // Refresh stats
      const statsRes = await fetch(`/api/schedule/completions?date=${selectedDate}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.stats) setStats(statsData.stats);
      }
    } catch (err) {
      console.error('Error generating timetable:', err);
    } finally {
      setLoadingSchedule(false);
      setRegenerating(false);
    }
  }, [isAuthenticated, selectedDate]);

  useEffect(() => {
    loadBaseData();
    loadTimetable(false);
  }, [loadBaseData, loadTimetable]);

  // 3. Mark block as Completed or Skipped
  const handleBlockAction = async (block: ScheduleBlock, status: 'completed' | 'skipped') => {
    if (!isAuthenticated || !schedule) {
      onRequireAuth();
      return;
    }

    // Optimistic UI update
    setSchedule((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        blocks: prev.blocks.map((b) =>
          b.id === block.id
            ? {
              ...b,
              isCompleted: status === 'completed',
              isSkipped: status === 'skipped',
            }
            : b
        ),
      };
    });

    // Open optional quick feedback prompt for this block
    setActiveFeedbackBlockId(block.id);

    const slotHour = block.startTime.slice(0, 2) + ':00';
    const taggedEnergy = slotPatterns[slotHour]?.manualLevel || slotPatterns[slotHour]?.effectiveLevel || block.energyLevelRequired || null;

    try {
      const res = await fetch('/api/schedule/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: schedule.id,
          blockId: block.id,
          date: selectedDate,
          status,
          timeSlot: `${block.startTime}-${block.endTime}`,
          energyLevel: taggedEnergy,
        }),
      });

      // If linked to a todo item and marked done, mark the todo completed too
      if (status === 'completed' && block.todoId) {
        await fetch('/api/schedule/deadlines', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: block.todoId, completed: true, status: 'done' }),
        });
        setTodos((prev) =>
          prev.map((t) => (t.id === block.todoId ? { ...t, completed: true, status: 'done' } : t))
        );
      }

      // Refresh stats & energy patterns
      const [statsRes, energyRes] = await Promise.all([
        fetch(`/api/schedule/completions?date=${selectedDate}`),
        fetch(`/api/schedule/energy?date=${selectedDate}`),
      ]);
      if (statsRes.ok) {
        const sData = await statsRes.json();
        if (sData.stats) setStats(sData.stats);
      }
      if (energyRes.ok) {
        const eData = await energyRes.json();
        setSlotPatterns(eData.slotPatterns || {});
      }
    } catch (err) {
      console.error('Failed to log completion:', err);
    }
  };

  // Submit quick 1-tap feedback for a completed/skipped session
  const handleSendFeedback = async (block: ScheduleBlock, feedback: BlockFeedback) => {
    if (!isAuthenticated || !schedule) return;
    setActiveFeedbackBlockId(null);

    const slotHour = block.startTime.slice(0, 2) + ':00';
    const taggedEnergy =
      slotPatterns[slotHour]?.manualLevel ||
      slotPatterns[slotHour]?.effectiveLevel ||
      block.energyLevelRequired ||
      null;

    try {
      const res = await fetch('/api/schedule/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: schedule.id,
          blockId: block.id,
          date: selectedDate,
          status: block.isCompleted ? 'completed' : 'skipped',
          timeSlot: `${block.startTime}-${block.endTime}`,
          energyLevel: taggedEnergy,
          feedback,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.streaks) {
          setStats((prev) => ({
            ...prev,
            streakDays: data.streaks.dailyAdherence.currentStreak,
            longestStreakDays: data.streaks.dailyAdherence.longestStreak,
            categoryStreaks: data.streaks.categoryStreaks,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to submit session feedback:', err);
    }
  };

  // 4. Fixed Class Handlers
  const handleSaveFixedEvent = async (
    eventData: Omit<FixedEvent, 'id' | 'userId' | 'createdAt'> & { id?: string }
  ) => {
    const isEdit = Boolean(eventData.id);
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch('/api/schedule/fixed-classes', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save fixed class');
    }
    await loadBaseData();
  };

  const handleDeleteFixedEvent = async (id: string) => {
    await fetch(`/api/schedule/fixed-classes?id=${id}`, { method: 'DELETE' });
    setFixedEvents((prev) => prev.filter((e) => e.id !== id));
    await loadBaseData();
  };

  // 5. Deadline / Task Handlers
  const handleSaveTodo = async (
    todoData: Omit<TodoItem, 'id' | 'userId' | 'createdAt' | 'completedAt'> & { id?: string }
  ) => {
    const isEdit = Boolean(todoData.id);
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch('/api/schedule/deadlines', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(todoData),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save deadline');
    }
    await loadBaseData();
  };

  const handleToggleTodoComplete = async (todo: TodoItem) => {
    const nextStatus = todo.status === 'done' || todo.completed ? 'not_started' : 'done';
    const isCompleted = nextStatus === 'done';
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, status: nextStatus, completed: isCompleted } : t))
    );
    await fetch('/api/schedule/deadlines', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: todo.id, status: nextStatus, completed: isCompleted }),
    });
  };

  const handleDeleteTodo = async (id: string) => {
    await fetch(`/api/schedule/deadlines?id=${id}`, { method: 'DELETE' });
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  // Date Shift Helpers
  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  // Filtered Todos List
  const filteredTodos = useMemo(() => {
    if (todoFilter === 'open') return todos.filter((t) => !t.completed);
    if (todoFilter === 'completed') return todos.filter((t) => t.completed);
    return todos;
  }, [todos, todoFilter]);

  // Grouped Fixed Events by Day of Week
  const fixedByDay = useMemo(() => {
    const map: Record<number, FixedEvent[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: [] };
    fixedEvents.forEach((fe) => {
      if (map[fe.dayOfWeek]) map[fe.dayOfWeek].push(fe);
    });
    return map;
  }, [fixedEvents]);

  // Current Time check for highlighting active block
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Motivation Stats Bar */}
      <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title & Streak Badge */}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                Adaptive Timetable &amp; Schedule
              </h2>
              {/* Gamified Daily Adherence Streak Counter (80%+ threshold) */}
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                  stats.streakDays > 0
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-sm shadow-amber-500/10'
                    : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400'
                }`}
                title="Consecutive days completing 80%+ of planned schedule blocks"
              >
                <Flame
                  className={`w-4 h-4 ${
                    stats.streakDays > 0 ? 'text-amber-400 fill-amber-400 animate-pulse' : 'text-zinc-500'
                  }`}
                />
                <span>
                  {stats.streakDays > 0 ? `${stats.streakDays}-Day Streak` : '0-Day Streak'}
                </span>
                {stats.longestStreakDays !== undefined && (
                  <span className="text-[10px] text-zinc-400 font-normal border-l border-zinc-700/80 pl-1.5 ml-0.5">
                    Best: <strong className="text-zinc-300 font-semibold">{stats.longestStreakDays}d</strong>
                  </span>
                )}
              </div>

              {/* Per-Category Streaks Toggle Button */}
              {stats.categoryStreaks && stats.categoryStreaks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCategoryStreaks((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                    showCategoryStreaks
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      : 'bg-zinc-800/70 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Toggle recurring subject & category streaks"
                >
                  <Tag className="w-3 h-3 text-indigo-400" />
                  <span>Subjects ({stats.categoryStreaks.length})</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${
                      showCategoryStreaks ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              Reverse-planned work blocks around your classes, habits, and deadlines
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (!isAuthenticated) return onRequireAuth();
                setEditingTodo(null);
                setIsAddTodoOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-zinc-700/80 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Add Task</span>
            </button>
            <button
              onClick={() => {
                if (!isAuthenticated) return onRequireAuth();
                setEditingFixed(null);
                setIsAddFixedOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold border border-zinc-700/80 transition-all active:scale-95 cursor-pointer"
            >
              <Repeat className="w-3.5 h-3.5 text-violet-400" />
              <span>Add Commitment</span>
            </button>
            <button
              onClick={() => {
                if (!isAuthenticated) return onRequireAuth();
                setIsUploadImageModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 hover:from-violet-500/20 hover:to-fuchsia-500/20 text-violet-300 border border-violet-500/30 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              title="Upload or take a photo of your timetable to extract classes with AI Vision"
            >
              <Camera className="w-3.5 h-3.5 text-violet-400" />
              <span>Upload Timetable</span>
            </button>
            <button
              onClick={() => {
                if (!isAuthenticated) return onRequireAuth();
                setIsAIModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-500/10 to-violet-500/10 hover:from-indigo-500/20 hover:to-violet-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Assistant</span>
            </button>
            <button
              onClick={() => {
                if (!isAuthenticated) return onRequireAuth();
                loadTimetable(true);
              }}
              disabled={regenerating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              <span>{regenerating ? 'Regenerating...' : 'Regenerate'}</span>
            </button>
          </div>
        </div>

        {/* Momentum & Completion Stats Widgets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-zinc-800/80">
          <div className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-800/60">
            <span className="text-[11px] text-zinc-500 block font-medium">Daily Completion</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-lg font-bold text-zinc-100">{stats.dailyCompletionRate}%</span>
              <span className="text-[10px] text-zinc-400 font-mono">
                ({stats.completedBlocksCount}/{stats.totalBlocksCount || 0} blocks)
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(stats.dailyCompletionRate, 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-800/60">
            <span className="text-[11px] text-zinc-500 block font-medium">Weekly Consistency</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-lg font-bold text-zinc-100">{stats.weeklyCompletionRate}%</span>
              <span className="text-[10px] text-emerald-400 font-medium">past 7 days</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(stats.weeklyCompletionRate, 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-800/60">
            <span className="text-[11px] text-zinc-500 block font-medium">Open Tasks</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-lg font-bold text-zinc-100">
                {todos.filter((t) => !t.completed).length}
              </span>
              <span className="text-[10px] text-zinc-400">ready to schedule</span>
            </div>
          </div>

          <div className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-800/60">
            <span className="text-[11px] text-zinc-500 block font-medium">Fixed Commitments</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-lg font-bold text-zinc-100">{fixedEvents.length}</span>
              <span className="text-[10px] text-violet-400">recurring weekly</span>
            </div>
          </div>
        </div>

        {/* Expandable Per-Category / Subject Streaks Tray */}
        {showCategoryStreaks && (
          <div className="mt-4 pt-4 border-t border-zinc-800/80 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                <span>Subject &amp; Task Category Streaks</span>
              </span>
              <span className="text-[11px] text-zinc-500">
                Maintains consistency: breaks only when scheduled &amp; skipped
              </span>
            </div>
            {stats.categoryStreaks && stats.categoryStreaks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {stats.categoryStreaks.map((cs) => (
                  <div
                    key={cs.category}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/70 text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-semibold text-zinc-200 capitalize">{cs.category}</span>
                      <span className="block text-[10px] text-zinc-500">
                        {cs.lastCompletedDate ? `Last completed: ${cs.lastCompletedDate}` : 'In progress'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                      <Flame
                        className={`w-3.5 h-3.5 ${
                          cs.currentStreak > 0 ? 'text-amber-400 fill-amber-400' : 'text-zinc-500'
                        }`}
                      />
                      <span className="font-bold text-amber-300 font-mono">{cs.currentStreak}d</span>
                      {cs.longestStreak > cs.currentStreak && (
                        <span className="text-[10px] text-zinc-500 pl-1 border-l border-zinc-700/60">
                          Best {cs.longestStreak}d
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-1">
                No category streaks active yet. Complete tasks or classes tagged with a category to start building streaks!
              </p>
            )}
          </div>
        )}
      </div>

      {/* 2. Schedule Conflicts & Deadline Risk Warnings Banner */}
      {conflicts.length > 0 && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Overlapping Recurring Classes */}
          {conflicts.some((c) => c.type === 'overlapping_classes' || (!c.type && c.overlapMinutes)) && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-300 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-amber-200 flex items-center gap-2">
                    Recurring Commitment Overlap
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                      Locked Conflict
                    </span>
                  </h4>
                  <div className="mt-2 space-y-1.5">
                    {conflicts
                      .filter((c) => c.type === 'overlapping_classes' || (!c.type && c.overlapMinutes))
                      .map((c, i) => (
                        <p key={i} className="text-xs text-amber-300/90 leading-relaxed font-mono">
                          • {c.message}
                        </p>
                      ))}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={() => setActiveSubView('fixed')}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold border border-amber-500/30 transition-colors cursor-pointer"
                    >
                      Manage Fixed Classes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Unachievable Deadlines Warning */}
          {conflicts.some((c) => c.type === 'unachievable_deadline') && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-300 mt-0.5">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-rose-200 flex items-center gap-2">
                    Deadline Risk: Insufficient Available Time
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold">
                      Action Required
                    </span>
                  </h4>
                  <div className="mt-2 space-y-1.5">
                    {conflicts
                      .filter((c) => c.type === 'unachievable_deadline')
                      .map((c, i) => (
                        <p key={i} className="text-xs text-rose-300/90 leading-relaxed font-mono">
                          • {c.message}
                        </p>
                      ))}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={() => setActiveSubView('todos')}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold border border-rose-500/30 transition-colors cursor-pointer"
                    >
                      Review Deadlines &amp; Tasks Backlog
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Sub-Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <button
            onClick={() => setActiveSubView('timetable')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeSubView === 'timetable'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
          >
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Daily Timetable</span>
          </button>
          <button
            onClick={() => setActiveSubView('todos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeSubView === 'todos'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Tasks Backlog ({todos.filter((t) => !t.completed).length})</span>
          </button>
          <button
            onClick={() => setActiveSubView('fixed')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeSubView === 'fixed'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
          >
            <Repeat className="w-3.5 h-3.5 text-violet-400" />
            <span>Recurring Commitments ({fixedEvents.length})</span>
          </button>
          <button
            onClick={() => setActiveSubView('energy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeSubView === 'energy'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Energy Rhythm</span>
          </button>
        </div>

        {/* Date Selector for Timetable View */}
        {activeSubView === 'timetable' && (
          <div className="flex items-center gap-1.5 bg-zinc-900 rounded-xl p-1 border border-zinc-800">
            <button
              onClick={() => shiftDate(-1)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2 py-1 text-xs font-semibold bg-transparent text-zinc-200 focus:outline-none border-0"
            />
            {isToday ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold mr-1">
                Today
              </span>
            ) : (
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold mr-1 transition-colors"
              >
                Today
              </button>
            )}
            <button
              onClick={() => shiftDate(1)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 4. Sub-View: Daily Timetable */}
      {activeSubView === 'timetable' && (
        <div className="space-y-4">
          {/* Energy Rhythm Strip & Tap-to-Tag View */}
          <EnergyPatternView
            date={selectedDate}
            slotPatterns={slotPatterns}
            onTagSlot={handleTagEnergySlot}
          />

          {/* AI Strategy Summary Card */}
          {schedule?.summary && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-zinc-900 to-violet-950/40 border border-indigo-500/20 text-xs flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400 mt-0.5">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-semibold text-zinc-200">ML Daily Plan Insights</p>
                <p className="text-zinc-400 mt-0.5 leading-relaxed">{schedule.summary}</p>
              </div>
            </div>
          )}

          {/* Timeline Blocks */}
          {loadingSchedule ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-500 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Generating ML-optimized daily schedule...</p>
            </div>
          ) : schedule && schedule.blocks.length > 0 ? (
            <div className="relative border-l-2 border-zinc-800 pl-4 sm:pl-6 ml-3 sm:ml-4 space-y-3.5">
              {schedule.blocks.map((block) => {
                const startMins = parseInt(block.startTime.split(':')[0]) * 60 + parseInt(block.startTime.split(':')[1]);
                const endMins = parseInt(block.endTime.split(':')[0]) * 60 + parseInt(block.endTime.split(':')[1]);
                const isCurrentTimeSlot = isToday && currentMinutes >= startMins && currentMinutes < endMins;

                // Color accent based on type
                let typeBadgeColor = 'bg-zinc-800 text-zinc-300';
                let cardBorder = 'border-zinc-800/80';
                let cardBg = 'bg-zinc-900/60';

                if (block.type === 'fixed') {
                  typeBadgeColor = 'bg-violet-500/10 text-violet-400 border border-violet-500/20';
                  cardBorder = 'border-violet-500/20';
                } else if (block.type === 'todo') {
                  typeBadgeColor = 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
                  cardBorder = 'border-indigo-500/20';
                } else if (block.type === 'meal') {
                  typeBadgeColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                }

                if (block.isCompleted) {
                  cardBg = 'bg-emerald-950/20';
                  cardBorder = 'border-emerald-500/30';
                } else if (block.isSkipped) {
                  cardBg = 'bg-zinc-950/40 opacity-60';
                } else if (isCurrentTimeSlot) {
                  cardBorder = 'border-indigo-500 ring-2 ring-indigo-500/20';
                  cardBg = 'bg-zinc-900';
                }

                const slotHour = block.startTime.slice(0, 2) + ':00';
                const slotData = slotPatterns[slotHour];
                const currentEnergy = slotData?.manualLevel || slotData?.effectiveLevel || block.energyLevelRequired || null;
                const isEnergyPopoverOpen = activeEnergyPopoverBlockId === block.id;

                return (
                  <div
                    key={block.id}
                    className={`relative p-4 rounded-2xl border transition-all ${cardBg} ${cardBorder}`}
                  >
                    {/* Time Dot Indicator */}
                    <div
                      className={`absolute -left-[23px] sm:-left-[31px] top-5 w-3.5 h-3.5 rounded-full border-2 border-zinc-950 transition-all ${
                        block.isCompleted
                          ? 'bg-emerald-500'
                          : block.isSkipped
                          ? 'bg-zinc-600'
                          : isCurrentTimeSlot
                          ? 'bg-indigo-500 ring-4 ring-indigo-500/20 animate-pulse'
                          : 'bg-zinc-700'
                      }`}
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Time, Title, Reason */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-zinc-200">
                            {block.startTime} – {block.endTime}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${typeBadgeColor}`}>
                            {block.type === 'fixed'
                              ? 'Fixed Commitment'
                              : block.type === 'todo'
                              ? 'Priority Focus'
                              : block.type === 'meal'
                              ? 'Break & Meal'
                              : 'Routine'}
                          </span>
                          {block.priority && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                                block.priority === 'high'
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  : block.priority === 'medium'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {block.priority}
                            </span>
                          )}
                          {isCurrentTimeSlot && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500 text-white font-bold animate-pulse">
                              NOW
                            </span>
                          )}
                        </div>

                        <h4
                          className={`text-sm font-bold ${
                            block.isCompleted
                              ? 'line-through text-zinc-400'
                              : block.isSkipped
                              ? 'line-through text-zinc-500'
                              : 'text-zinc-100'
                          }`}
                        >
                          {block.title}
                        </h4>

                        {block.reason && (
                          <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                            <span className="text-indigo-400">💡</span>
                            <span>{block.reason}</span>
                          </p>
                        )}
                      </div>

                      {/* Right: Interactive Completion & Fast Energy Tag Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Quick 1-Tap Energy Tag Popover */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveEnergyPopoverBlockId(isEnergyPopoverOpen ? null : block.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              currentEnergy === 'high'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                : currentEnergy === 'medium'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                                : currentEnergy === 'low'
                                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/20'
                                : 'bg-zinc-800/90 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
                            }`}
                            title={`Tap to tag energy level for ${slotHour}`}
                          >
                            <Zap className={`w-3 h-3 ${
                              currentEnergy === 'high' ? 'text-emerald-400 fill-emerald-400' :
                              currentEnergy === 'medium' ? 'text-amber-400 fill-amber-400' :
                              currentEnergy === 'low' ? 'text-blue-400' : 'text-zinc-500'
                            }`} />
                            <span className="capitalize">
                              {currentEnergy ? `${currentEnergy}` : 'Energy'}
                            </span>
                          </button>

                          {isEnergyPopoverOpen && (
                            <div className="absolute right-0 top-full mt-1.5 z-50 bg-zinc-900 border border-zinc-700/80 p-1.5 rounded-xl shadow-2xl flex items-center gap-1 animate-in fade-in zoom-in-95 duration-100">
                              <button
                                type="button"
                                onClick={() => {
                                  handleTagEnergySlot(slotHour, 'high');
                                  setActiveEnergyPopoverBlockId(null);
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                                <span>High</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleTagEnergySlot(slotHour, 'medium');
                                  setActiveEnergyPopoverBlockId(null);
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer"
                              >
                                <span>Med</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleTagEnergySlot(slotHour, 'low');
                                  setActiveEnergyPopoverBlockId(null);
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 transition-all cursor-pointer"
                              >
                                <span>Low</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {block.isCompleted ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completed
                          </span>
                        ) : block.isSkipped ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-xl">
                            <XCircle className="w-3.5 h-3.5" />
                            Skipped
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleBlockAction(block, 'completed')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                              title="Mark as completed"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Done</span>
                            </button>
                            <button
                              onClick={() => handleBlockAction(block, 'skipped')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                              title="Skip this block"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Skip</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Optional 1-Tap Feedback Prompt */}
                    {activeFeedbackBlockId === block.id && (
                      <div className="mt-3 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium">
                          <span>✨ How did this session feel?</span>
                          <span className="text-[10px] text-zinc-500">(1-tap feedback)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSendFeedback(block, 'great')}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer flex items-center gap-1"
                            title="Felt energized, completed smoothly"
                          >
                            <span>⚡ Energized</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendFeedback(block, 'good')}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer flex items-center gap-1"
                            title="Normal, steady progress"
                          >
                            <span>👍 Good</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendFeedback(block, 'tough')}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1"
                            title="Exhausting or distracting slot"
                          >
                            <span>😴 Draining</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveFeedbackBlockId(null)}
                            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer text-xs ml-1"
                            title="Dismiss"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6">
              <Clock className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
              <h4 className="text-base font-bold text-zinc-200">No schedule generated for this date</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                Click Regenerate to generate a balanced ML timetable tailored to your commitments and tasks.
              </p>
              <button
                onClick={() => {
                  if (!isAuthenticated) return onRequireAuth();
                  loadTimetable(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
              >
                Generate Daily Timetable
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. Sub-View: Task Backlog (Todos) */}
      {activeSubView === 'todos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTodoFilter('open')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${todoFilter === 'open'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                Open Tasks ({todos.filter((t) => !t.completed).length})
              </button>
              <button
                onClick={() => setTodoFilter('completed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${todoFilter === 'completed'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                Completed ({todos.filter((t) => t.completed).length})
              </button>
              <button
                onClick={() => setTodoFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${todoFilter === 'all'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                All
              </button>
            </div>

            <button
              onClick={() => {
                setEditingTodo(null);
                setIsAddTodoOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Task</span>
            </button>
          </div>

          {filteredTodos.length > 0 ? (
            <div className="space-y-2.5">
              {filteredTodos.map((todo) => {
                const isDueSoon =
                  todo.dueDate &&
                  new Date(todo.dueDate).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000;
                const isDone = todo.status === 'done' || todo.completed;
                const isInProgress = todo.status === 'in_progress';

                return (
                  <div
                    key={todo.id}
                    className={`p-3.5 rounded-xl bg-zinc-900/80 border transition-all flex items-center justify-between gap-3 ${isDone
                        ? 'border-zinc-800/50 opacity-60'
                        : isDueSoon
                          ? 'border-amber-500/30'
                          : 'border-zinc-800'
                      }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => handleToggleTodoComplete(todo)}
                        className="mt-1 w-4 h-4 rounded text-indigo-600 bg-zinc-950 border-zinc-700 accent-indigo-500 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-xs font-semibold truncate ${isDone ? 'line-through text-zinc-500' : 'text-zinc-100'
                              }`}
                          >
                            {todo.title}
                          </p>
                          {/* Status Badge */}
                          <button
                            type="button"
                            onClick={() => handleToggleTodoComplete(todo)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${isDone
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : isInProgress
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                              }`}
                          >
                            {isDone ? 'Done' : isInProgress ? 'In Progress' : 'Not Started'}
                          </button>
                        </div>

                        {todo.description && (
                          <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                            {todo.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-zinc-400">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase ${todo.priority === 'high'
                                ? 'bg-red-500/10 text-red-400'
                                : todo.priority === 'medium'
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-emerald-500/10 text-emerald-400'
                              }`}
                          >
                            {todo.priority}
                          </span>
                          <span>• {todo.estimatedDuration || 45} mins</span>
                          {todo.dueDate && (
                            <span
                              className={`flex items-center gap-1 ${isDueSoon ? 'text-amber-400 font-semibold' : 'text-zinc-400'
                                }`}
                            >
                              <Calendar className="w-3 h-3" />
                              {new Date(todo.dueDate).toLocaleDateString()}
                              {todo.dueTime && ` at ${todo.dueTime.slice(0, 5)}`}
                            </span>
                          )}
                          {todo.category && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-[10px] text-zinc-300">
                              {todo.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingTodo(todo);
                          setIsAddTodoOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                        title="Edit Task"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        title="Delete Task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
              <CheckSquare className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-zinc-200">No tasks found</h4>
              <p className="text-xs text-zinc-400 mt-1 mb-4">
                Add study goals or work tasks to have them automatically reverse-planned into your free schedule slots.
              </p>
              <button
                onClick={() => {
                  if (!isAuthenticated) return onRequireAuth();
                  setEditingTodo(null);
                  setIsAddTodoOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                + Add Task
              </button>
            </div>
          )}
        </div>
      )}

      {/* 6. Sub-View: Weekly Commitments (Fixed Events) */}
      {activeSubView === 'fixed' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-200">Weekly Recurring Commitments</h3>
              <p className="text-xs text-zinc-400">Classes, fitness, and fixed meetings that cannot be moved</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) return onRequireAuth();
                  setIsUploadImageModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-semibold shadow-sm transition-all cursor-pointer"
                title="Upload timetable photo or screenshot"
              >
                <Camera className="w-3.5 h-3.5 text-violet-400" />
                <span>Upload Timetable</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) return onRequireAuth();
                  setIsAIModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 text-xs font-semibold transition-all cursor-pointer"
                title="Enter schedule in plain English"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Free Text</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) return onRequireAuth();
                  setEditingFixed(null);
                  setIsAddFixedOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Commitment</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 0].map((dayNum) => {
              const dayEvents = fixedByDay[dayNum] || [];
              const dayName = DAY_NAMES[dayNum];

              return (
                <div key={dayNum} className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-col">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
                    <span className="text-xs font-bold text-zinc-200">{dayName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                      {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {dayEvents.length > 0 ? (
                    <div className="space-y-2 flex-1">
                      {dayEvents.map((fe) => {
                        const colorMap: Record<string, string> = {
                          indigo: 'border-l-indigo-500 text-indigo-400',
                          violet: 'border-l-violet-500 text-violet-400',
                          emerald: 'border-l-emerald-500 text-emerald-400',
                          amber: 'border-l-amber-500 text-amber-400',
                          rose: 'border-l-rose-500 text-rose-400',
                          sky: 'border-l-sky-500 text-sky-400',
                        };
                        const colorClass = colorMap[fe.color || 'indigo'] || 'border-l-violet-500 text-violet-400';

                        return (
                          <div
                            key={fe.id}
                            className={`p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 border-l-4 flex items-center justify-between gap-2 ${colorClass}`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-zinc-100 truncate">{fe.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono">
                                <span>
                                  {fe.startTime.slice(0, 5)} – {fe.endTime.slice(0, 5)}
                                </span>
                                {fe.location && (
                                  <span className="flex items-center gap-0.5 text-zinc-400 font-sans text-[10px]">
                                    <MapPin className="w-2.5 h-2.5" />
                                    {fe.location}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingFixed(fe);
                                  setIsAddFixedOpen(true);
                                }}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-200"
                                title="Edit"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteFixedEvent(fe.id)}
                                className="p-1 rounded text-zinc-400 hover:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 italic py-4 text-center">No fixed events scheduled</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. Sub-View: Energy Rhythm & Analytics */}
      {activeSubView === 'energy' && (
        <div className="space-y-4">
          <EnergyPatternView
            date={selectedDate}
            slotPatterns={slotPatterns}
            onTagSlot={handleTagEnergySlot}
          />
        </div>
      )}

      {/* Modals */}
      <AddEditFixedEventModal
        isOpen={isAddFixedOpen}
        onClose={() => {
          setIsAddFixedOpen(false);
          setEditingFixed(null);
        }}
        onSave={handleSaveFixedEvent}
        editingEvent={editingFixed}
      />

      <AddEditTodoModal
        isOpen={isAddTodoOpen}
        onClose={() => {
          setIsAddTodoOpen(false);
          setEditingTodo(null);
        }}
        onSave={handleSaveTodo}
        editingTodo={editingTodo}
      />

      <NaturalLanguageScheduleModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onSuccess={() => {
          loadBaseData();
          loadTimetable(true);
        }}
      />

      <UploadTimetableModal
        isOpen={isUploadImageModalOpen}
        onClose={() => setIsUploadImageModalOpen(false)}
        onSuccess={async () => {
          setIsUploadImageModalOpen(false);
          await loadBaseData();
          await loadTimetable(true);
        }}
        existingClasses={fixedEvents}
      />
    </div>
  );
};
