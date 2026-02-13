import React, { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { useAutonomousBuilder } from '../engines/useAutonomousBuilder';
import { useAiOrchestrator } from '../engines/useAiOrchestrator';
import ConfidenceIndicator from './ConfidenceIndicator';
import AnimatedReasoning from './AnimatedReasoning';
import UndoButton from './UndoButton';
import { buildChartFromQuery } from '../services/autonomousBuilderService';
import type { ViewConfig } from '../engines/useAiOrchestrator';

interface AutonomousBuilderUIProps {
  onBuildComplete?: (configUpdate: any) => void;
}

const AutonomousBuilderUI: React.FC<AutonomousBuilderUIProps> = ({
  onBuildComplete,
}) => {
  const [query, setQuery] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingResult, setPendingResult] = useState<any>(null);
  const [isReasoning, setIsReasoning] = useState(false);

  const { buildChart, applyBuild, undoLastBuild, isBuilding, canUndo } =
    useAutonomousBuilder();
  const getActiveSession = useAiOrchestrator(state => state.getActiveSession);

  const handleBuild = async () => {
    if (!query.trim()) return;

    setIsReasoning(true);
    const session = getActiveSession();
    if (!session) return;

    try {
      // Use complete end-to-end builder for funnel queries
      const isFunnelQuery = /funnel|conversion|booking|landed|location|date|room|payment/i.test(query);
      
      if (isFunnelQuery) {
        // Complete autonomous build: Query → Config → Data → Chart
        const result = await buildChartFromQuery({
          query: query.trim(),
          currentConfig: session.currentViewConfig?.funnel_definition || null,
        });
        
        // Convert to build result format
        const buildResult = {
          configUpdate: {
            analysis_type: 'funnel' as const,
            measurement: 'conversion',
            funnel_steps: result.config.steps.map((s: any) => ({
              id: s.id,
              label: s.label || s.event_type,
              event_type: s.event_type,
              event_category: s.event_category,
            })),
            funnel_view_type: result.config.view_type,
            funnel_completed_within: result.config.completed_within,
            funnel_counting_by: result.config.counting_by,
            funnel_group_by: result.config.group_by,
            funnel_segments: result.config.segments,
            funnel_global_filters: result.config.global_filters,
          },
          explanation: result.explanation,
          confidence: result.confidence,
          requiresConfirmation: result.confidence < 90,
        };
        
        setPendingResult(buildResult);
        setIsReasoning(false);
        
        if (!buildResult.requiresConfirmation) {
          // Create ViewConfig for orchestrator
          const viewConfig: ViewConfig = {
            id: `build-${Date.now()}`,
            analysis_type: 'funnel',
            measurement: 'conversion',
            funnel_definition: result.config,
            layout_template: 'SINGLE_CHART',
            created_at: new Date().toISOString(),
          };
          
          // Use orchestrator's applyViewConfig
          const orchestrator = useAiOrchestrator.getState();
          orchestrator.applyViewConfig(session.id, viewConfig, buildResult.configUpdate);
          
          // Also call applyBuild for consistency
          applyBuild(buildResult, session.id);
          onBuildComplete?.(buildResult.configUpdate);
          setQuery('');
        }
        return;
      }

      // Use standard builder for other queries
      const result = await buildChart({
        query: query.trim(),
        currentConfig: session.currentViewConfig,
        mutationMode: !!session.currentViewConfig, // Mutation if config exists
      });

      setPendingResult(result);
      setIsReasoning(false);

      // Show confirmation if confidence is low
      if (result.requiresConfirmation) {
        setShowConfirmation(true);
      } else {
        // Auto-apply if high confidence
        applyBuild(result, session.id);
        onBuildComplete?.(result.configUpdate);
        setQuery('');
      }
    } catch (error) {
      console.error('Build error:', error);
      setIsReasoning(false);
    }
  };

  const handleConfirm = () => {
    const session = getActiveSession();
    if (!session || !pendingResult) return;

    applyBuild(pendingResult, session.id);
    onBuildComplete?.(pendingResult.configUpdate);
    setShowConfirmation(false);
    setPendingResult(null);
    setQuery('');
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setPendingResult(null);
  };

  const handleUndo = () => {
    const session = getActiveSession();
    if (session) {
      undoLastBuild(session.id);
    }
  };

  const reasoningSteps = [
    'Scanning ClickHouse for data...',
    'Mapping natural language to metrics...',
    'Analyzing current configuration...',
    'Building chart specification...',
  ];

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Sparkles
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-600"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleBuild()}
            placeholder="Build a chart... (e.g., 'Show conversion rate for mobile users')"
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isBuilding || isReasoning}
          />
        </div>
        <button
          onClick={handleBuild}
          disabled={!query.trim() || isBuilding || isReasoning}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isBuilding || isReasoning ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Building...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Build</span>
            </>
          )}
        </button>
        <UndoButton onUndo={handleUndo} canUndo={canUndo} variant="icon" />
      </div>

      {/* Animated Reasoning */}
      {isReasoning && (
        <AnimatedReasoning
          steps={reasoningSteps}
          onComplete={() => setIsReasoning(false)}
        />
      )}

      {/* Confidence Indicator / Confirmation */}
      {showConfirmation && pendingResult && (
        <ConfidenceIndicator
          confidence={pendingResult.confidence}
          assumption={pendingResult.suggestedMutation}
          message="Please confirm this is what you want:"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Success Message */}
      {!isBuilding && !isReasoning && pendingResult && !showConfirmation && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle2 size={16} />
          <span>{pendingResult.explanation}</span>
        </div>
      )}
    </div>
  );
};

export default AutonomousBuilderUI;
