'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Tag, Sparkles } from 'lucide-react';
import { FixedEvent, DayOfWeek } from '@/lib/types';

interface AddEditFixedEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<FixedEvent, 'id' | 'userId' | 'createdAt'> & { id?: string }) => Promise<void>;
  editingEvent?: FixedEvent | null;
}

const DAY_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

const CATEGORY_PRESETS = ['Class / Lecture', 'Work / Standup', 'Gym & Fitness', 'Study Group', 'Personal Routine'];

export const AddEditFixedEventModal: React.FC<AddEditFixedEventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingEvent,
}) => {
  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [category, setCategory] = useState('Class / Lecture');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title);
      setDayOfWeek(editingEvent.dayOfWeek);
      setStartTime(editingEvent.startTime.slice(0, 5));
      setEndTime(editingEvent.endTime.slice(0, 5));
      setCategory(editingEvent.category || 'Class / Lecture');
    } else {
      setTitle('');
      setDayOfWeek(1);
      setStartTime('09:00');
      setEndTime('10:30');
      setCategory('Class / Lecture');
    }
    setError(null);
  }, [editingEvent, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a title for the commitment');
      return;
    }
    if (startTime >= endTime) {
      setError('End time must be later than start time');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: editingEvent?.id,
        title: title.trim(),
        dayOfWeek,
        startTime,
        endTime,
        category,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save commitment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">
                {editingEvent ? 'Edit Recurring Commitment' : 'Add Recurring Commitment'}
              </h3>
              <p className="text-xs text-zinc-400">Fixed non-negotiable class, gym, or meeting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Title <span className="text-violet-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Physics 101 Lecture, Gym Push Day"
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all"
            />
          </div>

          {/* Day of Week */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Day of Week <span className="text-violet-400">*</span>
            </label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10) as DayOfWeek)}
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all"
            >
              {DAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Start Time <span className="text-violet-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                End Time <span className="text-violet-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Category Presets */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CATEGORY_PRESETS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    category === cat
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingEvent ? 'Update Commitment' : 'Add Commitment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
