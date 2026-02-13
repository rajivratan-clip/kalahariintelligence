import React, { useState, useCallback } from 'react';
import { Sparkles, X, AlertCircle, TrendingUp, TrendingDown, Lightbulb, Loader2 } from 'lucide-react';
import { useInsightAgent, type MicroInsight } from '../engines/useInsightAgent';

interface KPICardWithAIButtonProps {
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
  /** Whether data is loaded and ready for insights */
  dataLoaded?: boolean;
}

/**
 * KPI Card with optional AI Insights button
 * - Shows AI button only when data is loaded
 * - Generates insights on-demand (click) - not automatic
 * - Completely async and non-blocking
 */
const KPICardWithAIButton: React.FC<KPICardWithAIButtonProps> = ({
  label,
  value,
  subtitle,
  change,
  changeType,
  icon,
  color,
  badge,
  metricData,
  dataLoaded = false,
}) => {
  const [showInsight, setShowInsight] = useState(false);
  const [hasRequestedInsight, setHasRequestedInsight] = useState(false);

  // Prepare chart data for insight agent
  const chartData = metricData
    ? [
        { name: 'Previous', value: metricData.previous || 0 },
        { name: 'Current', value: metricData.current },
      ]
    : [];

  // Use insight agent with manual trigger only (enabled=false means no auto-generation)
  const { insights, isAnalyzing, refreshInsights } = useInsightAgent(chartData, 'kpi', {
    enabled: false, // Don't auto-generate - only on manual trigger
    maxInsights: 1,
    minConfidence: 70,
    persona: 'Hospitality KPI Analyst',
  });

  // Get the first insight if available
  const insight = insights.length > 0 ? insights[0] : null;

  // Handle AI button click - trigger insight generation
  const handleAIButtonClick = useCallback(async () => {
    // Always toggle the insight display
    setShowInsight(!showInsight);
    
    // If not already requested and we have data, trigger generation
    if (!hasRequestedInsight && !isAnalyzing && chartData.length > 0) {
      setHasRequestedInsight(true);
      // Trigger insight generation asynchronously
      try {
        await refreshInsights();
      } catch (error) {
        console.error('Failed to generate insight:', error);
        // Don't reset hasRequestedInsight - let user see the error state
      }
    }
  }, [hasRequestedInsight, isAnalyzing, chartData.length, refreshInsights, showInsight]);

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
      {/* AI Insight Button - Only show when data is loaded */}
      {dataLoaded && chartData.length > 0 && (
        <button
          onClick={handleAIButtonClick}
          disabled={isAnalyzing}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-white shadow-sm border border-slate-200 hover:border-brand-400 transition-all group z-10 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Get AI insight"
          title="Get AI insight for this metric"
        >
          {isAnalyzing ? (
            <Loader2 size={14} className="text-brand-600 animate-spin" />
          ) : (
            <Sparkles
              size={14}
              className={`text-brand-600 group-hover:text-brand-700 transition-colors ${
                insight ? 'animate-pulse' : ''
              }`}
            />
          )}
        </button>
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
        <div className={`text-2xl font-bold ${label === 'Revenue at Risk' ? 'text-red-600' : 'text-slate-900'}`}>{value}</div>
        {subtitle && (
          <div className={`text-xs mt-1 ${label === 'Revenue at Risk' && subtitle === 'High Alert' ? 'text-red-500 font-medium' : 'text-slate-500'}`}>{subtitle}</div>
        )}
        {change !== undefined && (
          <div className={`text-xs mt-1 flex items-center gap-1 ${
            changeType === 'increase' ? 'text-green-600' : 'text-red-600'
          }`}>
            {changeType === 'increase' ? (
              <TrendingUp size={12} />
            ) : (
              <TrendingDown size={12} />
            )}
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </div>
        )}
      </div>

      {/* AI Insight Display - Integrated into Card */}
      {showInsight && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-xs text-slate-600 py-2">
              <Loader2 size={14} className="animate-spin text-brand-600" />
              <span>Analyzing metric patterns...</span>
            </div>
          ) : insight && insight.headline ? (
            <div className="space-y-2">
              {/* Insight Header */}
              <div className="flex items-center gap-2 mb-2">
                {getCategoryIcon(insight.category)}
                <span className="text-xs font-semibold text-slate-700">AI Analysis</span>
                {insight.confidence && insight.confidence < 80 && (
                  <span className="text-xs text-slate-400">({insight.confidence}% confident)</span>
                )}
              </div>
              
              {/* Insight Content */}
              <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
                <h5 className="font-semibold text-slate-900 text-xs mb-1.5 leading-tight">
                  {insight.headline}
                </h5>
                <p className="text-xs text-slate-600 leading-relaxed mb-2">
                  {insight.explanation}
                </p>
                
                {/* Suggested Actions - Compact */}
                {insight.suggestedActions && insight.suggestedActions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-brand-200">
                    {insight.suggestedActions.slice(0, 2).map((action, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-brand-300 text-brand-700"
                      >
                        {action.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Close button */}
              <button
                onClick={() => setShowInsight(false)}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors mt-1"
              >
                Hide insight
              </button>
            </div>
          ) : hasRequestedInsight ? (
            <div className="text-xs text-slate-500 py-2">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={14} className="text-amber-500" />
                <span>Unable to generate insights at this time.</span>
              </div>
              <button
                onClick={() => {
                  setHasRequestedInsight(false);
                  refreshInsights();
                }}
                className="text-xs text-brand-600 hover:text-brand-700 underline mt-1"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-2">
              Click the sparkle icon to generate AI insights.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KPICardWithAIButton;
