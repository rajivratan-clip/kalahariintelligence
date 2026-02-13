import React from 'react';
import { Undo2, RotateCcw } from 'lucide-react';

interface UndoButtonProps {
  onUndo: () => void;
  canUndo: boolean;
  label?: string;
  variant?: 'icon' | 'button';
}

const UndoButton: React.FC<UndoButtonProps> = ({
  onUndo,
  canUndo,
  label = 'Revert',
  variant = 'button',
}) => {
  if (variant === 'icon') {
    return (
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`p-2 rounded-lg transition-all ${
          canUndo
            ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            : 'text-slate-300 cursor-not-allowed'
        }`}
        aria-label="Undo last action"
        title={canUndo ? 'Revert to previous state' : 'Nothing to undo'}
      >
        <Undo2 size={18} />
      </button>
    );
  }

  return (
    <button
      onClick={onUndo}
      disabled={!canUndo}
      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
        canUndo
          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
          : 'bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200'
      }`}
      aria-label="Undo last action"
    >
      <RotateCcw size={16} />
      <span>{label}</span>
    </button>
  );
};

export default UndoButton;
