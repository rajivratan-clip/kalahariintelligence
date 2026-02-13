import React from 'react';
import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

interface ConfidenceIndicatorProps {
  confidence: number; // 0-100
  message?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  assumption?: string; // What the AI assumed (e.g., "I'm assuming 'Landed' refers to PageView event")
}

const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  message,
  onConfirm,
  onCancel,
  assumption,
}) => {
  if (confidence >= 90) {
    // High confidence - subtle indicator
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <CheckCircle2 size={14} className="text-green-600" />
        <span>High confidence</span>
      </div>
    );
  }

  if (confidence >= 70) {
    // Medium confidence - show disclaimer
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-900 mb-1">
              {confidence}% Confidence
            </div>
            {assumption && (
              <p className="text-xs text-amber-700 mb-2">{assumption}</p>
            )}
            {message && (
              <p className="text-xs text-amber-700 mb-2">{message}</p>
            )}
            {onConfirm && onCancel && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={onConfirm}
                  className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700"
                >
                  Yes, Continue
                </button>
                <button
                  onClick={onCancel}
                  className="px-3 py-1 text-xs font-medium bg-white text-amber-700 border border-amber-300 rounded hover:bg-amber-50"
                >
                  Change
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Low confidence - require confirmation
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
      <div className="flex items-start gap-2">
        <HelpCircle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-red-900 mb-1">
            Low Confidence ({confidence}%)
          </div>
          {assumption && (
            <p className="text-xs text-red-700 mb-2 font-medium">{assumption}</p>
          )}
          {message && (
            <p className="text-xs text-red-700 mb-3">{message}</p>
          )}
          {onConfirm && onCancel && (
            <div className="flex items-center gap-2">
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700"
              >
                Yes, Proceed
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-2 text-xs font-medium bg-white text-red-700 border border-red-300 rounded hover:bg-red-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfidenceIndicator;
