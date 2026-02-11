import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, GitBranch, Sparkles, DollarSign, Clock, Target } from 'lucide-react';
import FunnelLab from './FunnelLab';
import RevenueImpactView from './RevenueImpactView';
import HospitalityMetricsView from './HospitalityMetricsView';
import SegmentationView from './SegmentationView';
import { FunnelDefinition } from '../types';

// Analysis types that can be selected
type AnalysisType = 'funnel' | 'segmentation' | 'retention' | 'paths';

// Measurement types for Funnel analysis
type FunnelMeasurement = 
  | 'conversion' 
  | 'over_time' 
  | 'time_to_convert' 
  | 'path_analysis'
  | 'price_sensitivity'
  | 'cohort_analysis'
  | 'executive_summary'
  | 'revenue_impact'  // NEW
  | 'ai_insights'      // NEW
  | 'hospitality_metrics'; // NEW

// Measurement types for Segmentation analysis
type SegmentationMeasurement = 
  | 'uniques' 
  | 'event_totals' 
  | 'active_percent' 
  | 'average' 
  | 'frequency'
  | 'revenue_per_user'      // NEW
  | 'hospitality_breakdown'; // NEW

type MeasurementType = FunnelMeasurement | SegmentationMeasurement;

interface MeasurementOption {
  id: MeasurementType;
  label: string;
  description: string;
  icon: React.ReactNode;
  isNew?: boolean;
}

// Measurement options for each analysis type
const FUNNEL_MEASUREMENTS: MeasurementOption[] = [
  {
    id: 'conversion',
    label: 'Conversion',
    description: 'Step-by-step conversion rates',
    icon: <BarChart3 size={16} />
  },
  {
    id: 'over_time',
    label: 'Over Time',
    description: 'Conversion trends over time',
    icon: <TrendingUp size={16} />
  },
  {
    id: 'time_to_convert',
    label: 'Time to Convert',
    description: 'Time spent at each step',
    icon: <Clock size={16} />
  },
  {
    id: 'path_analysis',
    label: 'Path Analysis',
    description: 'User journey patterns',
    icon: <GitBranch size={16} />
  },
  {
    id: 'revenue_impact',
    label: '💰 Revenue Impact',
    description: 'Revenue lost at each step',
    icon: <DollarSign size={16} />,
    isNew: true
  },
  {
    id: 'ai_insights',
    label: '🤖 AI Insights',
    description: 'GPT-powered forensic analysis',
    icon: <Sparkles size={16} />,
    isNew: true
  },
  {
    id: 'hospitality_metrics',
    label: '🏨 Hospitality Metrics',
    description: 'ADR, LOS, Intent Score',
    icon: <Target size={16} />,
    isNew: true
  },
  {
    id: 'price_sensitivity',
    label: 'Price Sensitivity',
    description: 'Price impact on conversion',
    icon: <DollarSign size={16} />
  },
  {
    id: 'cohort_analysis',
    label: 'Cohort Analysis',
    description: 'User cohort comparison',
    icon: <Users size={16} />
  },
  {
    id: 'executive_summary',
    label: 'Executive Summary',
    description: 'High-level overview',
    icon: <BarChart3 size={16} />
  }
];

const SEGMENTATION_MEASUREMENTS: MeasurementOption[] = [
  {
    id: 'uniques',
    label: 'Uniques',
    description: 'Unique users count',
    icon: <Users size={16} />
  },
  {
    id: 'event_totals',
    label: 'Event Totals',
    description: 'Total event count',
    icon: <BarChart3 size={16} />
  },
  {
    id: 'active_percent',
    label: 'Active %',
    description: 'Percentage of active users',
    icon: <TrendingUp size={16} />
  },
  {
    id: 'average',
    label: 'Average',
    description: 'Average per user',
    icon: <BarChart3 size={16} />
  },
  {
    id: 'frequency',
    label: 'Frequency',
    description: 'Event frequency distribution',
    icon: <BarChart3 size={16} />
  },
  {
    id: 'revenue_per_user',
    label: '💰 Revenue per User',
    description: 'ARR, LTV, booking value',
    icon: <DollarSign size={16} />,
    isNew: true
  },
  {
    id: 'hospitality_breakdown',
    label: '🏨 Hospitality Breakdown',
    description: 'ADR, LOS, RevPAR by segment',
    icon: <Target size={16} />,
    isNew: true
  }
];

const AnalyticsStudio: React.FC = () => {
  const [analysisType, setAnalysisType] = useState<AnalysisType>('funnel');
  const [measurement, setMeasurement] = useState<MeasurementType>('conversion');
  const [eventSchema, setEventSchema] = useState<any>(null);
  
  // Funnel configuration - will be updated from FunnelLab
  const [funnelConfig, setFunnelConfig] = useState<FunnelDefinition>({
    steps: [
      { id: 'step-1', event_type: 'Page Viewed', filters: [], label: 'Landed', event_category: 'hospitality' },
      { id: 'step-2', event_type: 'Location Select', filters: [], label: 'Location Select', event_category: 'hospitality' },
      { id: 'step-3', event_type: 'Date Select', filters: [], label: 'Date Select', event_category: 'hospitality' },
      { id: 'step-4', event_type: 'Room Select', filters: [], label: 'Room Select', event_category: 'hospitality' },
      { id: 'step-5', event_type: 'Payment', filters: [], label: 'Payment', event_category: 'hospitality' },
      { id: 'step-6', event_type: 'Confirmation', filters: [], label: 'Confirmation', event_category: 'hospitality' }
    ],
    view_type: 'conversion',
    completed_within: 30,
    counting_by: 'unique_users',
    order: 'strict',
    segments: []
  });

  // Load event schema
  useEffect(() => {
    const loadSchema = async () => {
      try {
        console.log('[AnalyticsStudio] Loading event schema...');
        const response = await fetch('http://localhost:8000/api/metadata/schema');
        console.log('[AnalyticsStudio] Schema response status:', response.status);
        if (response.ok) {
          const schema = await response.json();
          console.log('[AnalyticsStudio] Schema loaded:', schema);
          setEventSchema(schema);
        } else {
          console.error('[AnalyticsStudio] Schema load failed:', response.status);
        }
      } catch (error) {
        console.error('[AnalyticsStudio] Error loading event schema:', error);
      }
    };
    loadSchema();
  }, []);

  // Get available measurements based on analysis type
  const availableMeasurements = analysisType === 'funnel' 
    ? FUNNEL_MEASUREMENTS 
    : SEGMENTATION_MEASUREMENTS;

  // Reset measurement when analysis type changes
  useEffect(() => {
    if (analysisType === 'funnel') {
      setMeasurement('conversion');
    } else if (analysisType === 'segmentation') {
      setMeasurement('uniques');
    }
  }, [analysisType]);

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 flex-shrink-0 z-10 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Analytics Studio</h1>
              <p className="text-sm text-slate-500 mt-1">Unified analysis platform - Better than Amplitude</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                💾 Save Analysis
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors">
                🤖 Ask AI
              </button>
            </div>
          </div>

          {/* Analysis Type Tabs */}
          <div className="flex gap-2 border-b border-slate-200">
            <button
              onClick={() => setAnalysisType('funnel')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                analysisType === 'funnel'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 size={16} />
                🔍 Funnel Analysis
              </div>
            </button>
            <button
              onClick={() => setAnalysisType('segmentation')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                analysisType === 'segmentation'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users size={16} />
                👥 Segmentation
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Coming Soon</span>
              </div>
            </button>
            <button
              onClick={() => setAnalysisType('retention')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                analysisType === 'retention'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={16} />
                🔄 Retention
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Coming Soon</span>
              </div>
            </button>
            <button
              onClick={() => setAnalysisType('paths')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                analysisType === 'paths'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <GitBranch size={16} />
                🛤️ Paths
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Coming Soon</span>
              </div>
            </button>
          </div>

          {/* Measured As Selector */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">📊 Measured as:</span>
            <div className="relative">
              <select
                value={measurement}
                onChange={(e) => setMeasurement(e.target.value as MeasurementType)}
                className="appearance-none pl-3 pr-10 py-2 text-sm font-medium bg-white border border-slate-300 rounded-lg text-slate-900 hover:border-purple-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20 cursor-pointer transition-colors"
              >
                {availableMeasurements.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} {option.isNew ? '⭐ NEW' : ''}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                ▼
              </div>
            </div>
            {availableMeasurements.find(m => m.id === measurement)?.description && (
              <span className="text-xs text-slate-500">
                • {availableMeasurements.find(m => m.id === measurement)?.description}
              </span>
            )}
            {availableMeasurements.find(m => m.id === measurement)?.isNew && (
              <span className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded font-medium">
                ⭐ Better than Amplitude
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          {analysisType === 'funnel' && (
            <>
              {/* Revenue Impact View */}
              {measurement === 'revenue_impact' && (
                <RevenueImpactView config={funnelConfig} />
              )}
              
              {/* Hospitality Metrics View */}
              {measurement === 'hospitality_metrics' && (
                <HospitalityMetricsView config={funnelConfig} />
              )}
              
              {/* Standard FunnelLab for all other measurements */}
              {measurement !== 'revenue_impact' && measurement !== 'hospitality_metrics' && (
                <FunnelLab 
                  initialMeasurement={measurement as FunnelMeasurement}
                  isEmbedded={true}
                />
              )}
            </>
          )}

        {analysisType === 'segmentation' && (
          <SegmentationView eventSchema={eventSchema || {}} />
        )}

        {(analysisType === 'retention' || analysisType === 'paths') && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Sparkles size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Coming Soon</h3>
            <p className="text-slate-500">
              This analysis type is under development
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsStudio;
