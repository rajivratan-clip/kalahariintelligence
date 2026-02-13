import React, { useState } from 'react';
import { Sparkles, X, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, ArrowRight } from 'lucide-react';
import type { MicroInsight } from '../engines/useInsightAgent';

interface InsightOverlayProps {
  insight: MicroInsight;
  position: { x: number; y: number }; // Position relative to chart
  onActionClick?: (action: MicroInsight['suggestedActions'][0]) => void;
  onDismiss?: () => void;
}

const InsightOverlay: React.FC<InsightOverlayProps> = ({
  insight,
  position,
  onActionClick,
  onDismiss,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const getCategoryIcon = (category: MicroInsight['category']) => {
    switch (category) {
      case 'spike':
        return <TrendingUp size={16} className="text-green-600" />;
      case 'drop':
        return <TrendingDown size={16} className="text-red-600" />;
      case 'anomaly':
        return <AlertTriangle size={16} className="text-amber-600" />;
      case 'trend':
        return <TrendingUp size={16} className="text-blue-600" />;
      case 'correlation':
        return <Lightbulb size={16} className="text-brand-600" />;
      case 'opportunity':
        return <Lightbulb size={16} className="text-emerald-600" />;
      default:
        return <Sparkles size={16} className="text-slate-600" />;
    }
  };

  const getCategoryColor = (category: MicroInsight['category']) => {
    switch (category) {
      case 'spike':
        return 'bg-green-50 border-green-200';
      case 'drop':
        return 'bg-red-50 border-red-200';
      case 'anomaly':
        return 'bg-amber-50 border-amber-200';
      case 'trend':
        return 'bg-blue-50 border-blue-200';
      case 'correlation':
        return 'bg-brand-50 border-brand-200';
      case 'opportunity':
        return 'bg-emerald-50 border-emerald-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <>
      {/* Sparkle Icon Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute z-10 p-1 rounded-full bg-white shadow-lg border border-slate-200 hover:border-brand-400 transition-all group"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -50%)',
        }}
        aria-label="View insight"
      >
        <Sparkles
          size={16}
          className="text-brand-600 group-hover:text-brand-700 animate-pulse"
        />
      </button>

      {/* Popover Card */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Popover */}
          <div
            className={`absolute z-50 w-80 ${getCategoryColor(insight.category)} rounded-lg shadow-xl border-2 p-4`}
            style={{
              left: `${position.x}px`,
              top: `${position.y + 30}px`,
              transform: 'translateX(-50%)',
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getCategoryIcon(insight.category)}
                <span className="text-xs font-semibold text-slate-700 uppercase">
                  {insight.category}
                </span>
                {insight.confidence < 90 && (
                  <span className="text-xs text-slate-500">
                    {insight.confidence}% confident
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onDismiss?.();
                }}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Headline */}
            <h4 className="font-semibold text-slate-900 mb-2 text-sm">
              {insight.headline}
            </h4>

            {/* Explanation */}
            <p className="text-xs text-slate-700 mb-4 leading-relaxed">
              {insight.explanation}
            </p>

            {/* Suggested Actions */}
            {insight.suggestedActions.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-600 mb-2">
                  Next Steps:
                </div>
                {insight.suggestedActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onActionClick?.(action);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white rounded-md border border-slate-200 hover:border-brand-400 hover:bg-brand-50 transition-all text-left group"
                  >
                    <span className="text-xs text-slate-700 group-hover:text-brand-700">
                      {action.label}
                    </span>
                    <ArrowRight
                      size={14}
                      className="text-slate-400 group-hover:text-brand-600"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default InsightOverlay;
