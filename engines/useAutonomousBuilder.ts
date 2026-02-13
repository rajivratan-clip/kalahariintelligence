/**
 * Autonomous Chart Builder Hook
 * Handles NL-to-Config conversion and mutation mode for existing charts.
 * Supports both "build new" and "mutate existing" workflows.
 */

import { useState, useCallback } from 'react';
import type { AnalyticsConfigUpdate, ViewConfig } from '../types';
import { useAiOrchestrator } from './useAiOrchestrator';

interface BuildRequest {
  query: string;
  currentConfig?: ViewConfig | null;
  mutationMode?: boolean; // If true, mutate existing config instead of building new
}

interface BuildResult {
  configUpdate: AnalyticsConfigUpdate;
  componentSpec?: any; // Component spec JSON for dynamic rendering
  explanation: string;
  confidence: number;
  requiresConfirmation: boolean; // If confidence < 90, ask user to confirm
  suggestedMutation?: string; // What will be mutated
}

/**
 * Hook for autonomous chart building with mutation support
 */
export function useAutonomousBuilder() {
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildHistory, setBuildHistory] = useState<ViewConfig[]>([]); // For undo
  const { getActiveSession, applyViewConfig } = useAiOrchestrator();

  const buildChart = useCallback(async (
    request: BuildRequest
  ): Promise<BuildResult> => {
    setIsBuilding(true);

    try {
      const session = getActiveSession();
      const currentConfig = request.currentConfig || session?.currentViewConfig;

      // Determine if this is a mutation or new build
      const isMutation = request.mutationMode && currentConfig !== null;

      const response = await fetch('http://localhost:8000/api/ai/autonomous-build', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: request.query,
          current_config: currentConfig,
          mutation_mode: isMutation,
          generate_ui: true, // Always generate component spec
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to build chart');
      }

      const data = await response.json();

      // Save to history for undo
      if (currentConfig && session) {
        setBuildHistory((prev) => [...prev, currentConfig].slice(-10)); // Keep last 10
      }

      return {
        configUpdate: data.config_updates || {},
        componentSpec: data.component_spec,
        explanation: data.explanation || 'Chart built successfully',
        confidence: data.confidence || 100,
        requiresConfirmation: (data.confidence || 100) < 90,
        suggestedMutation: data.suggested_mutation,
      };
    } catch (error) {
      console.error('Error building chart:', error);
      throw error;
    } finally {
      setIsBuilding(false);
    }
  }, [getActiveSession]);

  const applyBuild = useCallback((
    result: BuildResult,
    sessionId: string
  ) => {
    const session = getActiveSession();
    if (!session) return;

    const viewConfig: ViewConfig = {
      id: `build-${Date.now()}`,
      analysis_type: result.configUpdate.analysis_type,
      measurement: result.configUpdate.measurement,
      funnel_definition: result.configUpdate.funnel_steps
        ? {
            steps: result.configUpdate.funnel_steps.map((s: any) => ({
              id: s.id,
              label: s.label,
              event_type: s.event_type,
              event_category: s.event_category || 'generic',
            })),
            view_type: result.configUpdate.funnel_view_type || 'conversion',
            completed_within: result.configUpdate.funnel_completed_within || 30,
            counting_by: result.configUpdate.funnel_counting_by || 'unique_users',
            order: result.configUpdate.funnel_order || 'strict',
            group_by: result.configUpdate.funnel_group_by,
            segments: result.configUpdate.funnel_segments,
            global_filters: result.configUpdate.funnel_global_filters,
          }
        : undefined,
      segmentation_state: result.configUpdate.segment_mode
        ? {
            mode: result.configUpdate.segment_mode,
            events: result.configUpdate.segment_events,
            measurement: result.configUpdate.segment_measurement,
            group_by: result.configUpdate.segment_group_by,
          }
        : undefined,
      layout_template: 'SINGLE_CHART',
      created_at: new Date().toISOString(),
    };

    applyViewConfig(sessionId, viewConfig, result.configUpdate);
  }, [getActiveSession, applyViewConfig]);

  const undoLastBuild = useCallback((sessionId: string) => {
    if (buildHistory.length === 0) return;

    const previousConfig = buildHistory[buildHistory.length - 1];
    setBuildHistory((prev) => prev.slice(0, -1));

    if (previousConfig) {
      const session = getActiveSession();
      if (session) {
        applyViewConfig(sessionId, previousConfig);
      }
    }
  }, [buildHistory, getActiveSession, applyViewConfig]);

  return {
    buildChart,
    applyBuild,
    undoLastBuild,
    isBuilding,
    canUndo: buildHistory.length > 0,
  };
}
