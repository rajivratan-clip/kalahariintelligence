/**
 * Insight Agent Hook
 * Listens to chart data and generates micro-insights automatically.
 * Acts as a "ghost listener" that analyzes data patterns and surfaces insights.
 */

import { useState, useEffect, useCallback } from 'react';

export interface MicroInsight {
  id: string;
  dataPointIndex: number; // Index in the data array
  dataPointKey?: string; // Key for the specific data point (e.g., 'Tuesday', 'Mobile')
  headline: string; // Natural language headline (e.g., "15% spike on Tuesday")
  explanation: string; // Brief explanation (< 100 words)
  confidence: number; // 0-100 confidence score
  suggestedActions: Array<{
    label: string;
    action: string; // Natural language action
    configUpdate?: any; // Optional config update to apply
  }>;
  category: 'spike' | 'drop' | 'anomaly' | 'trend' | 'correlation' | 'opportunity';
}

interface InsightAgentOptions {
  /** Minimum confidence threshold to show insights (default: 70) */
  minConfidence?: number;
  /** Maximum number of insights to generate (default: 3) */
  maxInsights?: number;
  /** System persona for AI analysis (default: 'Hospitality Forensic Analyst') */
  persona?: string;
  /** Whether to enable automatic insight generation */
  enabled?: boolean;
}

/**
 * Hook that analyzes chart data and generates micro-insights
 */
export function useInsightAgent(
  chartData: any[],
  chartType: string,
  options: InsightAgentOptions = {}
) {
  const {
    minConfidence = 70,
    maxInsights = 3,
    persona = 'Hospitality Forensic Analyst',
    enabled = true,
  } = options;

  const [insights, setInsights] = useState<MicroInsight[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const generateInsights = useCallback(async () => {
    if (!enabled || !chartData || chartData.length === 0) {
      setInsights([]);
      setIsAnalyzing(false);
      return;
    }

    setIsAnalyzing(true);

    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('http://localhost:8000/api/ai/chart-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chart_data: chartData,
          chart_type: chartType,
          persona,
          max_insights: maxInsights,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to generate insights: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        console.error('Invalid response format:', data);
        throw new Error('Invalid response format');
      }

      const generatedInsights: MicroInsight[] = Array.isArray(data.insights) ? data.insights : [];
      
      // Debug logging
      if (generatedInsights.length === 0) {
        console.warn('No insights returned from API:', data);
      } else {
        console.log('Received insights:', generatedInsights);
      }

      // Validate and filter insights
      const validInsights = generatedInsights
        .filter((insight) => {
          // Validate insight structure - be lenient with confidence for KPI cards
          const isValid = (
            insight &&
            typeof insight === 'object' &&
            insight.headline &&
            typeof insight.headline === 'string' &&
            insight.headline.trim().length > 0
          );
          
          // For KPI cards, accept lower confidence (50+) to ensure we show something
          if (chartType === 'kpi' && isValid) {
            const conf = Number(insight.confidence) || 70;
            return conf >= 50; // Lower threshold for KPI cards
          }
          
          return isValid && (Number(insight.confidence) || 70) >= minConfidence;
        })
        .map((insight) => ({
          ...insight,
          // Ensure required fields exist
          id: insight.id || `insight-${Date.now()}-${Math.random()}`,
          dataPointIndex: typeof insight.dataPointIndex === 'number' ? insight.dataPointIndex : 0,
          headline: String(insight.headline).substring(0, 200), // Limit length
          explanation: String(insight.explanation || '').substring(0, 500),
          confidence: Math.max(0, Math.min(100, Number(insight.confidence) || 75)),
          category: ['spike', 'drop', 'anomaly', 'trend', 'correlation', 'opportunity'].includes(insight.category)
            ? insight.category
            : 'spike',
          suggestedActions: Array.isArray(insight.suggestedActions)
            ? insight.suggestedActions.slice(0, 3).map((action: any) => ({
                label: String(action?.label || ''),
                action: String(action?.action || ''),
              }))
            : [],
        }));

      setInsights(validInsights.slice(0, maxInsights));
      
      // If no valid insights for KPI cards, create a basic fallback
      if (chartType === 'kpi' && validInsights.length === 0 && generatedInsights.length === 0) {
        // Extract basic metric info for fallback
        if (chartData && chartData.length >= 2) {
          const lastVal = chartData[chartData.length - 1]?.value || chartData[chartData.length - 1]?.y || 0;
          const firstVal = chartData[0]?.value || chartData[0]?.y || 0;
          const change = firstVal > 0 ? ((lastVal - firstVal) / firstVal * 100) : 0;
          const trend = change > 0 ? 'increased' : change < 0 ? 'decreased' : 'remained stable';
          
          setInsights([{
            id: 'kpi-frontend-fallback',
            dataPointIndex: chartData.length - 1,
            dataPointKey: chartData[chartData.length - 1]?.name || 'Current',
            headline: `Metric ${trend}`,
            explanation: `The metric ${trend} from ${firstVal.toFixed(1)} to ${lastVal.toFixed(1)} (${change > 0 ? '+' : ''}${change.toFixed(1)}%).`,
            confidence: 70,
            category: 'trend' as const,
            suggestedActions: [
              { label: 'See Detailed Breakdown', action: 'Analyze this metric in detail' },
              { label: 'Compare Segments', action: 'Compare across different segments' }
            ],
          }]);
        }
      }
    } catch (error: any) {
      // Don't log timeout errors as they're expected
      if (error.name !== 'AbortError') {
        console.error('Error generating insights:', error);
      }
      
      // For KPI cards, provide a fallback insight even on error
      if (chartType === 'kpi' && chartData && chartData.length >= 2) {
        try {
          const lastVal = chartData[chartData.length - 1]?.value || chartData[chartData.length - 1]?.y || 0;
          const firstVal = chartData[0]?.value || chartData[0]?.y || 0;
          const change = firstVal > 0 ? ((lastVal - firstVal) / firstVal * 100) : 0;
          const trend = change > 0 ? 'increased' : change < 0 ? 'decreased' : 'remained stable';
          
          setInsights([{
            id: 'kpi-error-fallback',
            dataPointIndex: chartData.length - 1,
            dataPointKey: chartData[chartData.length - 1]?.name || 'Current',
            headline: `Metric ${trend}`,
            explanation: `The metric ${trend} from ${firstVal.toFixed(1)} to ${lastVal.toFixed(1)} (${change > 0 ? '+' : ''}${change.toFixed(1)}%).`,
            confidence: 65,
            category: 'trend' as const,
            suggestedActions: [
              { label: 'See Detailed Breakdown', action: 'Analyze this metric in detail' },
              { label: 'Compare Segments', action: 'Compare across different segments' }
            ],
          }]);
        } catch {
          setInsights([]);
        }
      } else {
        setInsights([]);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [chartData, chartType, persona, maxInsights, minConfidence, enabled]);

  // Only auto-generate if explicitly enabled
  useEffect(() => {
    if (enabled) {
      // Debounce insight generation
      const timeoutId = setTimeout(() => {
        generateInsights();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [enabled, generateInsights]);

  return {
    insights,
    isAnalyzing,
    refreshInsights: generateInsights,
  };
}
