/**
 * Suggestion Engine
 * Generates context-aware suggestions based on AnalyticsConfig changes.
 * Listens to filter changes, segment changes, metric changes.
 * Uses embeddings + Azure GPT for relevance.
 */

import type { ViewConfig } from './useAiOrchestrator';

export interface Suggestion {
  id: string;
  type: 'compare' | 'drill' | 'segment' | 'forecast' | 'diagnose';
  title: string;
  description: string;
  action_score: number; // 0-100 relevance score
  suggested_action: string; // Natural language action to execute
  metadata?: Record<string, any>;
}

/**
 * Generate context-aware suggestions based on current view config and session history.
 */
export async function generateSuggestions(
  currentConfig: ViewConfig | null,
  sessionHistory: ViewConfig[]
): Promise<Suggestion[]> {
  if (!currentConfig) {
    return [];
  }

  try {
    const response = await fetch('http://localhost:8000/api/ai/suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_view_config: currentConfig,
        session_history: sessionHistory.slice(-5), // Last 5 analyses
      }),
    });

    if (!response.ok) {
      console.warn('Failed to generate suggestions');
      return [];
    }

    const data = await response.json();
    return data.suggestions || [];
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return [];
  }
}

/**
 * Generate suggestions based on funnel analysis.
 */
export function generateFunnelSuggestions(config: ViewConfig): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (!config.funnel_definition) {
    return suggestions;
  }

  const { steps, group_by, segments } = config.funnel_definition;

  // Compare suggestions
  if (!group_by && steps.length > 0) {
    suggestions.push({
      id: 'compare-device',
      type: 'compare',
      title: 'Compare by Device Type',
      description: 'See how mobile vs desktop users convert differently',
      action_score: 75,
      suggested_action: 'Group this funnel by device type',
    });

    suggestions.push({
      id: 'compare-traffic',
      type: 'compare',
      title: 'Compare Traffic Sources',
      description: 'Identify which marketing channels drive the best conversions',
      action_score: 70,
      suggested_action: 'Group this funnel by traffic source',
    });
  }

  // Drill-down suggestions
  if (steps.length > 3) {
    const midStep = steps[Math.floor(steps.length / 2)];
    if (midStep) {
      suggestions.push({
        id: 'drill-mid-step',
        type: 'drill',
        title: `Analyze ${midStep.label || 'Middle Step'}`,
        description: `Deep dive into what happens at this step`,
        action_score: 65,
        suggested_action: `Show detailed analysis for ${midStep.label || 'this step'}`,
      });
    }
  }

  // Segment suggestions
  if (!segments || segments.length === 0) {
    suggestions.push({
      id: 'segment-mobile',
      type: 'segment',
      title: 'Segment Mobile Users',
      description: 'Create a segment for mobile users to compare conversion rates',
      action_score: 60,
      suggested_action: 'Add a segment for mobile device users',
    });
  }

  return suggestions;
}

/**
 * Generate suggestions based on segmentation analysis.
 */
export function generateSegmentationSuggestions(config: ViewConfig): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (!config.segmentation_state) {
    return suggestions;
  }

  const { mode, group_by } = config.segmentation_state;

  // Compare suggestions
  if (mode === 'event' && !group_by) {
    suggestions.push({
      id: 'compare-device-seg',
      type: 'compare',
      title: 'Breakdown by Device',
      description: 'See how events vary across device types',
      action_score: 70,
      suggested_action: 'Group events by device type',
    });
  }

  // Forecast suggestions
  if (mode === 'behavioral' || mode === 'guest') {
    suggestions.push({
      id: 'forecast-conversion',
      type: 'forecast',
      title: 'Project Next Week',
      description: 'Forecast conversion rates for the next 7 days',
      action_score: 55,
      suggested_action: 'Show forecast for next week',
    });
  }

  return suggestions;
}
