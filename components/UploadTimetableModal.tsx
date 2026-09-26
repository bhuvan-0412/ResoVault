'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  FileImage,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Info,
  Sliders,
  Trash2,
} from 'lucide-react';
import { FixedEvent, DayOfWeek, ExtractedClassCandidate, ConflictResolution } from '@/lib/types';

interface UploadTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingClasses: FixedEvent[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const UploadTimetableModal: React.FC<UploadTimetableModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingClasses,
}) => {
  // Step state: 'upload' -> 'processing' -> 'review' -> 'success'
  const [step, setStep] = useState<'upload' | 'processing' | 'review' | 'success'>('upload');

  // Image states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Vision extraction results & candidates
  const [extractedTitle, setExtractedTitle] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ExtractedClassCandidate[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnreadable, setIsUnreadable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successStats, setSuccessStats] = useState<{ inserted: number; replaced: number }>({
    inserted: 0,
    replaced: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal is opened / closed
  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewUrl(null);
    setBase64Data(null);
    setCandidates([]);
    setErrorMessage(null);
    setIsUnreadable(false);
    setSaving(false);
    setExtractedTitle(null);
  };

  if (!isOpen) return null;

  // Process chosen file into Base64 & Preview
  const handleFileChosen = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPG, PNG, WebP, HEIC).');
      return;
    }

    setErrorMessage(null);
    setIsUnreadable(false);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewUrl(dataUrl);

      // Clean base64 string
      const parts = dataUrl.split(',');
      if (parts.length > 1) {
        setBase64Data(parts[1]);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read the selected image file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChosen(e.dataTransfer.files[0]);
    }
  };

  // Run conflict detection on extracted classes against existingClasses
  const detectConflicts = (
    items: ExtractedClassCandidate[],
    existing: FixedEvent[]
  ): ExtractedClassCandidate[] => {
    return items.map((item) => {
      // Find any existing class on same day with time overlap
      const conflicting = existing.find((ex) => {
        if (ex.dayOfWeek !== item.dayOfWeek) return false;
        const candStart = item.startTime;
        const candEnd = item.endTime;
        const exStart = ex.startTime.slice(0, 5);
        const exEnd = ex.endTime.slice(0, 5);
        return candStart < exEnd && candEnd > exStart;
      });

      if (conflicting) {
        return {
          ...item,
          conflict: {
            existingId: conflicting.id,
            existingTitle: conflicting.title,
            existingTime: `${conflicting.startTime.slice(0, 5)} - ${conflicting.endTime.slice(0, 5)}`,
          },
          // Default resolution: keep existing (safe default to never overwrite without user choice)
          conflictResolution: item.conflictResolution || 'keep_existing',
          // If keep_existing, uncheck by default; if user toggles resolution to add or replace, check it
          selected: item.conflictResolution ? item.selected : false,
        };
      }

      return {
        ...item,
        conflict: null,
        conflictResolution: undefined,
      };
    });
  };

  // Send image to vision extraction API
  const handleExtractVision = async () => {
    if (!base64Data || !selectedFile) {
      setErrorMessage('Please select or capture a timetable image first.');
      return;
    }

    setStep('processing');
    setErrorMessage(null);
    setIsUnreadable(false);

    try {
      const res = await fetch('/api/schedule/parse-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: selectedFile.type || 'image/jpeg',
        }),
      });

      const data = await res.json();

      if (!res.ok || data.unreadable) {
        setIsUnreadable(true);
        throw new Error(
          data.error ||
            "We couldn't detect a readable weekly timetable in this image. Please ensure the timetable is clearly visible and in focus, then try retaking the photo."
        );
      }

      if (!data.classes || data.classes.length === 0) {
        setIsUnreadable(true);
        throw new Error(
          'No classes or commitments could be recognized in this image. Please check your photo and try again.'
        );
      }

      setExtractedTitle(data.scheduleTitle || null);

      // Perform initial conflict detection
      const analyzedCandidates = detectConflicts(data.classes, existingClasses);
      setCandidates(analyzedCandidates);
      setStep('review');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process timetable image.');
      setStep('upload');
    }
  };

  // Toggle selection checkbox for a candidate
  const handleToggleSelect = (index: number) => {
    setCandidates((prev) => {
      const next = [...prev];
      const item = next[index];
      const newSelected = !item.selected;
      next[index] = {
        ...item,
        selected: newSelected,
        // If it was keep_existing and user checks it, default resolution to add_anyway
        conflictResolution:
          item.conflict && newSelected && item.conflictResolution === 'keep_existing'
            ? 'add_anyway'
            : item.conflictResolution,
      };
      return next;
    });
  };

  // Update a field on a candidate (title, dayOfWeek, startTime, endTime, location)
  const handleUpdateCandidate = (
    index: number,
    field: keyof ExtractedClassCandidate,
    value: any
  ) => {
    setCandidates((prev) => {
      const updated = prev.map((c, i) => (i === index ? { ...c, [field]: value } : c));
      // Re-run conflict detection because time or day may have changed
      return detectConflicts(updated, existingClasses);
    });
  };

  // Change conflict resolution choice
  const handleSetConflictResolution = (index: number, resolution: ConflictResolution) => {
    setCandidates((prev) => {
      const next = [...prev];
      const item = next[index];
      next[index] = {
        ...item,
        conflictResolution: resolution,
        // If keep_existing, deselect; if add_anyway or replace_existing, select
        selected: resolution !== 'keep_existing',
      };
      return next;
    });
  };

  // Delete / Remove candidate card entirely
  const handleRemoveCandidate = (index: number) => {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  };

  // Bulk actions
  const handleSelectAll = (select: boolean) => {
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        selected: select,
        conflictResolution:
          c.conflict && select && c.conflictResolution === 'keep_existing'
            ? 'add_anyway'
            : c.conflictResolution,
      }))
    );
  };

  // Summary counts for review screen
  const reviewStats = useMemo(() => {
    const selectedItems = candidates.filter((c) => c.selected);
    const conflictsCount = candidates.filter((c) => c.conflict).length;
    const replacements = candidates
      .filter((c) => c.selected && c.conflictResolution === 'replace_existing' && c.conflict?.existingId)
      .map((c) => c.conflict!.existingId);
    const toInsertCount = selectedItems.length;

    return {
      total: candidates.length,
      selectedCount: selectedItems.length,
      conflictsCount,
      replacementsCount: replacements.length,
      replacements,
    };
  }, [candidates]);

  // Submit confirmed items to API
  const handleConfirmSave = async () => {
    const approvedItems = candidates.filter(
      (c) => c.selected && c.conflictResolution !== 'keep_existing'
    );

    if (approvedItems.length === 0 && reviewStats.replacementsCount === 0) {
      setErrorMessage('Please select at least one class to save or replace.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/schedule/parse-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          items: approvedItems,
          replacements: reviewStats.replacements,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save timetable commitments');

      setSuccessStats({
        inserted: data.insertedCount || approvedItems.length,
        replaced: data.replacedCount || reviewStats.replacementsCount,
      });

      setStep('success');
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save confirmed classes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-800 bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                Upload Timetable Image
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
                  {step === 'upload'
                    ? 'Step 1: Upload Photo'
                    : step === 'processing'
                    ? 'Extracting...'
                    : step === 'review'
                    ? 'Step 2: Review & Merge'
                    : 'Saved!'}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                {step === 'upload'
                  ? 'Upload or take a photo of your weekly class schedule'
                  : step === 'processing'
                  ? 'AI Vision is reading rows, columns, and subject slots'
                  : step === 'review'
                  ? 'Verify extracted classes & choose how to handle conflicts'
                  : 'Classes added to your locked schedule commitments'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Error / Unreadable Notification */}
          {errorMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 animate-in fade-in duration-200 ${
                isUnreadable
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-red-500/10 border-red-500/30 text-red-200'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  isUnreadable ? 'text-amber-400' : 'text-red-400'
                }`}
              />
              <div className="flex-1 text-xs space-y-1">
                <p className="font-semibold">
                  {isUnreadable ? 'Timetable Could Not Be Read' : 'Processing Error'}
                </p>
                <p className="text-zinc-300 leading-relaxed">{errorMessage}</p>
                {isUnreadable && (
                  <p className="text-[11px] text-amber-300/80 pt-0.5">
                    💡 Tip: Try capturing the schedule flat-on under clear lighting with minimal glare or shadows.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* STEP 1: UPLOAD / CAMERA VIEW */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Hidden File Inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,.png,.jpg,.jpeg,.webp,.heic"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileChosen(e.target.files[0]);
                  }
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileChosen(e.target.files[0]);
                  }
                }}
              />

              {!previewUrl ? (
                /* Drag & Drop Zone */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all flex flex-col items-center justify-center gap-3 cursor-pointer ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-zinc-700/80 bg-zinc-950/50 hover:border-zinc-600 hover:bg-zinc-900/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/70 flex items-center justify-center text-indigo-400 shadow-inner">
                    <FileImage className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-200">
                      Drop your timetable image here, or{' '}
                      <span className="text-indigo-400 hover:underline">browse files</span>
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      Supports JPG, PNG, WebP, and HEIC screenshots or camera photos
                    </p>
                  </div>

                  {/* Dual Action Buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/80 transition-all cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Choose File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/40 transition-all cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Take Photo</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Image Preview Card */
                <div className="space-y-3">
                  <div className="relative rounded-2xl border border-zinc-800 overflow-hidden bg-zinc-950 flex flex-col items-center">
                    <div className="max-h-72 w-full flex items-center justify-center bg-zinc-950 p-2 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Timetable Preview"
                        className="max-h-68 max-w-full object-contain rounded-lg shadow-md"
                      />
                    </div>
                    {/* Image Meta Bar */}
                    <div className="w-full px-4 py-2.5 bg-zinc-900/90 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                      <span className="truncate max-w-[200px] font-medium text-zinc-200">
                        {selectedFile?.name || 'timetable_image.jpg'}
                      </span>
                      <span>
                        {selectedFile ? `${(selectedFile.size / 1024).toFixed(0)} KB` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                      Choose Different Photo
                    </button>
                    <button
                      type="button"
                      onClick={handleExtractVision}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all active:scale-95 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Extract Classes with AI Vision</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Informative tips */}
              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-xs text-zinc-400 space-y-1.5">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Works with real-world schedules:</span>
                </span>
                <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px] pl-1">
                  <li>University portal screenshots and PDF exports</li>
                  <li>Photos of printed paper schedules, syllabi, or noticeboards</li>
                  <li>Angled camera shots and handwritten grids (AI infers row/column intersections)</li>
                </ul>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* STEP: PROCESSING (SCANNING ANIMATION) */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {step === 'processing' && (
            <div className="py-14 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 animate-ping" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25">
                  <RefreshCw className="w-7 h-7 animate-spin" />
                </div>
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h4 className="text-sm font-bold text-zinc-100">
                  Analyzing Timetable with AI Vision...
                </h4>
                <p className="text-xs text-zinc-400">
                  Reading day columns, time slots, course titles, and room locations.
                </p>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* STEP 2: REVIEW & MERGE SCREEN */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {step === 'review' && (
            <div className="space-y-3.5">
              {/* Header stats & filter helpers */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                <div>
                  <span className="text-xs font-bold text-zinc-200">
                    Extracted Classes ({reviewStats.selectedCount} of {reviewStats.total} selected)
                  </span>
                  {extractedTitle && (
                    <span className="block text-[11px] text-zinc-400">
                      Schedule: <strong className="text-zinc-300">{extractedTitle}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-zinc-600 text-xs">•</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Conflict Legend / Warning if conflicts exist */}
              {reviewStats.conflictsCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold">
                      {reviewStats.conflictsCount} Overlap Conflict{reviewStats.conflictsCount > 1 ? 's' : ''} Detected
                    </p>
                    <p className="text-[11px] text-amber-300/80 leading-relaxed">
                      Highlighted in amber below. For each conflict, choose whether to keep your existing class, add both, or replace the old one.
                    </p>
                  </div>
                </div>
              )}

              {/* Extracted Classes Cards List */}
              <div className="space-y-3">
                {candidates.map((item, idx) => {
                  const hasConflict = Boolean(item.conflict);

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        hasConflict
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : item.selected
                          ? 'bg-zinc-950/90 border-indigo-500/40 shadow-sm'
                          : 'bg-zinc-950/40 border-zinc-800/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Selection Checkbox */}
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleToggleSelect(idx)}
                          className="mt-1 h-4 w-4 rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                        />

                        {/* Editable Card Details */}
                        <div className="flex-1 space-y-2.5 min-w-0">
                          {/* Title & Status Badge */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => handleUpdateCandidate(idx, 'title', e.target.value)}
                              placeholder="Class title"
                              className="flex-1 min-w-[140px] px-2.5 py-1 text-xs font-semibold bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-100 focus:outline-none focus:border-indigo-500"
                            />
                            {hasConflict ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 shrink-0">
                                ⚠️ Time Overlap
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 shrink-0">
                                ✨ New Class
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveCandidate(idx)}
                              className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                              title="Discard this class"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Day & Time Inputs Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {/* Day Selection */}
                            <div>
                              <select
                                value={item.dayOfWeek}
                                onChange={(e) =>
                                  handleUpdateCandidate(idx, 'dayOfWeek', parseInt(e.target.value, 10))
                                }
                                className="w-full px-2 py-1 text-[11px] font-medium bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-200 focus:outline-none focus:border-indigo-500"
                              >
                                {DAY_NAMES.map((name, dIdx) => (
                                  <option key={dIdx} value={dIdx}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Start Time */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-zinc-500 shrink-0">Start:</span>
                              <input
                                type="time"
                                value={item.startTime}
                                onChange={(e) =>
                                  handleUpdateCandidate(idx, 'startTime', e.target.value)
                                }
                                className="w-full px-2 py-1 text-[11px] font-mono bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-200 focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            {/* End Time */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-zinc-500 shrink-0">End:</span>
                              <input
                                type="time"
                                value={item.endTime}
                                onChange={(e) => handleUpdateCandidate(idx, 'endTime', e.target.value)}
                                className="w-full px-2 py-1 text-[11px] font-mono bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-200 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          {/* Location Input */}
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                            <input
                              type="text"
                              value={item.location || ''}
                              onChange={(e) =>
                                handleUpdateCandidate(idx, 'location', e.target.value)
                              }
                              placeholder="Location (e.g. Room 304, Science Hall, Online)"
                              className="w-full px-2 py-0.5 text-[11px] bg-zinc-900 rounded border border-zinc-800 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          {/* Per-Conflict Resolution Controls */}
                          {hasConflict && item.conflict && (
                            <div className="pt-2 mt-2 border-t border-amber-500/20 space-y-1.5">
                              <p className="text-[11px] text-amber-300/90 font-medium">
                                Conflicts with existing: <strong>&ldquo;{item.conflict.existingTitle}&rdquo;</strong> ({item.conflict.existingTime})
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => handleSetConflictResolution(idx, 'keep_existing')}
                                  className={`px-2.5 py-1 rounded-lg font-medium border transition-all cursor-pointer ${
                                    item.conflictResolution === 'keep_existing'
                                      ? 'bg-zinc-800 border-zinc-600 text-zinc-100 shadow-sm'
                                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  Keep existing only
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetConflictResolution(idx, 'add_anyway')}
                                  className={`px-2.5 py-1 rounded-lg font-medium border transition-all cursor-pointer ${
                                    item.conflictResolution === 'add_anyway'
                                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-sm'
                                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  Add anyway (overlap)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetConflictResolution(idx, 'replace_existing')}
                                  className={`px-2.5 py-1 rounded-lg font-medium border transition-all cursor-pointer ${
                                    item.conflictResolution === 'replace_existing'
                                      ? 'bg-amber-500/30 border-amber-500 text-amber-200 shadow-sm'
                                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  Replace existing with this
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* STEP 3: SUCCESS CONFIRMATION */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {step === 'success' && (
            <div className="py-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h4 className="text-base font-bold text-zinc-100">
                  Timetable Imported Successfully!
                </h4>
                <p className="text-xs text-zinc-400">
                  Added <strong className="text-emerald-400">{successStats.inserted}</strong> class(es)
                  {successStats.replaced > 0 && (
                    <> and replaced <strong className="text-amber-400">{successStats.replaced}</strong> old class(es)</>
                  )} to your weekly schedule.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-zinc-950/80 border-t border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          {step === 'upload' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              {previewUrl && (
                <button
                  type="button"
                  onClick={handleExtractVision}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Extract Classes</span>
                </button>
              )}
            </>
          )}

          {step === 'review' && (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Back to Image
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={saving || (reviewStats.selectedCount === 0 && reviewStats.replacementsCount === 0)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all cursor-pointer active:scale-95"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Schedule...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      Save {reviewStats.selectedCount} Class
                      {reviewStats.selectedCount === 1 ? '' : 'es'}
                      {reviewStats.replacementsCount > 0
                        ? ` (Replace ${reviewStats.replacementsCount})`
                        : ''}
                    </span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 'success' && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              View Updated Schedule
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
