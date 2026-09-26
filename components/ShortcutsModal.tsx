'use client';

import React from 'react';
import { X, Keyboard, Search, Plus, ArrowUpDown, CornerDownLeft, Copy, Pin, CheckSquare } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Navigation & Focus',
      items: [
        { keys: ['/'], description: 'Focus search bar instantly' },
        { keys: ['↑', '↓', '←', '→'], description: 'Navigate through resource cards' },
        { keys: ['Enter'], description: 'Open selected resource in new tab' },
        { keys: ['Esc'], description: 'Close any active modal or clear search' },
        { keys: ['?'], description: 'Toggle this keyboard shortcuts cheat sheet' },
      ],
    },
    {
      title: 'Quick Actions on Focused Card',
      items: [
        { keys: ['n', 'or', 'a'], description: 'Open Add New Resource modal' },
        { keys: ['c'], description: 'Copy focused resource link to clipboard' },
        { keys: ['p'], description: 'Toggle pin on focused resource' },
        { keys: ['e'], description: 'Edit focused resource' },
        { keys: ['x'], description: 'Select / deselect focused card in Bulk Mode' },
      ],
    },
    {
      title: 'Views & Mode',
      items: [
        { keys: ['s'], description: 'Toggle multi-select bulk action mode' },
        { keys: ['g'], description: 'Switch between Grid and List views' },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Keyboard Shortcuts</h2>
              <p className="text-[11px] text-zinc-400">Quickly power-browse ResoVault without a mouse</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {group.title}
              </h3>
              <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl divide-y divide-zinc-800/60">
                {group.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-zinc-900/40 transition-colors"
                  >
                    <span className="text-zinc-300 font-medium">{item.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) =>
                        k === 'or' ? (
                          <span key={kIdx} className="text-[10px] text-zinc-500 px-1 font-mono">
                            or
                          </span>
                        ) : (
                          <kbd
                            key={kIdx}
                            className="px-2 py-0.5 min-w-[22px] text-center text-[11px] font-mono font-semibold text-zinc-300 bg-zinc-800 rounded border border-zinc-700 shadow-sm"
                          >
                            {k}
                          </kbd>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/40 flex items-center justify-between text-xs text-zinc-400">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono text-[10px]">Esc</kbd> anytime to dismiss</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
