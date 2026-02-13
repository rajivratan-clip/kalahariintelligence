/**
 * Adaptive Suggestions Engine
 * Provides context-aware suggestions that adapt as user interacts with charts.
 * Uses heuristic map to suggest "natural neighbors" based on current state.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ViewConfig } from './useAiOrchestrator';

export interface AdaptiveSuggestion {
  id: string;
  label: string;
  action: string;
  reasoning: string; // Why this suggestion is relevant
  priority: 'high' | 'medium' | 'low';
  category: 'drill' | 'compare' | 'segment' | 'forecast' | 'correlate';
}

// Heuristic map: metric -> natural neighbors
const METRIC_NEIGHBORS: Record<string, string[]> = {
  revenue: ['adr', 'occupancy', 'revpar', 'conversion_rate'],
  conversion_rate: ['drop_off', 'funnel_depth', 'time_to_convert'],
  adr: ['revenue', 'occupancy', 'guest_segment'],
  occupancy: ['adr', 'revenue', 'booking_velocity'],
  drop_off: ['conversion_rate', 'friction_points', 'revenue_at_risk'],
  funnel_depth: ['conversion_rate', 'intent_score', 'engagement'],
};

// Category-based suggestions
const CATEGORY_SUGGESTIONS: Record<string, AdaptiveSuggestion[]> = {
  revenue: [
    {
      id: 'revenue-segment',
      label: 'Which segment contributed most?',
      action: 'Break down revenue by guest segment',
      reasoning: 'Revenue analysis naturally leads to segment breakdown',
      priority: 'high',
      category: 'segment',
    },
    {
      id: 'revenue-adr',
      label: 'How does ADR compare?',
      action: 'Compare revenue with average daily rate',
      reasoning: 'ADR is a natural neighbor metric for revenue',
      priority: 'medium',
      category: 'compare',
    },
  ],
  conversion_rate: [
    {
      id: 'conversion-dropoff',
      label: 'Where are users dropping off?',
      action: 'Show drop-off analysis',
      reasoning: 'Conversion rate analysis leads to drop-off investigation',
      priority: 'high',
      category: 'drill',
    },
    {
      id: 'conversion-segment',
      label: 'Compare by device type',
      action: 'Break down conversion by device',
      reasoning: 'Device type is a key segmentation dimension',
      priority: 'medium',
      category: 'segment',
    },
  ],
};

/**
 * Hook that generates adaptive suggestions based on current view state
 */
export function useAdaptiveSuggestions(
  currentViewConfig: ViewConfig | null,
  chartData?: any[],
  selectedDataPoint?: any
) {
  const [suggestions, setSuggestions] = useState<AdaptiveSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateSuggestions = useCallback(async () => {
    if (!currentViewConfig) {
      setSuggestions([]);
      return;
    }

    setIsGenerating(true);

    try {
      // Get base suggestions from heuristic map
      const measurement = currentViewConfig.measurement || '';
      const baseSuggestions: AdaptiveSuggestion[] = [];

      // Add category-based suggestions
      if (measurement && CATEGORY_SUGGESTIONS[measurement]) {
        baseSuggestions.push(...CATEGORY_SUGGESTIONS[measurement]);
      }

      // Add neighbor metric suggestions
      if (measurement && METRIC_NEIGHBORS[measurement]) {
        METRIC_NEIGHBORS[measurement].forEach((neighbor, idx) => {
          baseSuggestions.push({
            id: `neighbor-${neighbor}-${idx}`,
            label: `Show ${neighbor.replace('_', ' ')}`,
            action: `Switch to ${neighbor} metric`,
            reasoning: `${neighbor} is a natural neighbor of ${measurement}`,
            priority: idx === 0 ? 'high' : 'medium',
            category: 'compare',
          });
        });
      }

      // If data point is selected, add drill-down suggestions
      if (selectedDataPoint) {
        const dataPointLabel = selectedDataPoint.name || selectedDataPoint.date || 'this point';
        baseSuggestions.unshift({
          id: 'drill-selected',
          label: `Analyze ${dataPointLabel} in detail`,
          action: `Drill down into ${dataPointLabel}`,
          reasoning: `User has selected ${dataPointLabel} - likely wants more detail`,
          priority: 'high',
          category: 'drill',
        });
      }

      // Enhance with AI if available
      try {
        const response = await fetch('http://localhost:8000/api/ai/adaptive-suggestions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            current_view_config: currentViewConfig,
            chart_data: chartData,
            selected_data_point: selectedDataPoint,
            base_suggestions: baseSuggestions,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.suggestions && Array.isArray(data.suggestions)) {
            setSuggestions(data.suggestions.slice(0, 5));
            return;
          }
        }
      } catch (error) {
        console.warn('AI suggestion enhancement failed, using heuristic suggestions');
      }

      // Use base suggestions
      setSuggestions(baseSuggestions.slice(0, 5));
    } catch (error) {
      console.error('Error generating suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsGenerating(false);
    }
  }, [currentViewConfig, chartData, selectedDataPoint]);

  useEffect(() => {
    generateSuggestions();
  }, [generateSuggestions]);

  return {
    suggestions,
    isGenerating,
    refreshSuggestions: generateSuggestions,
  };
}
