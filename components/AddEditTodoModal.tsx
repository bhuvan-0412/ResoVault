'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Clock, Calendar, AlertCircle, FileText, Tag, Flame } from 'lucide-react';
import { Deadline, DeadlineStatus, PriorityLevel } from '@/lib/types';

interface AddEditDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deadline: Omit<Deadline, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
  editingDeadline?: Deadline | null;
  editingTodo?: Deadline | null;
}

const DURATION_PRESETS = [
  { label: '30m', value: 30 },
  { label: '45m (Standard)', value: 45 },
  { label: '60m (1 hr)', value: 60 },
  { label: '90m (Deep Work)', value: 90 },
  { label: '120m (2 hrs)', value: 120 },
];

const CATEGORY_PRESETS = ['Academics', 'Assignment', 'Exam Prep', 'Project', 'Reading', 'Personal'];

export const AddEditTodoModal: React.FC<AddEditDeadlineModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingDeadline,
  editingTodo,
}) => {
  const activeItem = editingDeadline || editingTodo;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('23:59');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [status, setStatus] = useState<DeadlineStatus>('not_started');
  const [category, setCategory] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState(45);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeItem) {
      setTitle(activeItem.title);
      setDescription(activeItem.description || '');
      setDueDate(activeItem.dueDate ? activeItem.dueDate.split('T')[0] : '');
      setDueTime(activeItem.dueTime ? activeItem.dueTime.slice(0, 5) : '23:59');
      setPriority(activeItem.priority || 'medium');
      setStatus(activeItem.status || (activeItem.completed ? 'done' : 'not_started'));
      setCategory(activeItem.category || '');
      setEstimatedDuration(activeItem.estimatedDuration || 45);
    } else {
      setTitle('');
      setDescription('');
      // Default: tomorrow
      const d = new Date();
      d.setDate(d.getDate() + 1);
      setDueDate(d.toISOString().split('T')[0]);
      setDueTime('18:00');
      setPriority('medium');
      setStatus('not_started');
      setCategory('');
      setEstimatedDuration(45);
    }
    setError(null);
  }, [activeItem, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a title for the deadline or task');
      return;
    }
    if (!dueDate) {
      setError('Please select a due date');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: activeItem?.id,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        dueTime: dueTime || undefined,
        priority,
        status,
        category: category.trim() || undefined,
        estimatedDuration,
        completed: status === 'done',
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save deadline');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">
                {editingDeadline ? 'Edit Deadline & Task' : 'Add New Deadline & Task'}
              </h3>
              <p className="text-xs text-zinc-400">Scheduled automatically by working backward from due date</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Task / Deadline Title <span className="text-indigo-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Physics Problem Set 4, History Essay Draft"
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              Description / Notes (optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add key requirements, chapters, or submission links..."
              className="w-full px-3.5 py-2 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none"
            />
          </div>

          {/* Due Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Due Date <span className="text-indigo-400">*</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                Due Time (optional)
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-zinc-400" />
                Priority
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['low', 'medium', 'high'] as PriorityLevel[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                      priority === p
                        ? p === 'high'
                          ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                          : p === 'medium'
                          ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                          : 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                        : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Current Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DeadlineStatus)}
                className="w-full px-3 py-2 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Completed</option>
              </select>
            </div>
          </div>

          {/* Category / Subject */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-zinc-400" />
              Category / Subject
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Physics, Math, CS, Personal"
              className="w-full px-3.5 py-2 text-sm bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all mb-1.5"
            />
            <div className="flex flex-wrap gap-1">
              {CATEGORY_PRESETS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                    category === cat
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Work Duration */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>Estimated Work Time</span>
              <span className="text-indigo-400 font-mono text-xs">{estimatedDuration} mins</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setEstimatedDuration(d.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    estimatedDuration === d.value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {d.label}
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
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : editingDeadline ? 'Update Deadline' : 'Create Deadline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
