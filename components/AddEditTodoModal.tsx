'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Clock, Calendar, AlertCircle } from 'lucide-react';
import { TodoItem, TodoPriority } from '@/lib/types';

interface AddEditTodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (todo: Omit<TodoItem, 'id' | 'userId' | 'createdAt' | 'completedAt'> & { id?: string }) => Promise<void>;
  editingTodo?: TodoItem | null;
}

const DURATION_PRESETS = [
  { label: '25m (Pomodoro)', value: 25 },
  { label: '45m (Standard)', value: 45 },
  { label: '60m (1 Hour)', value: 60 },
  { label: '90m (Deep Work)', value: 90 },
];

export const AddEditTodoModal: React.FC<AddEditTodoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTodo,
}) => {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [estimatedDuration, setEstimatedDuration] = useState(45);
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingTodo) {
      setTitle(editingTodo.title);
      setDueDate(editingTodo.dueDate ? editingTodo.dueDate.slice(0, 16) : '');
      setPriority(editingTodo.priority || 'medium');
      setEstimatedDuration(editingTodo.estimatedDuration || 45);
      setCategory(editingTodo.category || '');
    } else {
      setTitle('');
      // Default due date: tomorrow at 18:00
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(18, 0, 0, 0);
      setDueDate(d.toISOString().slice(0, 16));
      setPriority('medium');
      setEstimatedDuration(45);
      setCategory('');
    }
    setError(null);
  }, [editingTodo, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a task title');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: editingTodo?.id,
        title: title.trim(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        priority,
        estimatedDuration,
        category: category.trim() || undefined,
        completed: editingTodo?.completed || false,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save task');
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
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">
                {editingTodo ? 'Edit Task' : 'Add Task / Study Item'}
              </h3>
              <p className="text-xs text-zinc-400">Reverse-planned into your free timetable slots</p>
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
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Task Title <span className="text-indigo-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Finish Distributed Systems assignment, Prep slides"
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Priority</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPriority('high')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  priority === 'high'
                    ? 'bg-red-500/20 border-red-500 text-red-300 shadow-sm shadow-red-500/20'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                🔴 High
              </button>
              <button
                type="button"
                onClick={() => setPriority('medium')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  priority === 'medium'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/20'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                🟡 Medium
              </button>
              <button
                type="button"
                onClick={() => setPriority('low')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  priority === 'low'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                🟢 Low
              </button>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Due Date &amp; Deadline (Optional)
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              The scheduler reverse-plans study blocks prior to this deadline.
            </p>
          </div>

          {/* Estimated Duration */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Estimated Duration: <span className="text-indigo-400">{estimatedDuration} minutes</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setEstimatedDuration(p.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    estimatedDuration === p.value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="15"
              max="180"
              step="15"
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Category / Subject</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Computer Science, Math, Personal, Startup"
              className="w-full px-3.5 py-2 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
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
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingTodo ? 'Update Task' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
