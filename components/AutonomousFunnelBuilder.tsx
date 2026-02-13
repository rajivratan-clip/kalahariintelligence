import React, { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { buildChartFromQuery } from '../services/autonomousBuilderService';
import { useAiOrchestrator } from '../engines/useAiOrchestrator';
import AnimatedReasoning from './AnimatedReasoning';
import FunnelLab from './FunnelLab';
import FunnelConfigConfirmation from './FunnelConfigConfirmation';
import type { FunnelDefinition } from '../types';

interface AutonomousFunnelBuilderProps {
  onConfigBuilt?: (config: FunnelDefinition) => void;
}

/**
 * Complete Autonomous Funnel Builder
 * User types: "Build a conversion funnel for booking: landed, location select, date select, room select 
 * with segment comparison device type = mobile, counting only unique users and completed within 1 day"
 * 
 * System:
 * 1. Parses query → extracts all parameters
 * 2. Builds FunnelDefinition
 * 3. Queries database
 * 4. Renders chart automatically
 */
const AutonomousFunnelBuilder: React.FC<AutonomousFunnelBuilderProps> = ({
  onConfigBuilt,
}) => {
  const [query, setQuery] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<FunnelDefinition | null>(null);

  const { getActiveSession } = useAiOrchestrator();

  const handleBuild = async () => {
    if (!query.trim()) return;

    setIsBuilding(true);
    setError(null);
    setBuildResult(null);

    try {
      const session = getActiveSession();
      const currentConfig = session?.currentViewConfig?.funnel_definition || null;

      // Complete end-to-end build
      const result = await buildChartFromQuery({
        query: query.trim(),
        currentConfig,
      });

      setBuildResult(result);

      // Always show confirmation dialog for user to review and edit
      setPendingConfig(result.config);
      setShowConfirmation(true);
    } catch (err: any) {
      setError(err.message || 'Failed to build chart');
      console.error('Build error:', err);
    } finally {
      setIsBuilding(false);
    }
  };

  const handleConfirm = () => {
    if (pendingConfig) {
      onConfigBuilt?.(pendingConfig);
      setShowConfirmation(false);
      setPendingConfig(null);
      setQuery('');
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setPendingConfig(null);
  };

  const reasoningSteps = [
    'Parsing your query...',
    'Extracting funnel parameters...',
    'Building funnel configuration...',
    'Querying ClickHouse database...',
    'Rendering chart...',
  ];

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={20} className="text-brand-600" />
          <h3 className="text-lg font-semibold text-slate-900">
            Autonomous Chart Builder
          </h3>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Describe what you want to see. I'll build the entire chart automatically.
        </p>

        <div className="flex items-start gap-2">
          <div className="flex-1 relative">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Example: Build an over time funnel chart for funnel: Landed, location, date, room, payment with mobile device vs tablet device, unique users, 1 day window"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              rows={3}
              disabled={isBuilding}
            />
          </div>
          <button
            onClick={handleBuild}
            disabled={!query.trim() || isBuilding}
            className="px-6 py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
          >
            {isBuilding ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Building...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Build Chart</span>
              </>
            )}
          </button>
        </div>

        {/* Example Queries */}
        <div className="mt-3 text-xs text-slate-500 space-y-1">
          <div><strong>Try:</strong> "Build an over time funnel chart for funnel: Landed, location, date, room, payment with mobile device vs tablet device, unique users, 1 day window"</div>
          <div>Or: "Build a time to convert funnel: landed, location, date with desktop device, sessions, 7 day window"</div>
        </div>
      </div>

      {/* Animated Reasoning */}
      {isBuilding && (
        <AnimatedReasoning steps={reasoningSteps} />
      )}

      {/* Configuration Confirmation Dialog */}
      {showConfirmation && pendingConfig && buildResult && (
        <FunnelConfigConfirmation
          initialConfig={pendingConfig}
          extractedParams={buildResult.extractedParams}
          onConfirm={(finalConfig) => {
            onConfigBuilt?.(finalConfig);
            setShowConfirmation(false);
            setPendingConfig(null);
            setQuery('');
          }}
          onCancel={handleCancel}
        />
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium text-red-900 mb-1">Build Failed</div>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Success & Chart Preview */}
      {buildResult && !showConfirmation && (
        <div className="space-y-4">
          {/* Success Message */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-2">
            <CheckCircle2 size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-green-900 mb-1">Chart Built Successfully!</div>
              <p className="text-sm text-green-700 mb-2">{buildResult.explanation}</p>
              <div className="text-xs text-green-600 space-y-1">
                <div><strong>Steps:</strong> {buildResult.extractedParams.steps?.join(' → ')}</div>
                <div><strong>Measured As:</strong> {buildResult.extractedParams.viewType || buildResult.config.view_type || 'conversion'}</div>
                {buildResult.extractedParams.segmentComparisons && buildResult.extractedParams.segmentComparisons.length > 0 ? (
                  <div><strong>Segments:</strong> {buildResult.extractedParams.segmentComparisons.map(s => `${s.dimension}=${s.value}`).join(' vs ')}</div>
                ) : buildResult.extractedParams.segmentComparison ? (
                  <div><strong>Segment:</strong> {buildResult.extractedParams.segmentComparison.dimension} = {buildResult.extractedParams.segmentComparison.value}</div>
                ) : null}
                <div><strong>Counting:</strong> {buildResult.extractedParams.countingBy}</div>
                <div><strong>Completed Within:</strong> {buildResult.extractedParams.completedWithin} day(s)</div>
              </div>
            </div>
          </div>

          {/* Rendered Chart */}
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <FunnelLab
              initialMeasurement={buildResult.config.view_type === 'overTime' ? 'over_time' : buildResult.config.view_type === 'timeToConvert' ? 'time_to_convert' : 'conversion'}
              isEmbedded={true}
              injectedConfig={buildResult.config}
              onInjectedStepsConsumed={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AutonomousFunnelBuilder;
