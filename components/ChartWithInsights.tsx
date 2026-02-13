import React, { useRef, useEffect } from 'react';
import { useInsightAgent, type MicroInsight } from '../engines/useInsightAgent';
import InsightOverlay from './InsightOverlay';

interface ChartWithInsightsProps {
  /** Chart component to wrap */
  children: React.ReactNode;
  /** Chart data array */
  chartData: any[];
  /** Chart type identifier */
  chartType: string;
  /** Data key for X-axis (to map insights to data points) */
  xAxisKey?: string;
  /** Callback when user clicks an insight action */
  onInsightAction?: (action: MicroInsight['suggestedActions'][0]) => void;
  /** Whether insights are enabled */
  insightsEnabled?: boolean;
}

/**
 * Wrapper component that adds insight overlays to any chart.
 * Automatically analyzes chart data and shows sparkle icons on interesting data points.
 */
const ChartWithInsights: React.FC<ChartWithInsightsProps> = ({
  children,
  chartData,
  chartType,
  xAxisKey = 'name',
  onInsightAction,
  insightsEnabled = true,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const { insights, isAnalyzing } = useInsightAgent(chartData, chartType, {
    enabled: insightsEnabled,
  });

  // Calculate positions for insight overlays
  const getInsightPosition = (insight: MicroInsight): { x: number; y: number } | null => {
    if (!chartRef.current || insight.dataPointIndex === undefined) {
      return null;
    }

    // This is a simplified calculation - in production, you'd need to
    // map data point indices to actual pixel positions based on chart library
    const chartRect = chartRef.current.getBoundingClientRect();
    const dataPoint = chartData[insight.dataPointIndex];
    
    if (!dataPoint) return null;

    // Estimate position (this would need to be more sophisticated with actual chart library)
    const xPercent = (insight.dataPointIndex / chartData.length) * 100;
    const yPercent = 50; // Middle of chart area (would need actual value calculation)

    return {
      x: (xPercent / 100) * chartRect.width,
      y: (yPercent / 100) * chartRect.height,
    };
  };

  return (
    <div ref={chartRef} className="relative">
      {/* Chart */}
      {children}

      {/* Loading Indicator */}
      {isAnalyzing && (
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 flex items-center gap-2">
          <div className="animate-spin rounded-full h-3 w-3 border-2 border-brand-500 border-t-transparent" />
          <span className="text-xs text-slate-600">Analyzing patterns...</span>
        </div>
      )}

      {/* Insight Overlays */}
      {insights.map((insight) => {
        const position = getInsightPosition(insight);
        if (!position) return null;

        return (
          <InsightOverlay
            key={insight.id}
            insight={insight}
            position={position}
            onActionClick={onInsightAction}
          />
        );
      })}
    </div>
  );
};

export default ChartWithInsights;
