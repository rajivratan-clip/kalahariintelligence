import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, TrendingUp, Users, GitBranch, Sparkles, DollarSign, Clock, Target, X, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import FunnelLab from './FunnelLab';
import RevenueImpactView from './RevenueImpactView';
import HospitalityMetricsView from './HospitalityMetricsView';
import AIInsightsView from './AIInsightsView';
import SegmentationView from './SegmentationView';
import type { DateRange } from './DateFilter';
import AutonomousFunnelBuilder from './AutonomousFunnelBuilder';
import { FunnelDefinition, FunnelStepConfig, AnalyticsConfigUpdate, ViewConfig } from '../types';
import { useAiOrchestrator } from '../engines/useAiOrchestrator';
import { fetchFunnelData } from '../services/funnelService';

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
  | 'revenue_impact'
  | 'ai_insights'
  | 'hospitality_metrics';

// Measurement types for Segmentation analysis
type SegmentationMeasurement = 
  | 'uniques' 
  | 'event_totals' 
  | 'active_percent' 
  | 'average' 
  | 'frequency'
  | 'revenue_per_user'
  | 'hospitality_breakdown';

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

interface AnalyticsStudioProps {
  onExplain?: (title: string, data: unknown) => void;
  onOpenAskAI?: () => void;
  applyConfigRef?: React.MutableRefObject<((u: AnalyticsConfigUpdate) => void) | null>;
}

interface KPIMetric {
  label: string;
  value: number | string;
  subtitle?: string;
  change?: number; // percentage change
  changeType?: 'increase' | 'decrease';
  previousValue?: number;
  icon: React.ReactNode;
  color: string;
  badge?: string;
}

const AnalyticsStudio: React.FC<AnalyticsStudioProps> = ({ onExplain, onOpenAskAI, applyConfigRef }) => {
  const {
    sessions,
    activeSessionId,
    switchSession,
    createNewSession,
    deleteSession,
    getActiveSession,
    ensureDefaultSession,
  } = useAiOrchestrator();

  const [analysisType, setAnalysisType] = useState<AnalysisType>('funnel');
  const [measurement, setMeasurement] = useState<MeasurementType>('conversion');
  const [eventSchema, setEventSchema] = useState<any>(null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetric[]>([]);
  const [isLoadingKPIs, setIsLoadingKPIs] = useState(false);
  const [showAutonomousBuilder, setShowAutonomousBuilder] = useState(false);
  
  // Funnel configuration - will be updated from FunnelLab
  const [funnelConfig, setFunnelConfig] = useState<FunnelDefinition>({
    steps: [],
    view_type: 'conversion',
    completed_within: 30,
    counting_by: 'unique_users',
    order: 'strict',
    segments: []
  });

  // Child views register a getter; header "Ask AI" calls it for current context
  const explainPayloadGetterRef = useRef<(() => { title: string; data: unknown } | null) | null>(null);

  // Initialize date range
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    setDateRange({ startDate, endDate: today });
  }, []);

  // Ensure default session exists on mount
  useEffect(() => {
    ensureDefaultSession();
  }, [ensureDefaultSession]);

  // Fetch KPI metrics
  useEffect(() => {
    const fetchKPIs = async () => {
      if (!dateRange || funnelConfig.steps.length === 0) return;
      
      setIsLoadingKPIs(true);
      try {
        const configWithDateRange: FunnelDefinition = {
          ...funnelConfig,
          global_filters: {
            ...funnelConfig.global_filters,
            date_range: {
              start: dateRange.startDate,
              end: dateRange.endDate,
            }
          }
        };
        
        const currentData = await fetchFunnelData(configWithDateRange);
        
        // Calculate previous period for comparison
        const daysDiff = Math.ceil((new Date(dateRange.endDate).getTime() - new Date(dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24));
        const prevStartDate = new Date(dateRange.startDate);
        prevStartDate.setDate(prevStartDate.getDate() - daysDiff);
        const prevEndDate = new Date(dateRange.startDate);
        
        const prevConfig: FunnelDefinition = {
          ...configWithDateRange,
          global_filters: {
            ...configWithDateRange.global_filters,
            date_range: {
              start: prevStartDate.toISOString().split('T')[0],
              end: prevEndDate.toISOString().split('T')[0],
            }
          }
        };
        
        const previousData = await fetchFunnelData(prevConfig);
        
        if (currentData.length > 0) {
          const totalVisitors = currentData[0]?.visitors || 0;
          const totalConversions = currentData[currentData.length - 1]?.visitors || 0;
          const conversionRate = totalVisitors > 0 ? (totalConversions / totalVisitors) * 100 : 0;
          
          // Calculate total revenue at risk (sum across all steps)
          const totalRevenueAtRisk = currentData.reduce((sum, step) => sum + (step.revenueAtRisk || 0), 0);
          
          // Calculate dropped off count
          const droppedOff = totalVisitors - totalConversions;
          
          // Get average time to convert (from last step or calculate average)
          let avgTimeToConvert = '0m 0s';
          if (currentData.length > 0) {
            const lastStep = currentData[currentData.length - 1];
            if (lastStep.avgTime) {
              avgTimeToConvert = lastStep.avgTime;
            } else {
              // Calculate average time across all steps
              const totalTimeSeconds = currentData.reduce((sum, step) => {
                const timeStr = step.avgTime || '0m 0s';
                const match = timeStr.match(/(\d+)m\s*(\d+)s/);
                if (match) {
                  return sum + parseInt(match[1]) * 60 + parseInt(match[2]);
                }
                return sum;
              }, 0);
              const avgSeconds = currentData.length > 0 ? totalTimeSeconds / currentData.length : 0;
              const minutes = Math.floor(avgSeconds / 60);
              const seconds = Math.floor(avgSeconds % 60);
              avgTimeToConvert = `${minutes}m ${seconds}s`;
            }
          }
          
          // Calculate previous period metrics for comparison
          let prevConversionRate = 0;
          let conversionChange = 0;
          if (previousData.length > 0) {
            const prevTotalVisitors = previousData[0]?.visitors || 0;
            const prevConversions = previousData[previousData.length - 1]?.visitors || 0;
            prevConversionRate = prevTotalVisitors > 0 ? (prevConversions / prevTotalVisitors) * 100 : 0;
            conversionChange = prevConversionRate > 0 ? ((conversionRate - prevConversionRate) / prevConversionRate) * 100 : 0;
          }
          
          setKpiMetrics([
            {
              label: 'Total Conversion',
              value: conversionRate.toFixed(1) + '%',
              change: conversionChange,
              changeType: conversionChange >= 0 ? 'increase' : 'decrease',
              subtitle: conversionChange !== 0 ? `${conversionChange >= 0 ? '+' : ''}${conversionChange.toFixed(1)}% vs last` : undefined,
              icon: <Target size={20} />,
              color: '#10b981'
            },
            {
              label: 'Dropped Off',
              value: droppedOff.toLocaleString(),
              subtitle: 'Guests lost',
              icon: <ArrowDownRight size={20} />,
              color: '#ef4444'
            },
            {
              label: 'Revenue at Risk',
              value: `$${(totalRevenueAtRisk / 1000).toFixed(1)}k`,
              subtitle: 'High Alert',
              icon: <DollarSign size={20} />,
              color: '#f59e0b',
              badge: totalRevenueAtRisk > 10000 ? 'High Alert' : undefined
            },
            {
              label: 'Avg Time to Convert',
              value: avgTimeToConvert,
              icon: <Clock size={20} />,
              color: '#3b82f6'
            }
          ]);
        }
      } catch (error) {
        console.error('Error fetching KPIs:', error);
      } finally {
        setIsLoadingKPIs(false);
      }
    };
    
    if (analysisType === 'funnel') {
      fetchKPIs();
    }
  }, [funnelConfig, dateRange, analysisType]);

  // Sync active session's view config to local state
  useEffect(() => {
    const session = getActiveSession();
    if (session?.currentViewConfig) {
      const view = session.currentViewConfig;
      if (view.analysis_type) setAnalysisType(view.analysis_type);
      if (view.measurement) setMeasurement(view.measurement as MeasurementType);
      if (view.funnel_definition) {
        setFunnelConfig(view.funnel_definition);
        if (view.funnel_definition.steps.length > 0) {
          setInjectedFunnelSteps(view.funnel_definition.steps);
        }
      }
      if (view.segmentation_state?.mode) {
        setInjectedSegmentMode(view.segmentation_state.mode);
      }
    }
  }, [activeSessionId, getActiveSession]);

  // Save funnel config to session when switching away from funnel view
  useEffect(() => {
    const session = getActiveSession();
    if (!session) return;
    
    // Only save if we're switching away from funnel (to preserve config)
    if (analysisType !== 'funnel' && funnelConfig.steps.length > 0) {
      // Update session's view config to preserve funnel state
      const viewConfig: ViewConfig = {
        id: session.currentViewConfig?.id || `funnel-${Date.now()}`,
        analysis_type: 'funnel',
        measurement: measurement as string,
        funnel_definition: funnelConfig,
        layout_template: 'SINGLE_CHART',
      };
      session.currentViewConfig = viewConfig;
    }
  }, [analysisType, funnelConfig, measurement, getActiveSession]);

  // Restore funnel config when switching back to funnel view
  useEffect(() => {
    if (analysisType === 'funnel') {
      const session = getActiveSession();
      if (session?.currentViewConfig?.funnel_definition) {
        const savedConfig = session.currentViewConfig.funnel_definition;
        // Only restore if we have a saved config with steps
        if (savedConfig.steps.length > 0) {
          setFunnelConfig(savedConfig);
          setInjectedFunnelConfig(savedConfig);
        }
      }
    }
  }, [analysisType, getActiveSession]);

  // Register applyConfig so AI guided build can update our state
  useEffect(() => {
    if (!applyConfigRef) return;
    applyConfigRef.current = (updates: AnalyticsConfigUpdate) => {
      const session = getActiveSession();
      if (!session) return;

      // High-level analysis type + measurement
      if (updates.analysis_type) {
        setAnalysisType(updates.analysis_type as AnalysisType);
      }
      if (updates.measurement) {
        setMeasurement(updates.measurement as MeasurementType);
      }

      // --------- Funnel configuration updates ---------
      if (updates.analysis_type === 'funnel') {
        setAnalysisType('funnel');

        // Start from current funnel config
        let nextFunnelConfig: FunnelDefinition = { ...funnelConfig };

        // Steps
        if (updates.funnel_steps && updates.funnel_steps.length > 0) {
          const steps: FunnelStepConfig[] = updates.funnel_steps.map((s, i) => ({
            id: s.id || `step-${i + 1}`,
            label: s.label,
            event_type: s.event_type,
            event_category: s.event_category,
            filters: s.event_category ? [] : [],
          }));
          nextFunnelConfig = { ...nextFunnelConfig, steps };
          setInjectedFunnelSteps(steps);
        }

        // Advanced knobs
        if (updates.funnel_view_type) {
          nextFunnelConfig = { ...nextFunnelConfig, view_type: updates.funnel_view_type };
        }
        if (typeof updates.funnel_completed_within === 'number') {
          nextFunnelConfig = { ...nextFunnelConfig, completed_within: updates.funnel_completed_within };
        }
        if (updates.funnel_counting_by) {
          nextFunnelConfig = { ...nextFunnelConfig, counting_by: updates.funnel_counting_by };
        }
        if (updates.funnel_order) {
          nextFunnelConfig = { ...nextFunnelConfig, order: updates.funnel_order };
        }
        if (typeof updates.funnel_group_by !== 'undefined') {
          nextFunnelConfig = { ...nextFunnelConfig, group_by: updates.funnel_group_by };
        }
        if (updates.funnel_segments) {
          nextFunnelConfig = { ...nextFunnelConfig, segments: updates.funnel_segments };
        }
        if (updates.funnel_global_filters) {
          nextFunnelConfig = { ...nextFunnelConfig, global_filters: updates.funnel_global_filters };
        }

        // Commit funnel config
        setFunnelConfig(nextFunnelConfig);

        // Update session's view config so Ask AI sees full state
        const viewConfig: ViewConfig = {
          id: `funnel-${Date.now()}`,
          analysis_type: 'funnel',
          measurement: (updates.measurement as string) || (measurement as string),
          funnel_definition: nextFunnelConfig,
          layout_template: 'SINGLE_CHART',
        };
        session.currentViewConfig = viewConfig;
      }

      // --------- Segmentation configuration updates ---------
      if (updates.analysis_type === 'segmentation') {
        setAnalysisType('segmentation');

        // Mode (event / behavioral / guest)
        if (updates.segment_mode) {
          setInjectedSegmentMode(updates.segment_mode);
        }

        // Build segmentation_state snapshot for current view config
        const segmentation_state: ViewConfig['segmentation_state'] = {
          mode: updates.segment_mode,
          events: updates.segment_events,
          measurement: updates.segment_measurement,
          group_by: updates.segment_group_by,
        };

        const viewConfig: ViewConfig = {
          id: `segment-${Date.now()}`,
          analysis_type: 'segmentation',
          measurement: updates.segment_measurement || updates.measurement,
          segmentation_state,
          layout_template: 'SINGLE_CHART',
        };
        session.currentViewConfig = viewConfig;
      }
    };
    return () => { applyConfigRef!.current = null; };
  }, [applyConfigRef, funnelConfig, measurement, getActiveSession]);

  const [injectedFunnelSteps, setInjectedFunnelSteps] = useState<FunnelStepConfig[] | null>(null);
  const [injectedFunnelConfig, setInjectedFunnelConfig] = useState<FunnelDefinition | null>(null);
  const [injectedSegmentMode, setInjectedSegmentMode] = useState<'event' | 'behavioral' | 'guest' | null>(null);

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

  const handleNewTab = () => {
    createNewSession({ title: 'New Analysis' });
  };

  const handleTabSwitch = (sessionId: string) => {
    switchSession(sessionId);
  };

  const handleTabClose = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteSession(sessionId);
  };


  return (
    <div className="h-full w-full flex flex-col bg-white overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 flex-shrink-0 z-20 shadow-sm">
        <div className="w-full px-6 py-3">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <span>Analytics</span>
            <span>/</span>
            <span className="text-slate-900 font-medium">Analytics Studio</span>
            {analysisType && (
              <>
                <span>/</span>
                <span className="capitalize">{analysisType === 'funnel' ? 'Funnel Analysis' : analysisType}</span>
              </>
            )}
          </div>

          {/* Title and Action Buttons */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Analytics Studio</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage your analytics and insights here</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                💾 Save Analysis
              </button>
              <button
                onClick={() => {
                  onOpenAskAI?.();
                  const payload = explainPayloadGetterRef.current?.();
                  const session = getActiveSession();
                  const currentView: ViewConfig = {
                    id: `current-${Date.now()}`,
                    analysis_type: analysisType,
                    measurement: measurement as string,
                    funnel_definition: analysisType === 'funnel' ? funnelConfig : undefined,
                    layout_template: 'SINGLE_CHART',
                  };
                  
                  if (onExplain) {
                    if (payload) {
                      onExplain(payload.title, payload.data);
                    } else {
                      onExplain('Analytics Studio', {
                        analysis_type: analysisType,
                        measurement,
                        funnel_config: analysisType === 'funnel' ? funnelConfig : undefined,
                        current_view: currentView,
                        session_analyses: session?.analyses || [],
                        message: 'Select a chart or add funnel steps, then ask for insights.'
                      });
                    }
                  }
                }}
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                style={{ backgroundColor: '#0947A4' }}
              >
                <Sparkles size={16} />
                Ask AI
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white border-b border-slate-200 flex-shrink-0">
        <div className="w-full px-6">
          {/* Session Tabs */}
          {sessions.length > 0 && (
            <div className="flex items-center gap-2 py-2 overflow-x-auto">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleTabSwitch(session.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                    activeSessionId === session.id
                      ? 'bg-[#0947A4] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{session.title}</span>
                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => handleTabClose(e, session.id)}
                      className="ml-1 hover:bg-white/20 rounded p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </button>
              ))}
              <button
                onClick={handleNewTab}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-all"
                title="New Analysis Tab"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">New Tab</span>
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 border-t border-slate-200 pt-2 pb-2">
            <button
              onClick={() => setShowAutonomousBuilder(!showAutonomousBuilder)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                showAutonomousBuilder
                  ? 'bg-brand-500 text-white'
                  : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
              }`}
            >
              <Sparkles size={16} />
              <span>Build with AI</span>
            </button>
          </div>

          {/* Analysis Type Tabs */}
          <div className="flex items-center gap-1 border-t border-slate-200 pt-1">
            <button
              onClick={() => setAnalysisType('funnel')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                analysisType === 'funnel'
                  ? 'text-[#0947A4]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 size={16} />
                <span>Funnel</span>
              </div>
              {analysisType === 'funnel' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0947A4]" />
              )}
            </button>
            <button
              onClick={() => setAnalysisType('segmentation')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                analysisType === 'segmentation'
                  ? 'text-[#0947A4]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users size={16} />
                <span>Segmentation</span>
              </div>
              {analysisType === 'segmentation' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0947A4]" />
              )}
            </button>
            <button
              onClick={() => setAnalysisType('retention')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                analysisType === 'retention'
                  ? 'text-[#0947A4]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={16} />
                <span>Retention</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Soon</span>
              </div>
              {analysisType === 'retention' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0947A4]" />
              )}
            </button>
            <button
              onClick={() => setAnalysisType('paths')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                analysisType === 'paths'
                  ? 'text-[#0947A4]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <GitBranch size={16} />
                <span>Paths</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Soon</span>
              </div>
              {analysisType === 'paths' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0947A4]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="w-full px-6 py-6">
          {/* Autonomous Builder */}
          {showAutonomousBuilder && (
            <div className="mb-6">
              <AutonomousFunnelBuilder
                onConfigBuilt={(config) => {
                  // Map view_type to measurement (only map valid MeasurementType values)
                  const viewTypeToMeasurement: Record<string, MeasurementType> = {
                    'conversion': 'conversion',
                    'overTime': 'over_time',
                    'timeToConvert': 'time_to_convert',
                    'frequency': 'frequency',
                    // 'improvement' and 'significance' are not valid MeasurementType, map to 'conversion'
                    'improvement': 'conversion',
                    'significance': 'conversion',
                  };
                  const measurement: MeasurementType = viewTypeToMeasurement[config.view_type] || 'conversion';

                  // Convert FunnelDefinition to AnalyticsConfigUpdate
                  const configUpdate: AnalyticsConfigUpdate = {
                    analysis_type: 'funnel',
                    measurement: measurement,
                    funnel_steps: config.steps.map((s) => ({
                      id: s.id,
                      label: s.label || s.event_type,
                      event_type: s.event_type,
                      event_category: s.event_category,
                    })),
                    funnel_view_type: config.view_type,
                    funnel_completed_within: config.completed_within,
                    funnel_counting_by: config.counting_by,
                    funnel_group_by: config.group_by,
                    funnel_segments: config.segments,
                    funnel_global_filters: config.global_filters,
                  };

                  // Apply via existing ref
                  if (applyConfigRef?.current) {
                    applyConfigRef.current(configUpdate);
                  }

                  // Update local state
                  setFunnelConfig(config);
                  setAnalysisType('funnel');
                  setMeasurement(measurement);
                  
                  // Set injected config for FunnelLab (includes all settings: steps, segments, view_type, etc.)
                  setInjectedFunnelConfig(config);
                  
                  setShowAutonomousBuilder(false);
                }}
              />
            </div>
          )}

          {/* Main Content */}
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
              
              {/* AI Insights View */}
              {measurement === 'ai_insights' && (
                <AIInsightsView 
                  config={funnelConfig}
                  onExplain={onExplain}
                />
              )}
              
              {/* Standard FunnelLab for all other measurements */}
              {measurement !== 'revenue_impact' && measurement !== 'hospitality_metrics' && measurement !== 'ai_insights' && (
                <FunnelLab 
                  initialMeasurement={measurement as FunnelMeasurement}
                  isEmbedded={true}
                  onExplain={onExplain}
                  onExplainPayloadReady={(getter) => { explainPayloadGetterRef.current = getter; }}
                  injectedSteps={injectedFunnelSteps}
                  injectedConfig={injectedFunnelConfig || (funnelConfig.steps.length > 0 ? funnelConfig : null)}
                  onInjectedStepsConsumed={() => {
                    // Only clear if this was an AI-generated config (injectedFunnelConfig exists)
                    // Don't clear for persisted configs (funnelConfig) to maintain state across view switches
                    if (injectedFunnelConfig) {
                      setInjectedFunnelSteps(null);
                      setInjectedFunnelConfig(null);
                    }
                  }}
                  onConfigChange={(newConfig) => {
                    // Sync FunnelLab's internal config changes back to AnalyticsStudio
                    setFunnelConfig(newConfig);
                    // Also update session to persist changes
                    const session = getActiveSession();
                    if (session) {
                      const viewConfig: ViewConfig = {
                        id: session.currentViewConfig?.id || `funnel-${Date.now()}`,
                        analysis_type: 'funnel',
                        measurement: measurement as string,
                        funnel_definition: newConfig,
                        layout_template: 'SINGLE_CHART',
                      };
                      session.currentViewConfig = viewConfig;
                    }
                  }}
                />
              )}
            </>
          )}

          {analysisType === 'segmentation' && (
            <SegmentationView 
              eventSchema={eventSchema || {}} 
              onExplain={onExplain}
              onExplainPayloadReady={(getter) => { explainPayloadGetterRef.current = getter; }}
              injectedSegmentMode={injectedSegmentMode}
              onInjectedSegmentModeConsumed={() => setInjectedSegmentMode(null)}
            />
          )}

          {(analysisType === 'retention' || analysisType === 'paths') && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
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
