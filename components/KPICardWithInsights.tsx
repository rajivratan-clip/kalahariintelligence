import React, { useState, useEffect } from 'react';
import { Sparkles, X, AlertCircle, TrendingUp, TrendingDown, Lightbulb } from 'lucide-react';
import { useInsightAgent, type MicroInsight } from '../engines/useInsightAgent';

interface KPICardWithInsightsProps {
  label: string;
  value: number | string;
  subtitle?: string;
  change?: number;
  changeType?: 'increase' | 'decrease';
  icon: React.ReactNode;
  color: string;
  badge?: string;
  /** Data for AI analysis */
  metricData?: {
    current: number;
    previous?: number;
    trend?: 'up' | 'down' | 'stable';
    context?: string;
  };
  /** Whether to enable AI insights */
  insightsEnabled?: boolean;
}

const KPICardWithInsights: React.FC<KPICardWithInsightsProps> = ({
  label,
  value,
  subtitle,
  change,
  changeType,
  icon,
  color,
  badge,
  metricData,
  insightsEnabled = true,
}) => {
  const [showInsight, setShowInsight] = useState(false);
  const [insight, setInsight] = useState<MicroInsight | null>(null);

  // Prepare chart data for insight agent
  const chartData = metricData
    ? [
        { name: 'Previous', value: metricData.previous || 0 },
        { name: 'Current', value: metricData.current },
      ]
    : [];

  const { insights, isAnalyzing } = useInsightAgent(chartData, 'kpi', {
    enabled: insightsEnabled && chartData.length > 0,
    maxInsights: 1,
    minConfidence: 70,
    persona: 'Hospitality KPI Analyst',
  });

  // Get the first insight if available
  useEffect(() => {
    if (insights.length > 0) {
      setInsight(insights[0]);
    } else {
      setInsight(null);
    }
  }, [insights]);

  const getCategoryIcon = (category: MicroInsight['category']) => {
    switch (category) {
      case 'spike':
        return <TrendingUp size={14} className="text-green-600" />;
      case 'drop':
        return <TrendingDown size={14} className="text-red-600" />;
      case 'anomaly':
        return <AlertCircle size={14} className="text-amber-600" />;
      case 'opportunity':
        return <Lightbulb size={14} className="text-emerald-600" />;
      default:
        return <Sparkles size={14} className="text-brand-600" />;
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
      case 'opportunity':
        return 'bg-emerald-50 border-emerald-200';
      default:
        return 'bg-brand-50 border-brand-200';
    }
  };

  return (
    <div className="relative bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* AI Insight Sparkle Icon */}
      {insight && insightsEnabled && (
        <button
          onClick={() => setShowInsight(!showInsight)}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-white shadow-sm border border-slate-200 hover:border-brand-400 transition-all group z-10"
          aria-label="View AI insight"
        >
          <Sparkles
            size={14}
            className="text-brand-600 group-hover:text-brand-700 animate-pulse"
          />
        </button>
      )}

      {/* Loading Indicator */}
      {isAnalyzing && insightsEnabled && (
        <div className="absolute top-3 right-3">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-brand-500 border-t-transparent" />
        </div>
      )}

      {/* Card Content */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
            <div style={{ color }}>{icon}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase">{label}</div>
            {badge && (
              <div className="text-xs font-medium mt-1" style={{ color: '#ef4444' }}>
                {badge}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-2">
        <div className="text-3xl font-bold text-slate-900">{value}</div>
        {subtitle && (
          <div className="text-xs text-slate-400 mt-1">{subtitle}</div>
        )}
        {change !== undefined && change !== 0 && (
          <div
            className={`text-xs mt-1 flex items-center gap-1 ${
              changeType === 'increase' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {changeType === 'increase' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {change >= 0 ? '+' : ''}
            {change.toFixed(1)}% vs last
          </div>
        )}
      </div>

      {/* AI Insight Popover */}
      {showInsight && insight && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowInsight(false)}
            aria-hidden="true"
          />

          {/* Popover */}
          <div
            className={`absolute z-50 w-80 ${getCategoryColor(insight.category)} rounded-lg shadow-xl border-2 p-4`}
            style={{
              top: '100%',
              right: 0,
              marginTop: '8px',
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
                onClick={() => setShowInsight(false)}
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
                      // Handle action click
                      setShowInsight(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white rounded-md border border-slate-200 hover:border-brand-400 hover:bg-brand-50 transition-all text-left group"
                  >
                    <span className="text-xs text-slate-700 group-hover:text-brand-700">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default KPICardWithInsights;
