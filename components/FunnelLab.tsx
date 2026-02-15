import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import DateFilter, { DateRange } from './DateFilter';
import ChartTypeSelector, { ChartType } from './ChartTypeSelector';
import ChartRenderer from './ChartRenderer';
import { 
  Plus, 
  X, 
  Sparkles, 
  TrendingDown, 
  TrendingUp,
  Filter, 
  Settings, 
  ChevronDown, 
  ArrowRight,
  Clock,
  Users,
  DollarSign,
  Target,
  Wand2,
  Trash2,
  MoveVertical,
  GripVertical,
  AlertTriangle,
  Calendar,
  MapPin,
  Globe,
  Smartphone,
  UserCircle,
  MousePointerClick,
  FileText,
  Eye,
  Download,
  Save,
  Share2
} from 'lucide-react';
import { FunnelStep, FunnelDefinition, FunnelStepConfig, FrictionPoint, EventFilter, SegmentComparison } from '../types';
import { fetchFunnelData, fetchFrictionData, fetchOverTimeData, fetchEventSchema, fetchPathAnalysis, fetchLatencyData, fetchAbnormalDropoffs, fetchPriceSensitivity } from '../services/funnelService';
// Disabled: fetchCohortAnalysis, fetchExecutiveSummary - returning errors and not currently used
// AI Insights - using new opt-in component
import KPICardWithAIButton from './KPICardWithAIButton';

interface FunnelLabProps {
  onExplain?: (title: string, data: any) => void;
  onExplainPayloadReady?: (getter: (() => { title: string; data: any } | null) | null) => void;
  initialMeasurement?: string;  // Initial view type (from Analytics Studio)
  isEmbedded?: boolean;          // If true, hide header (Analytics Studio provides it)
  injectedSteps?: FunnelStepConfig[] | null;  // AI guided build: steps to apply
  injectedConfig?: FunnelDefinition | null;  // AI autonomous build: full config to apply
  onInjectedStepsConsumed?: () => void;  // Call after applying
  onConfigChange?: (config: FunnelDefinition) => void;  // Callback when config changes internally
}

// Event Library - Generic Behavioral Events
const GENERIC_EVENTS = [
  { name: 'Start Session', event_name: 'session_start', icon: Globe, category: 'generic' },
  { name: 'Page View', event_name: 'page_view', icon: Eye, category: 'generic' },
  { name: 'Form Interaction', event_name: 'form_interaction', icon: FileText, category: 'generic' },
  { name: 'Click', event_name: 'click', icon: MousePointerClick, category: 'generic' },
];

// Event Library - Hospitality Milestones (8 Funnel Steps)
const HOSPITALITY_MILESTONES = [
  { name: 'Landed', event_name: 'landed', description: 'Reached Homepage', icon: Globe, category: 'hospitality' },
  { name: 'Location Select', event_name: 'location_select', description: 'Picked a resort (Wisconsin, Pocono, etc.)', icon: MapPin, category: 'hospitality' },
  { name: 'Date Select', event_name: 'date_select', description: 'Interacted with the calendar', icon: Calendar, category: 'hospitality' },
  { name: 'Room Select', event_name: 'room_select', description: 'Browsed specific room types', icon: UserCircle, category: 'hospitality' },
  { name: 'Add-on Select', event_name: 'addon_select', description: 'Looked at Waterpark/Spa extras', icon: Plus, category: 'hospitality' },
  { name: 'Guest Info', event_name: 'guest_info', description: 'Started entering personal details', icon: Users, category: 'hospitality' },
  { name: 'Payment', event_name: 'payment', description: 'Reached the CC entry screen', icon: DollarSign, category: 'hospitality' },
  { name: 'Confirmation', event_name: 'confirmation', description: 'Success/Thank you page', icon: Target, category: 'hospitality' },
];

// Curated Segment Properties - Only useful comparison dimensions with actual database values
const SEGMENT_PROPERTIES = [
  {
    property: 'device_type',
    label: '📱 Device Type',
    values: [
      { value: 'mobile', label: 'Mobile' },
      { value: 'desktop', label: 'Desktop' },
      { value: 'tablet', label: 'Tablet' }
    ]
  },
  {
    property: 'guest_segment',
    label: '👥 Guest Segment',
    values: [
      { value: 'Family', label: 'Family' },
      { value: 'Couples', label: 'Couples' },
      { value: 'VIP', label: 'VIP' },
      { value: 'Corporate', label: 'Corporate' },
      { value: 'Groups', label: 'Groups' }
    ]
  },
  {
    property: 'selected_location',
    label: '🏔️ Location',
    values: [
      { value: 'wisconsin_dells', label: 'Wisconsin Dells' },
      { value: 'pocono_mountains', label: 'Pocono Mountains' },
      { value: 'round_rock_texas', label: 'Round Rock, Texas' },
      { value: 'sandusky_ohio', label: 'Sandusky, Ohio' }
    ]
  },
  {
    property: 'utm_source',
    label: '🔗 Traffic Source',
    values: [
      { value: 'google', label: 'Google' },
      { value: 'facebook', label: 'Facebook' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'bing', label: 'Bing' },
      { value: 'email', label: 'Email' },
      { value: 'direct', label: 'Direct' }
    ]
  },
  {
    property: 'browser',
    label: '🌐 Browser',
    values: [
      { value: 'chrome', label: 'Chrome' },
      { value: 'safari', label: 'Safari' },
      { value: 'firefox', label: 'Firefox' },
      { value: 'edge', label: 'Edge' }
    ]
  },
  {
    property: 'os',
    label: '💻 Operating System',
    values: [
      { value: 'windows', label: 'Windows' },
      { value: 'macos', label: 'macOS' },
      { value: 'ios', label: 'iOS' },
      { value: 'android', label: 'Android' },
      { value: 'linux', label: 'Linux' }
    ]
  },
  {
    property: 'is_returning_visitor',
    label: '🔄 Visitor Type',
    values: [
      { value: 'true', label: 'Returning Visitors' },
      { value: 'false', label: 'New Visitors' }
    ]
  }
];

const FunnelLab: React.FC<FunnelLabProps> = ({ onExplain, onExplainPayloadReady, initialMeasurement, isEmbedded = false, injectedSteps, injectedConfig, onInjectedStepsConsumed, onConfigChange }) => {
  const [config, setConfig] = useState<FunnelDefinition>({
    steps: [],
    view_type: 'conversion',
    completed_within: 1, // days
    counting_by: 'unique_users',
    order: 'strict',
    group_by: null,
    segments: [],  // User-defined segments for comparison
    global_filters: {},
    compare_segment: null,
  });

  const [data, setData] = useState<FunnelStep[]>([]);
  const [overTimeData, setOverTimeData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [selectedEventCategory, setSelectedEventCategory] = useState<'generic' | 'hospitality' | 'custom'>('hospitality');
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);  // For segment filter editing
  const [showCustomEventBuilder, setShowCustomEventBuilder] = useState(false);  // For custom event creation
  const [customEvents, setCustomEvents] = useState<any[]>([]);  // User's custom event templates
  const [frictionData, setFrictionData] = useState<Record<string, FrictionPoint[]>>({});
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'conversion' | 'overTime' | 'timeToConvert' | 'pathAnalysis' | 'priceSensitivity' | 'cohortAnalysis' | 'executive'>('conversion');
  
  // Advanced analytics data
  const [pathAnalysisData, setPathAnalysisData] = useState<any[]>([]);
  const [latencyData, setLatencyData] = useState<any[]>([]);
  const [abnormalDropoffsData, setAbnormalDropoffsData] = useState<any[]>([]);
  const [priceSensitivityData, setPriceSensitivityData] = useState<any[]>([]);
  const [cohortAnalysisData, setCohortAnalysisData] = useState<any[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState<any>(null);
  
  // Event schema from backend
  const [eventSchema, setEventSchema] = useState<any>(null);
  const [segmentValues, setSegmentValues] = useState<any>(null);
  const [isLoadingSegmentValues, setIsLoadingSegmentValues] = useState(false);
  const [dynamicEvents, setDynamicEvents] = useState<Array<{event_type: string; label: string; count?: number}>>([]);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [overTimeChartType, setOverTimeChartType] = useState<ChartType>('area');
  const [conversionChartType, setConversionChartType] = useState<ChartType>('bar');
  const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || 'http://localhost:8000';

  // Initialize with default date range (last 30 days)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    setDateRange({ startDate, endDate: today });
  }, []);

  // Set initial measurement from Analytics Studio
  useEffect(() => {
    if (initialMeasurement) {
      // Map Analytics Studio measurements to FunnelLab tabs
      const measurementToTab: Record<string, typeof activeTab> = {
        'conversion': 'conversion',
        'over_time': 'overTime',
        'time_to_convert': 'timeToConvert',
        'path_analysis': 'pathAnalysis',
        'price_sensitivity': 'priceSensitivity',
        'cohort_analysis': 'cohortAnalysis',
        'executive_summary': 'executive',
        'revenue_impact': 'executive',  // Use executive tab, will add revenue metrics there
        'ai_insights': 'conversion',     // Will overlay AI insights on conversion
        'hospitality_metrics': 'executive' // Will add hospitality metrics to executive
      };
      
      const tab = measurementToTab[initialMeasurement as keyof typeof measurementToTab];
      if (tab) {
        setActiveTab(tab);
      }
    }
  }, [initialMeasurement]);

  // Fetch dynamic events when Add Step modal opens (for Generic tab)
  useEffect(() => {
    if (showAddStepModal && dynamicEvents.length === 0) {
      fetch(`${API_BASE}/api/funnel/events/dynamic?limit=30`)
        .then(r => r.ok ? r.json() : { events: [] })
        .then(d => setDynamicEvents(d.events || []))
        .catch(() => setDynamicEvents([]));
    }
  }, [showAddStepModal]);

  // Fetch event schema on mount
  useEffect(() => {
    const loadSchema = async () => {
      const schema = await fetchEventSchema();
      setEventSchema(schema);
      // Custom events are now included in the schema response
      if (schema.custom_events) {
        setCustomEvents(schema.custom_events);
      }
    };
    loadSchema();
    
    // Load segment values (actual database values)
    const loadSegmentValues = async () => {
      setIsLoadingSegmentValues(true);
      try {
        const response = await fetch(`${API_BASE}/api/metadata/segment-values`);
        if (response.ok) {
          const data = await response.json();
          setSegmentValues(data.segment_properties);
        }
      } catch (error) {
        console.error('Error loading segment values:', error);
      } finally {
        setIsLoadingSegmentValues(false);
      }
    };
    loadSegmentValues();
    
    // Load custom events
    loadCustomEvents();
  }, []);
  
  // Function to load custom events from backend
  const loadCustomEvents = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/custom-events?user_id=default_user`);
      if (response.ok) {
        const data = await response.json();
        setCustomEvents(data.custom_events || []);
      }
    } catch (error) {
      console.error('Error loading custom events:', error);
    }
  };
  
  // Function to create a new custom event template
  const createCustomEvent = async (template: {
    template_name: string;
    description?: string;
    base_event_type: string;
    filters: any[];
    icon?: string;
  }) => {
    try {
      const response = await fetch(`${API_BASE}/api/custom-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'default_user',
          template_name: template.template_name,
          description: template.description || '',
          base_event_type: template.base_event_type,
          base_event_category: 'generic',
          filters: template.filters,
          icon: template.icon || '📦'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        // Reload custom events
        await loadCustomEvents();
        return result;
      }
    } catch (error) {
      console.error('Error creating custom event:', error);
      throw error;
    }
  };
  
  // Function to delete a custom event template
  const deleteCustomEvent = async (templateId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/custom-events/${templateId}?user_id=default_user`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Reload custom events
        await loadCustomEvents();
        return true;
      }
    } catch (error) {
      console.error('Error deleting custom event:', error);
      throw error;
    }
  };

  // Fetch funnel data when config or date range changes
  useEffect(() => {
    const loadData = async () => {
      if (!dateRange) {
        setIsLoading(false);
        return; // Wait for date range to be initialized
      }
      
      // Don't fetch if no steps
      if (config.steps.length === 0) {
        setIsLoading(false);
        setData([]);
        return;
      }
      
      setIsLoading(true);
      try {
        // Update config with date range
        const configWithDateRange = {
          ...config,
          global_filters: {
            ...config.global_filters,
            date_range: dateRange ? {
              start: dateRange.startDate,
              end: dateRange.endDate,
            } : undefined,
          }
        };
        
        // Disabled cohort analysis and executive summary - returning errors and not currently used
        const [funnelData, timeSeriesData, pathData, latency, abnormal, price] = await Promise.all([
          fetchFunnelData(configWithDateRange),
          fetchOverTimeData(configWithDateRange),
          fetchPathAnalysis(configWithDateRange),
          fetchLatencyData(configWithDateRange),
          fetchAbnormalDropoffs(configWithDateRange),
          fetchPriceSensitivity(configWithDateRange)
        ]);
        setData(funnelData);
        setOverTimeData(timeSeriesData);
        setPathAnalysisData(pathData);
        setLatencyData(latency);
        setAbnormalDropoffsData(abnormal);
        setPriceSensitivityData(price);
        // Set empty defaults for disabled features
        setCohortAnalysisData([]);
        setExecutiveSummary(null);
        
        // Load friction data for each step
        if (funnelData.length > 0) {
          const frictionPromises = funnelData.map((step, idx) => 
            fetchFrictionData(step.event_name || step.name || config.steps[idx]?.event_type || `step_${idx + 1}`).then(result => ({
              stepId: step.id,
              friction: result.friction_points || []
            })).catch(() => ({
              stepId: step.id,
              friction: []
            }))
          );
          const frictionResults = await Promise.all(frictionPromises);
          const frictionMap: Record<string, FrictionPoint[]> = {};
          frictionResults.forEach(({ stepId, friction }) => {
            frictionMap[stepId] = friction;
          });
          setFrictionData(frictionMap);
        }
      } catch (error) {
        console.error('Error loading funnel data:', error);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [config, dateRange]);

  // Apply injected steps from AI guided build
  useEffect(() => {
    if (injectedSteps && injectedSteps.length > 0) {
      setConfig((prev) => ({ ...prev, steps: injectedSteps }));
      onInjectedStepsConsumed?.();
    }
  }, [injectedSteps]);

  // Apply injected config from AI autonomous build (full config including view_type, counting_by, etc.)
  useEffect(() => {
    if (injectedConfig) {
      // Deep clone to ensure React detects the change
      const configCopy: FunnelDefinition = {
        ...injectedConfig,
        steps: [...injectedConfig.steps],
        segments: injectedConfig.segments ? [...injectedConfig.segments] : [],
        global_filters: injectedConfig.global_filters ? { ...injectedConfig.global_filters } : {},
      };
      setConfig(configCopy);
      // Update active tab based on view_type
      if (injectedConfig.view_type === 'overTime') {
        setActiveTab('overTime');
      } else if (injectedConfig.view_type === 'timeToConvert') {
        setActiveTab('timeToConvert');
      } else {
        setActiveTab('conversion');
      }
      onInjectedStepsConsumed?.();
    }
  }, [injectedConfig]);

  // Register explain payload for parent (Analytics Studio header "Ask AI")
  useEffect(() => {
    if (!onExplainPayloadReady) return;
    const getter = () => {
      if (config.steps.length === 0 || data.length === 0) return null;
      return {
        title: 'Funnel Explorer Analysis',
        data: {
          config: {
            steps: config.steps.map(s => ({ label: s.label, event_type: s.event_type, filters: s.filters })),
            completed_within: config.completed_within,
            global_filters: config.global_filters,
            group_by: config.group_by
          },
          funnel_conversion: data.map((step, idx) => {
            const prevVisitors = idx > 0 ? data[idx - 1].visitors : step.visitors;
            return {
              step_name: step.name,
              step_index: idx + 1,
              visitors: step.visitors,
              conversion_rate: prevVisitors > 0 ? ((step.visitors / prevVisitors) * 100) : 100,
              drop_off_count: idx > 0 ? Math.max(0, prevVisitors - step.visitors) : 0,
              drop_off_rate: idx > 0 ? Math.max(0, ((prevVisitors - step.visitors) / prevVisitors) * 100) : 0
            };
          }),
          friction_data: frictionData,
          over_time_data: overTimeData,
          path_analysis: pathAnalysisData,
          latency_data: latencyData,
          abnormal_dropoffs: abnormalDropoffsData,
          price_sensitivity: priceSensitivityData,
          cohort_analysis: cohortAnalysisData,
          executive_summary: executiveSummary,
          summary: {
            total_visitors: data[0]?.visitors || 0,
            final_conversions: data[data.length - 1]?.visitors || 0,
            overall_conversion_rate: data[0]?.visitors > 0 ? ((data[data.length - 1]?.visitors || 0) / data[0].visitors * 100).toFixed(1) : 0,
            total_dropped: data[0]?.visitors - (data[data.length - 1]?.visitors || 0)
          }
        }
      };
    };
    onExplainPayloadReady(getter);
    return () => { onExplainPayloadReady(null); };
  }, [onExplainPayloadReady, config, data, frictionData, overTimeData, pathAnalysisData, latencyData, abnormalDropoffsData, priceSensitivityData, cohortAnalysisData, executiveSummary]);

  const handleAddStep = (eventType: string, category: 'generic' | 'hospitality' | 'custom', customEventData?: any) => {
    const label = category === 'custom' ? customEventData?.template_name : (customEventData?.label || eventType);
    const newStep: FunnelStepConfig = {
      id: Date.now().toString(),
      label,
      event_category: category === 'custom' ? 'generic' : category,
      event_type: category === 'custom' ? (customEventData?.base_event_type || eventType) : eventType,
      filters: category === 'custom' ? (customEventData?.filters || []) : []
    };
    setConfig(prev => {
      const newConfig = {
        ...prev,
        steps: [...prev.steps, newStep]
      };
      onConfigChange?.(newConfig);
      return newConfig;
    });
    setShowAddStepModal(false);
  };

  const handleAddFilter = (stepId: string, filter: EventFilter) => {
    setConfig(prev => ({
      ...prev,
      steps: prev.steps.map(step => 
        step.id === stepId 
          ? { ...step, filters: [...(step.filters || []), filter] }
          : step
      )
    }));
  };

  const handleRemoveFilter = (stepId: string, filterIndex: number) => {
    setConfig(prev => ({
      ...prev,
      steps: prev.steps.map(step => 
        step.id === stepId 
          ? { ...step, filters: step.filters?.filter((_, idx) => idx !== filterIndex) || [] }
          : step
      )
         }));
  };

  const handleUpdateStepLabel = (stepId: string, label: string) => {
    setConfig(prev => ({
      ...prev,
      steps: prev.steps.map(step => 
        step.id === stepId ? { ...step, label } : step
      )
    }));
  };

  const handleRemoveStep = (id: string) => {
    setConfig(prev => {
      const newConfig = {
        ...prev,
        steps: prev.steps.filter(s => s.id !== id)
      };
      onConfigChange?.(newConfig);
      return newConfig;
    });
  };

  const handleUpdateStepFilters = (stepId: string, filters: Record<string, any>) => {
    setConfig(prev => ({
      ...prev,
      steps: prev.steps.map(step => 
        step.id === stepId ? { ...step, filters: { ...step.filters, ...filters } } : step
      )
    }));
  };

  const handleUpdateViewType = (viewType: 'conversion' | 'overTime' | 'timeToConvert' | 'frequency' | 'improvement' | 'significance') => {
    setConfig(prev => {
      const newConfig = { ...prev, view_type: viewType };
      onConfigChange?.(newConfig);
      return newConfig;
    });
    // Auto-switch to Over Time tab when view_type is overTime
    if (viewType === 'overTime') {
      setActiveTab('overTime');
    } else if (viewType === 'timeToConvert') {
      setActiveTab('timeToConvert');
    } else {
      setActiveTab('conversion');
    }
  };

  const handleUpdateCompletedWithin = (days: number) => {
    setConfig(prev => {
      const newConfig = { ...prev, completed_within: days };
      onConfigChange?.(newConfig);
      return newConfig;
    });
  };

  const handleUpdateCountingBy = (countingBy: 'unique_users' | 'sessions' | 'events') => {
    setConfig(prev => {
      const newConfig = { ...prev, counting_by: countingBy };
      onConfigChange?.(newConfig);
      return newConfig;
    });
  };

  // Legacy support
  const handleUpdateMeasure = (measure: 'guests' | 'revenue' | 'intent') => {
    const countingMap: Record<string, 'unique_users' | 'sessions' | 'events'> = {
      'guests': 'unique_users',
      'revenue': 'sessions',
      'intent': 'unique_users'
    };
    setConfig(prev => ({ ...prev, counting_by: countingMap[measure] || 'unique_users' }));
  };

  const handleUpdateWindow = (window: '1hr' | '24hr' | '7 Days' | '30 Days') => {
    const daysMap: Record<string, number> = {
      '1hr': 0,
      '24hr': 1,
      '7 Days': 7,
      '30 Days': 30
    };
    setConfig(prev => ({ ...prev, completed_within: daysMap[window] || 1 }));
  };

  const handleUpdateGroupBy = (group_by: 'device_type' | 'guest_segment' | 'traffic_source' | null) => {
    setConfig(prev => {
      const newConfig = { ...prev, group_by };
      onConfigChange?.(newConfig);
      return newConfig;
    });
  };

  // Segment Comparison Handlers
  const handleAddSegment = () => {
    const newSegment: SegmentComparison = {
      id: Date.now().toString(),
      name: `Segment ${(config.segments?.length || 0) + 1}`,
      filters: []
    };
    setConfig(prev => {
      const newConfig = {
        ...prev,
        segments: [...(prev.segments || []), newSegment]
      };
      onConfigChange?.(newConfig);
      return newConfig;
    });
    // Auto-open editing mode for the new segment
    setTimeout(() => setEditingSegmentId(newSegment.id), 100);
  };

  const handleRemoveSegment = (segmentId: string) => {
    setConfig(prev => {
      const newConfig = {
        ...prev,
        segments: (prev.segments || []).filter(s => s.id !== segmentId)
      };
      onConfigChange?.(newConfig);
      return newConfig;
    });
    if (editingSegmentId === segmentId) {
      setEditingSegmentId(null);
    }
  };

  const handleUpdateSegmentName = (segmentId: string, name: string) => {
    setConfig(prev => ({
      ...prev,
      segments: (prev.segments || []).map(s =>
        s.id === segmentId ? { ...s, name } : s
      )
    }));
  };

  const handleAddSegmentFilter = (segmentId: string, filter: EventFilter) => {
    setConfig(prev => ({
      ...prev,
      segments: (prev.segments || []).map(s =>
        s.id === segmentId ? { ...s, filters: [...s.filters, filter] } : s
      )
    }));
  };

  const handleRemoveSegmentFilter = (segmentId: string, filterIndex: number) => {
    setConfig(prev => ({
      ...prev,
      segments: (prev.segments || []).map(s =>
        s.id === segmentId 
          ? { ...s, filters: s.filters.filter((_, idx) => idx !== filterIndex) }
          : s
      )
    }));
  };



  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload as FunnelStep;
      const friction = frictionData[d.id] || [];
      return (
        <div className="bg-slate-900 text-white p-4 rounded-lg shadow-xl border border-slate-700 text-sm max-w-[280px]">
          <p className="font-bold mb-2 text-base">{d.name}</p>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
             <span className="text-slate-400">Visitors:</span>
              <span className="font-mono font-semibold">{d.visitors.toLocaleString()}</span>
          </div>
            <div className="flex justify-between items-center text-red-400">
             <span>Drop-off:</span>
              <span className="font-mono font-semibold">{d.dropOffRate}%</span>
          </div>
            {d.revenueAtRisk > 0 && (
              <div className="flex justify-between items-center text-orange-300 border-t border-slate-700 pt-1.5 mt-1.5">
                <span>Revenue at Risk:</span>
                <span className="font-mono font-semibold text-red-600">${(d.revenueAtRisk / 1000).toFixed(1)}k</span>
              </div>
            )}
            {friction.length > 0 && (
              <div className="border-t border-slate-700 pt-1.5 mt-1.5">
                <p className="text-xs text-slate-400 mb-1">Top Friction:</p>
                <p className="text-xs text-red-300">{friction[0].element} ({friction[0].failure_rate}% failure)</p>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const totalConversion = data.length > 0 
    ? ((data[data.length - 1].visitors / data[0].visitors) * 100).toFixed(1) 
    : '0';
  const totalDropped = data.length > 0 
    ? (data[0].visitors - data[data.length - 1].visitors).toLocaleString() 
    : '0';
  const totalRevenueAtRisk = data.reduce((acc, curr) => acc + curr.revenueAtRisk, 0);

  return (
    <div className="flex h-full bg-slate-50">
      
      {/* Left Sidebar: The Builder */}
      <div className="w-96 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-full overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Funnel Builder</h2>
          <p className="text-xs text-slate-500">Configure your conversion funnel</p>
        </div>

        {/* Global Filters */}
        {/* Step List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-slate-800">Funnel Steps</h3>
                    <span className="text-xs text-slate-400">{config.steps.length} Steps</span>
                </div>
                
                <div className="space-y-2">
                    {config.steps.map((step, idx) => (
              <div 
                key={step.id} 
                className="group relative bg-white border border-slate-200 rounded-lg p-3 hover:border-brand-400 hover:shadow-md transition-all"
                onMouseEnter={() => setHoveredStep(step.id)}
                onMouseLeave={() => setHoveredStep(null)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    <GripVertical size={14} className="text-slate-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400 w-4">{idx + 1}</span>
                        {editingStepId === step.id ? (
                          <input
                            type="text"
                            value={step.label || step.event_type}
                            onChange={(e) => handleUpdateStepLabel(step.id, e.target.value)}
                            className="flex-1 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-0.5"
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium text-sm text-slate-700">{step.label || step.event_type}</span>
                        )}
                        {step.event_category === 'hospitality' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">H</span>
                        )}
                        {step.event_category === 'generic' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded">G</span>
                        )}
                      </div>
                      <button 
                        onClick={() => handleRemoveStep(step.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"
                      >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                    
                    {/* Step Filters */}
                    {step.filters && step.filters.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <div className="flex flex-wrap gap-1">
                          {step.filters.map((filter, filterIdx) => (
                            <span
                              key={filterIdx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600"
                            >
                              {filter.property} {filter.operator} {String(filter.value)}
                              {editingStepId === step.id && (
                                <button
                                  onClick={() => handleRemoveFilter(step.id, filterIdx)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                                    </div>
                                )}
                    
                    {/* Filter Builder (when editing) */}
                    {editingStepId === step.id && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                        <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Add Filter</div>
                        <FilterBuilder
                          step={step}
                          eventSchema={eventSchema}
                          onAddFilter={(filter) => handleAddFilter(step.id, filter)}
                        />
                        <button
                          onClick={() => setEditingStepId(null)}
                          className="w-full text-xs px-3 py-1.5 bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors"
                        >
                          Done
                        </button>
                            </div>
                    )}
                    
                    {/* Friction Warning */}
                    {frictionData[step.id] && frictionData[step.id].length > 0 && hoveredStep === step.id && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1 text-[10px] text-red-600">
                          <AlertTriangle size={10} />
                          <span>{frictionData[step.id][0].failure_rate}% failure on {frictionData[step.id][0].element}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {editingStepId !== step.id && (
                  <button
                    onClick={() => setEditingStepId(step.id)}
                    className="absolute top-2 right-8 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600"
                  >
                    <Settings size={12} />
                  </button>
                )}
                        </div>
                    ))}
            
                    <button 
              onClick={() => setShowAddStepModal(true)}
              className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:text-brand-600 hover:border-brand-400 flex items-center justify-center gap-2 transition-all"
                    >
              <Plus size={16} /> Add Step
                    </button>
                </div>

          {/* Segment Comparison Section */}
          <div className="pt-4 border-t border-slate-200 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Segment Comparison</h3>
              {config.segments && config.segments.length > 0 && (
                <button
                  onClick={() => setConfig(prev => ({ ...prev, segments: [] }))}
                  className="text-[10px] text-red-500 hover:text-red-700 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="text-[10px] text-slate-500 mb-3 p-2 bg-slate-50 rounded border border-slate-200">
              Each segment = one filter. Compare "Mobile Users" vs "Desktop Users" vs "Families"
                        </div>
            
            {/* Segment List */}
            {config.segments && config.segments.length > 0 && (
              <div className="space-y-2 mb-2">
                {config.segments.map((segment, idx) => (
                  <div key={segment.id} className="p-2 bg-white border border-slate-200 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <input
                        type="text"
                        value={segment.name}
                        onChange={(e) => handleUpdateSegmentName(segment.id, e.target.value)}
                        className="text-xs font-medium text-slate-700 bg-transparent border-none focus:outline-none flex-1"
                        placeholder="Segment name"
                      />
                      <button
                        onClick={() => handleRemoveSegment(segment.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X size={12} />
                      </button>
                     </div>
                    
                    {/* Segment Filter - Only ONE filter per segment */}
                    {segment.filters && segment.filters.length > 0 ? (
                      <div className="flex items-center justify-between p-2 bg-brand-50 border border-brand-200 rounded">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-brand-700">{segment.filters[0].property}</span>
                          <span className="text-brand-500">=</span>
                          <span className="font-mono text-brand-700">{String(segment.filters[0].value)}</span>
                </div>
                        <button
                          onClick={() => handleRemoveSegmentFilter(segment.id, 0)}
                          className="text-brand-500 hover:text-brand-700"
                          title="Remove filter"
                        >
                          <X size={12} />
                        </button>
            </div>
                    ) : (
                      /* No filter yet - show filter builder */
                      editingSegmentId === segment.id ? (
                        <div className="mt-1">
                          <SegmentFilterBuilder
                            segmentValues={segmentValues}
                            isLoading={isLoadingSegmentValues}
                            onAddFilter={(filter) => {
                              handleAddSegmentFilter(segment.id, filter);
                              setEditingSegmentId(null); // Auto-close after adding
                            }}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingSegmentId(segment.id)}
                          className="w-full text-[10px] px-2 py-1 bg-brand-50 text-brand-600 rounded hover:bg-brand-100 flex items-center justify-center gap-1 font-medium"
                          disabled={isLoadingSegmentValues}
                        >
                          <Plus size={10} /> {isLoadingSegmentValues ? 'Loading...' : 'Set Filter'}
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Add Segment Button */}
            <button
              onClick={handleAddSegment}
              className="w-full py-2 border-2 border-dashed border-brand-400 rounded-lg text-xs text-brand-600 hover:text-brand-700 hover:border-brand-500 flex items-center justify-center gap-1 transition-all"
            >
              <Plus size={14} /> Add Segment
            </button>
                     </div>

          {/* Measured As - Amplitude Style */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Measured As</h3>
            <div className="space-y-1.5 mb-4">
              {([
                { id: 'conversion', label: 'Conversion', icon: TrendingUp },
                { id: 'overTime', label: 'Over Time', icon: Clock },
                { id: 'timeToConvert', label: 'Time to Convert', icon: Clock },
                { id: 'frequency', label: 'Frequency', icon: Users },
                { id: 'improvement', label: 'Improvement', icon: TrendingUp },
                { id: 'significance', label: 'Significance', icon: Target },
              ] as const).map((view) => {
                const Icon = view.icon;
                return (
                  <button
                    key={view.id}
                    onClick={() => handleUpdateViewType(view.id as any)}
                    className={`w-full text-left px-3 py-2 text-sm rounded border transition-colors flex items-center gap-2 ${
                      config.view_type === view.id
                        ? 'bg-brand-50 border-brand-200 text-brand-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={14} />
                    {view.label}
                  </button>
                );
              })}
            </div>

            {/* Completed Within */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                Completed within
              </label>
                    <select 
                value={config.completed_within}
                onChange={(e) => handleUpdateCompletedWithin(Number(e.target.value))}
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:border-brand-500"
              >
                <option value={0}>Same session</option>
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                    </select>
                </div>

            {/* Counting By */}
                <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                Counting by
              </label>
                        <select 
                value={config.counting_by}
                onChange={(e) => handleUpdateCountingBy(e.target.value as any)}
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:border-brand-500"
                        >
                <option value="unique_users">Unique User(s)</option>
                <option value="sessions">Session(s)</option>
                <option value="events">Event(s)</option>
                        </select>
                </div>
             </div>
        </div>
      </div>

      {/* Center: The Canvas */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        
        {/* Toolbar */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800">Funnel Analysis</h2>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-brand-500"></div>
                Loading...
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
                <button 
              onClick={() => {
                // Export to CSV
                const csv = [
                  ['Step', 'Visitors', 'Conversion Rate', 'Drop Off Rate', 'Revenue at Risk'].join(','),
                  ...data.map(step => [
                    step.name,
                    step.visitors,
                    `${step.conversionRate}%`,
                    `${step.dropOffRate}%`,
                    `$${step.revenueAtRisk.toFixed(2)}`
                  ].join(','))
                ].join('\n');
                
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `funnel-export-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-100 transition-all"
              title="Export to CSV"
            >
              <Download size={16} />
              Export
                </button>
            
                <button 
              onClick={() => {
                // Save funnel configuration
                const saved = localStorage.getItem('savedFunnels') || '[]';
                const funnels = JSON.parse(saved);
                funnels.push({
                  id: Date.now().toString(),
                  name: `Funnel ${funnels.length + 1}`,
                  config,
                  createdAt: new Date().toISOString()
                });
                localStorage.setItem('savedFunnels', JSON.stringify(funnels));
                alert('Funnel saved!');
              }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-100 transition-all"
              title="Save Funnel"
            >
              <Save size={16} />
              Save
                </button>
            
            <button 
              onClick={() => onExplain('Funnel Explorer Analysis', {
                // Funnel configuration
                config: {
                  steps: config.steps.map(s => ({
                    label: s.label,
                    event_type: s.event_type,
                    filters: s.filters
                  })),
                  completed_within: config.completed_within,
                  global_filters: config.global_filters,
                  group_by: config.group_by
                },
                // Conversion data with actual numbers
                funnel_conversion: data.map((step, idx) => {
                  const prevVisitors = idx > 0 ? data[idx - 1].visitors : step.visitors;
                  return {
                    step_name: step.name,
                    step_index: idx + 1,
                    visitors: step.visitors,
                    conversion_rate: prevVisitors > 0 ? ((step.visitors / prevVisitors) * 100) : 100,
                    drop_off_count: idx > 0 ? Math.max(0, prevVisitors - step.visitors) : 0,
                    drop_off_rate: idx > 0 ? Math.max(0, ((prevVisitors - step.visitors) / prevVisitors) * 100) : 0
                  };
                }),
                // Additional analytics
                friction_data: frictionData,
                over_time_data: overTimeData,
                path_analysis: pathAnalysisData,
                latency_data: latencyData,
                abnormal_dropoffs: abnormalDropoffsData,
                price_sensitivity: priceSensitivityData,
                cohort_analysis: cohortAnalysisData,
                executive_summary: executiveSummary,
                // Summary metrics
                summary: {
                  total_visitors: data[0]?.visitors || 0,
                  final_conversions: data[data.length - 1]?.visitors || 0,
                  overall_conversion_rate: data[0]?.visitors > 0 
                    ? ((data[data.length - 1]?.visitors / data[0]?.visitors) * 100).toFixed(1)
                    : 0,
                  total_dropped: data[0]?.visitors - (data[data.length - 1]?.visitors || 0)
                }
              })}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-sm font-medium hover:bg-indigo-100 hover:border-indigo-200 transition-all"
            >
              <Sparkles size={16} />
              AI Insights
            </button>
          </div>
        </div>

            {/* Summary Metrics */}
        <div className="p-6 pb-4">
          {config.segments && config.segments.length > 0 && data.length > 0 && data[0].segments ? (
            /* Per-Segment Metrics (Amplitude-style) */
            <div className="grid grid-cols-1 gap-3">
              <div className="text-sm font-semibold text-slate-700 mb-1">Conversion Rates by Segment</div>
              {config.segments.map((segment, idx) => {
                // Calculate conversion rate for this segment
                const firstStep = data[0];
                const lastStep = data[data.length - 1];
                const firstStepCount = firstStep.segments?.[segment.name] || 0;
                const lastStepCount = lastStep.segments?.[segment.name] || 0;
                const segmentConversion = firstStepCount > 0 ? ((lastStepCount / firstStepCount) * 100).toFixed(1) : '0.0';
                const segmentColor = `hsl(${idx * (360 / config.segments.length)}, 70%, 50%)`;
                
                return (
                  <div key={segment.id} className="bg-white p-4 rounded-xl border-2 shadow-sm" style={{ borderColor: segmentColor }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: segmentColor }}></div>
                        <div>
                          <div className="text-slate-700 text-sm font-medium">{segment.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {segment.filters.length > 0 ? (
                              <>{segment.filters[0].property} = {String(segment.filters[0].value)}</>
                            ) : (
                              'No filter set'
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-slate-800">{segmentConversion}%</div>
                        <div className="text-xs text-slate-500 mt-1">Conversion Rate</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                      <div>
                        <div className="text-xs text-slate-500">Started</div>
                        <div className="text-sm font-semibold text-slate-700">{firstStepCount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Completed</div>
                        <div className="text-sm font-semibold text-green-600">{lastStepCount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Dropped</div>
                        <div className="text-sm font-semibold text-red-600">{(firstStepCount - lastStepCount).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Aggregate Metrics (when no segments) */
            <div className="grid grid-cols-4 gap-4">
                {/* Total Conversion */}
                <KPICardWithAIButton
                  label="Total Conversion"
                  value={`${totalConversion}%`}
                  subtitle="+2.4% vs last"
                  change={2.4}
                  changeType="increase"
                  icon={<Target size={20} />}
                  color="#10b981"
                  metricData={{
                    current: parseFloat(totalConversion) || 0,
                    previous: parseFloat(totalConversion) - 2.4 || 0,
                    trend: 'up',
                    context: 'Funnel Total Conversion',
                  }}
                  dataLoaded={!isLoading && data.length > 0}
                />
                
                {/* Dropped Off */}
                <KPICardWithAIButton
                  label="Dropped Off"
                  value={totalDropped.toLocaleString()}
                  subtitle="Guests lost"
                  icon={<TrendingDown size={20} />}
                  color="#ef4444"
                  metricData={{
                    current: parseInt(totalDropped.replace(/,/g, '')) || 0,
                    trend: 'down',
                    context: 'Funnel Dropped Off',
                  }}
                  dataLoaded={!isLoading && data.length > 0}
                />
                
                {/* Revenue at Risk */}
                <KPICardWithAIButton
                  label="Revenue at Risk"
                  value={`$${(totalRevenueAtRisk / 1000).toFixed(1)}k`}
                  subtitle="High Alert"
                  icon={<DollarSign size={20} />}
                  color="#f59e0b"
                  badge={totalRevenueAtRisk > 10000 ? 'High Alert' : undefined}
                  metricData={{
                    current: totalRevenueAtRisk,
                    trend: totalRevenueAtRisk > 10000 ? 'up' : 'stable',
                    context: 'Funnel Revenue at Risk',
                  }}
                  dataLoaded={!isLoading && data.length > 0}
                />
                
                {/* Avg Time to Convert */}
                <KPICardWithAIButton
                  label="Avg Time to Convert"
                  value={(() => {
                    const lastStep = latencyData[latencyData.length - 1];
                    const totalSeconds = lastStep?.best_time_seconds || lastStep?.median_time_seconds || lastStep?.p95_seconds || 0;
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = Math.floor(totalSeconds % 60);
                    return totalSeconds > 0 ? `${minutes}m ${seconds}s` : '--';
                  })()}
                  subtitle="Median duration"
                  icon={<Clock size={20} />}
                  color="#3b82f6"
                  metricData={{
                    current: (() => {
                      const lastStep = latencyData[latencyData.length - 1];
                      return lastStep?.best_time_seconds || lastStep?.median_time_seconds || lastStep?.p95_seconds || 0;
                    })(),
                    trend: 'stable',
                    context: 'Funnel Avg Time to Convert',
                  }}
                  dataLoaded={!isLoading && data.length > 0}
                />
            </div>
          )}
            </div>

        {/* Main Chart */}
        <div className="flex-1 p-6 pt-0 overflow-y-auto">
          {/* Segment Comparison Banner */}
          {config.segments && config.segments.length > 0 && (
            <div className="mb-4 p-3 bg-gradient-to-r from-brand-50 to-blue-50 border-l-4 border-brand-500 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-brand-700">
                    Comparing {config.segments.length} Segment{config.segments.length > 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={() => setConfig(prev => ({ ...prev, segments: [] }))}
                  className="text-xs px-2 py-1 bg-white border border-brand-400 rounded text-brand-700 hover:bg-brand-50 font-medium transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {config.segments.map((segment, idx) => (
                  <div key={segment.id} className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-brand-200 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${idx * 60}, 70%, 50%)` }}></div>
                    <span className="font-medium text-brand-700">{segment.name}</span>
                    {segment.filters.length > 0 && (
                      <span className="text-brand-500">({segment.filters[0].property} = {String(segment.filters[0].value)})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-h-[500px]">
                {activeTab === 'conversion' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-6 pt-4">
                  <h3 className="text-lg font-semibold text-slate-800">Funnel Conversion</h3>
                  <div className="flex items-center gap-3">
                    <DateFilter value={dateRange} onChange={setDateRange} />
                    <ChartTypeSelector
                      value={conversionChartType}
                      onChange={setConversionChartType}
                      availableTypes={['bar']}
                    />
                  </div>
                </div>
                <div className="h-[700px] w-full">
                {/* Check if we have segments for comparison */}
                {(() => {
                  // Empty funnel: prompt to add steps
                  if (config.steps.length === 0) {
                    return (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-slate-500 max-w-md">
                          <Plus size={48} className="mx-auto mb-4 opacity-40 text-slate-300" />
                          <p className="text-lg font-medium text-slate-700 mb-2">No funnel steps yet</p>
                          <p className="text-sm text-slate-500 mb-4">
                            Add steps from the left sidebar to build your conversion funnel.
                            Choose hospitality events (Landed, Payment, etc.) or generic events from your database.
                          </p>
                          <button
                            onClick={() => setShowAddStepModal(true)}
                            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors text-sm font-medium"
                          >
                            Add Step
                          </button>
                        </div>
                      </div>
                    );
                  }
                  
                  const hasSegments = config.segments && config.segments.length > 0;
                  
                  // Transform data for segment comparison
                  if (hasSegments) {
                    // Extract segment names
                    const segmentNames = config.segments!.map(s => s.name);
                    
                    // Check if we have any segment data
                    const hasSegmentData = data.some(step => step.segments && Object.keys(step.segments).length > 0);
                    
                    if (!hasSegmentData) {
                      // Show empty state
                      return (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center text-slate-400 max-w-md">
                            <AlertTriangle size={48} className="mx-auto mb-4 opacity-50 text-amber-500" />
                            <p className="text-lg font-medium text-slate-700 mb-2">No Data for Selected Segments</p>
                            <p className="text-sm text-slate-500 mb-4">
                              The segments you've created don't have enough data in the database. 
                              Try adjusting your segment filters or selecting different properties.
                            </p>
                            <div className="text-xs text-slate-400 bg-slate-50 rounded p-3 border border-slate-200">
                              <div className="font-medium mb-1">Active Segments:</div>
                              {config.segments!.map((seg, idx) => (
                                <div key={seg.id} className="text-left">
                                  • {seg.name}: {seg.filters.map(f => `${f.property}=${f.value}`).join(', ')}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // Transform data to show each segment as a grouped bar
                    const segmentChartData = data.map((step, idx) => {
                      const chartEntry: any = { name: step.name };
                      
                      // For each segment, calculate conversion rate
                      if (step.segments) {
                        segmentNames.forEach((segmentName) => {
                          const segmentCount = step.segments[segmentName] || 0;
                          // Get total for this segment at previous step (for conversion rate)
                          const prevStep = idx > 0 ? data[idx - 1] : null;
                          const prevSegmentCount = prevStep?.segments?.[segmentName] || segmentCount;
                          
                          const conversionRate = prevSegmentCount > 0 ? (segmentCount / prevSegmentCount * 100) : 100;
                          chartEntry[segmentName] = Math.round(conversionRate * 10) / 10;
                        });
                      }
                      
                      return chartEntry;
                    });
                    
                    // Generate colors for each segment
                    const segmentColors = segmentNames.map((_, idx) => {
                      const hue = idx * (360 / segmentNames.length);
                      return `hsl(${hue}, 70%, 50%)`;
                    });
                    
                    return (
                      <>
                         {/* AI Insights temporarily disabled */}
                         {/* <ChartWithInsights
                          chartData={segmentChartData}
                          chartType="bar"
                          xAxisKey="name"
                          insightsEnabled={true}
                        > */}
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                            data={segmentChartData}
                            margin={{ top: 30, right: 40, left: 70, bottom: 100 }}
                            barCategoryGap="15%"
                            barGap={4}
                            >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis 
                              dataKey="name"
                              tick={(props) => {
                                const { x, y, payload } = props;
                                const words = payload.value.split(' ');
                                return (
                                  <g transform={`translate(${x},${y})`}>
                                    {words.map((word: string, i: number) => (
                                      <text
                                        key={i}
                                        x={0}
                                        y={i * 16}
                                        dy={12}
                                        textAnchor="middle"
                                        fill="#475569"
                                        fontSize={12}
                                        fontWeight={500}
                                      >
                                        {word}
                                      </text>
                                    ))}
                                  </g>
                                );
                              }}
                              height={100}
                              interval={0}
                            />
                            <YAxis 
                              domain={[0, 100]}
                              tick={{fontSize: 12, fill: '#475569'}}
                              tickFormatter={(value) => `${value}%`}
                              label={{ value: 'Conversion Rate (%)', angle: -90, position: 'insideLeft', style: { fontSize: 13, fill: '#475569', fontWeight: 500 } }}
                            />
                            <Tooltip 
                              cursor={{fill: 'rgba(148, 163, 184, 0.1)'}}
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length > 0) {
                                  return (
                                    <div className="bg-white border-2 border-brand-500 rounded-lg shadow-xl p-4">
                                      <p className="font-semibold text-slate-800 mb-3">{label}</p>
                                      <div className="space-y-2">
                                        {payload.map((entry, idx) => (
                                          <div key={idx} className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                              <div className="w-4 h-4 rounded" style={{ backgroundColor: entry.color }}></div>
                                              <span className="text-slate-700 font-medium text-sm">{entry.name}</span>
                                            </div>
                                            <span className="font-semibold text-brand-700">{entry.value}%</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            {segmentNames.map((segmentName, idx) => (
                              <Bar
                                key={segmentName}
                                dataKey={segmentName}
                                fill={segmentColors[idx]}
                                radius={[4, 4, 0, 0]}
                                maxBarSize={60}
                                animationDuration={800}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                        {/* </ChartWithInsights> */}
                        
                        {/* Segment Legend */}
                        <div className="flex items-center justify-center gap-4 flex-wrap -mt-8 mb-6 text-sm">
                          {segmentNames.map((segmentName, idx) => (
                            <div key={segmentName} className="flex items-center gap-2">
                              <div className="w-6 h-4 rounded border-2" style={{ 
                                backgroundColor: segmentColors[idx],
                                borderColor: segmentColors[idx]
                              }}></div>
                              <span className="text-slate-700 font-medium">{segmentName}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  }
                  
                  // No data for selected date range: don't show chart
                  const hasNoData = data.length === 0 || data.every(s => (s.visitors ?? 0) === 0);
                  if (hasNoData) {
                    return (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-slate-500 max-w-md">
                          <Calendar size={48} className="mx-auto mb-4 opacity-40 text-slate-300" />
                          <p className="text-lg font-medium text-slate-700 mb-2">No data for selected date range</p>
                          <p className="text-sm text-slate-500">
                            There are no events in the database for the chosen dates. Try a different date range.
                          </p>
                        </div>
                      </div>
                    );
                  }
                  
                  // Default single-funnel view (no segments)
                  return (
                    <>
                      {/* AI Insights temporarily disabled */}
                      {/* <ChartWithInsights
                        chartData={data.map(step => ({
                          name: step.name,
                          value: step.conversionRate,
                          visitors: step.visitors,
                        }))}
                        chartType="bar"
                        xAxisKey="name"
                        insightsEnabled={true}
                      > */}
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                          data={data.map((step, idx) => {
                            // Ensure conversionRate + dropOffRate = 100 for proper stacking
                            const convRate = step.conversionRate || 0;
                            const dropRate = idx === 0 ? 0 : (100 - convRate);
                            return {
                              ...step,
                              conversionRate: convRate,
                              dropOffRate: dropRate
                            };
                          })}
                          margin={{ top: 30, right: 40, left: 70, bottom: 100 }}
                          barCategoryGap="30%"
                        >
                                <defs>
                                  {/* Diagonal stripe pattern for drop-offs */}
                                  <pattern id="diagonalStripes" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                                    <line x1="0" y1="0" x2="0" y2="8" stroke="#93c5fd" strokeWidth="4" />
                                  </pattern>
                                  <pattern id="diagonalStripesGreen" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                                    <line x1="0" y1="0" x2="0" y2="8" stroke="#86efac" strokeWidth="4" />
                                  </pattern>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis 
                      dataKey="name"
                      tick={(props) => {
                        const { x, y, payload } = props;
                        const words = payload.value.split(' ');
                        return (
                          <g transform={`translate(${x},${y})`}>
                            {words.map((word: string, i: number) => (
                              <text
                                key={i}
                                x={0}
                                y={i * 16}
                                dy={12}
                                textAnchor="middle"
                                fill="#475569"
                                fontSize={12}
                                fontWeight={500}
                              >
                                {word}
                              </text>
                            ))}
                          </g>
                        );
                      }}
                      height={100}
                      interval={0}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      tick={{fontSize: 12, fill: '#475569'}}
                      tickFormatter={(value) => `${value}%`}
                      label={{ value: 'Users (%)', angle: -90, position: 'insideLeft', style: { fontSize: 13, fill: '#475569', fontWeight: 500 } }}
                    />
                                <Tooltip 
                      cursor={{fill: 'transparent'}} 
                      shared={false}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length > 0) {
                          // Get the hovered bar segment
                          const hoveredSegment = payload.find(p => p.value && p.value > 0);
                          if (!hoveredSegment) return null;
                          
                          const stepData = hoveredSegment.payload;
                          const dataKey = hoveredSegment.dataKey;
                          
                          // Find the actual step index in original data
                          const stepIndex = data.findIndex(d => d.id === stepData.id);
                          if (stepIndex === -1) return null;
                          
                          const actualStep = data[stepIndex];
                          
                          // Check which segment is hovered
                          if (dataKey === 'conversionRate') {
                            // For first step, all visitors converted to this step
                            // For other steps, calculate based on step's visitors
                            const convertedVisitors = actualStep.visitors;
                            
                            return (
                              <div className="bg-white border-2 border-blue-600 rounded-lg shadow-xl p-4">
                                <p className="font-semibold text-slate-800 mb-3">{actualStep.name}</p>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-blue-600 rounded border-2 border-blue-800"></div>
                                    <span className="text-slate-700 font-medium">Reached This Step</span>
                                  </div>
                                  <div className="ml-6 space-y-1 text-sm">
                                    <div className="flex justify-between gap-4">
                                      <span className="text-slate-600">Conversion Rate:</span>
                                      <span className="font-semibold text-blue-700">{actualStep.conversionRate.toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-slate-600">Visitors:</span>
                                      <span className="font-semibold text-blue-700">{convertedVisitors.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          } else if (dataKey === 'dropOffRate') {
                            // Calculate dropped visitors from previous step
                            let droppedVisitors = 0;
                            let dropRate = 0;
                            
                            if (stepIndex > 0) {
                              const previousStepVisitors = data[stepIndex - 1].visitors;
                              const currentStepVisitors = actualStep.visitors;
                              droppedVisitors = previousStepVisitors - currentStepVisitors;
                              dropRate = ((droppedVisitors / previousStepVisitors) * 100);
                            }
                            
                            return (
                              <div className="bg-white border-2 border-red-400 rounded-lg shadow-xl p-4">
                                <p className="font-semibold text-slate-800 mb-3">{actualStep.name}</p>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-red-200 rounded border-2 border-red-400"></div>
                                    <span className="text-slate-700 font-medium">Dropped Off</span>
                                  </div>
                                  <div className="ml-6 space-y-1 text-sm">
                                    <div className="flex justify-between gap-4">
                                      <span className="text-slate-600">Drop-off Rate:</span>
                                      <span className="font-semibold text-red-600">{dropRate.toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-slate-600">Dropped Visitors:</span>
                                      <span className="font-semibold text-red-600">{droppedVisitors.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        }
                        return null;
                      }}
                    />
                    {/* Converted portion - solid blue */}
                    <Bar 
                      dataKey="conversionRate" 
                      stackId="a" 
                      radius={[0, 0, 0, 0]} 
                      maxBarSize={90} 
                      animationDuration={800}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                    >
                                    {data.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={index === data.length - 1 ? '#10b981' : '#2563eb'}
                          stroke={index === data.length - 1 ? '#10b981' : '#2563eb'}
                          strokeWidth={1.5}
                        />
                                    ))}
                                </Bar>
                    {/* Drop-off portion - striped light blue */}
                    <Bar 
                      dataKey="dropOffRate" 
                      stackId="a" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={90} 
                      animationDuration={800}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                    >
                                    {data.map((entry, index) => (
                        <Cell 
                          key={`cell-drop-${index}`} 
                          fill={index === data.length - 1 ? 'url(#diagonalStripesGreen)' : 'url(#diagonalStripes)'}
                          stroke={index === data.length - 1 ? '#10b981' : '#2563eb'}
                          strokeWidth={1.5}
                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        {/* </ChartWithInsights> */}
                        
                        {/* Legend */}
                        <div className="flex items-center justify-center gap-6 -mt-8 mb-6 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-4 bg-blue-600 border-2 border-blue-600 rounded"></div>
                            <span className="text-slate-700 font-medium">Converted</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-4 bg-blue-200 border-2 border-blue-300 rounded" style={{
                              backgroundImage: 'repeating-linear-gradient(45deg, #93c5fd 0, #93c5fd 2px, #dbeafe 2px, #dbeafe 4px)'
                            }}></div>
                            <span className="text-slate-700 font-medium">Dropped Off</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                    </div>
                </div>
                )}

                 {activeTab === 'overTime' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-6 pt-4">
                  <h3 className="text-lg font-semibold text-slate-800">Funnel Performance Over Time</h3>
                  <div className="flex items-center gap-3">
                    <DateFilter value={dateRange} onChange={setDateRange} />
                    <ChartTypeSelector
                      value={overTimeChartType}
                      onChange={setOverTimeChartType}
                      availableTypes={['area', 'line', 'bar', 'composed']}
                    />
                  </div>
                </div>
                <div className="h-[500px] w-full px-6">
                  {overTimeData.length > 0 ? (
                    <ChartRenderer
                      data={overTimeData}
                      chartType={overTimeChartType}
                      dataKeys={config.steps.map(step => step.label || step.event_type || `step_${config.steps.indexOf(step) + 1}`)}
                      xAxisKey="date"
                      colors={config.steps.map((step, idx) => idx === config.steps.length - 1 ? '#10b981' : '#3b82f6')}
                      height={500}
                      stacked={overTimeChartType === 'area'}
                      xAxisLabel="Date"
                      yAxisLabel="Users"
                      tooltipFormatter={(value: number, name: string) => [
                        value.toLocaleString(),
                        name
                      ]}
                    />
                  ) : isLoading ? (
                    <div className="h-full flex items-center justify-center text-slate-400">
                      <div className="text-center">
                        <Clock size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Loading time-series data...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500">
                      <div className="text-center max-w-md">
                        <Calendar size={48} className="mx-auto mb-4 opacity-40 text-slate-300" />
                        <p className="text-lg font-medium text-slate-700 mb-2">No data for selected date range</p>
                        <p className="text-sm text-slate-500">There are no events for the chosen dates. Try a different date range.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

                {activeTab === 'timeToConvert' && (
              <div className="h-[600px] min-h-0 overflow-y-auto p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Time to Convert</h3>
                  <p className="text-sm text-slate-500">How long it takes users to reach each step from session start</p>
                </div>

                {latencyData.length > 0 && latencyData.some(s => s.median_time_seconds > 0) ? (
                  <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="text-xs text-slate-500 uppercase font-medium mb-1">Median Time to Complete</div>
                        <div className="text-2xl font-bold text-slate-800">
                          {(() => {
                            const lastStep = latencyData[latencyData.length - 1];
                            const totalSeconds = lastStep?.best_time_seconds || lastStep?.median_time_seconds || lastStep?.p95_seconds || 0;
                            const minutes = Math.floor(totalSeconds / 60);
                            const seconds = Math.floor(totalSeconds % 60);
                            return totalSeconds > 0 ? `${minutes}m ${seconds}s` : '--';
                          })()}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="text-xs text-slate-500 uppercase font-medium mb-1">P95 Time to Complete</div>
                        <div className="text-2xl font-bold text-slate-800">
                          {(() => {
                            const lastStep = latencyData[latencyData.length - 1];
                            const totalSeconds = lastStep?.p95_seconds || 0;
                            const minutes = Math.floor(totalSeconds / 60);
                            const seconds = Math.floor(totalSeconds % 60);
                            return `${minutes}m ${seconds}s`;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Cumulative Time Breakdown */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Cumulative Time to Reach Each Step</h4>
                      {latencyData.map((step, idx) => {
                        const bestTime = step.best_time_seconds || step.median_time_seconds || step.p95_seconds || 0;
                        const minutes = Math.floor(bestTime / 60);
                        const seconds = Math.floor(bestTime % 60);
                        const p95Minutes = Math.floor((step.p95_seconds || 0) / 60);
                        const p95Seconds = Math.floor((step.p95_seconds || 0) % 60);
                        
                        return (
                          <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium text-slate-700">{step.step_name}</div>
                                {step.is_bottleneck && (
                                  <div className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs font-medium">
                                    <AlertTriangle size={12} />
                                    Slow
                                  </div>
                                )}
                              </div>
                              <div className="text-lg font-mono font-bold text-slate-800">
                                {minutes}m {seconds}s
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>From session start</span>
                              <span>P95: {p95Minutes}m {p95Seconds}s</span>
                            </div>
                            {step.sample_size > 0 && (
                              <div className="mt-2 text-xs text-slate-400">
                                Based on {step.sample_size.toLocaleString()} sessions
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Insights */}
                    {latencyData.some(s => s.is_bottleneck) && (
                      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={16} className="text-amber-600 mt-0.5" />
                          <div>
                            <div className="text-sm font-semibold text-amber-900 mb-1">Bottleneck Detected</div>
                            <div className="text-xs text-amber-700">
                              {latencyData.filter(s => s.is_bottleneck).map(s => s.step_name).join(', ')} taking 
                              longer than 5 minutes. Consider simplifying the UI or reducing required fields.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : isLoading ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <div className="text-center text-slate-400">
                      <Clock size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Calculating time metrics...</p>
                    </div>
                  </div>
                ) : (data.length === 0 || data.every(s => (s.visitors ?? 0) === 0)) ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <div className="text-center text-slate-500 max-w-md">
                      <Calendar size={48} className="mx-auto mb-4 opacity-40 text-slate-300" />
                      <p className="text-lg font-medium text-slate-700 mb-2">No data for selected date range</p>
                      <p className="text-sm text-slate-500">Try a different date range to see time-to-convert metrics.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[400px]">
                    <div className="text-center text-slate-400">
                      <Clock size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Configure funnel to see time data</p>
                    </div>
                  </div>
                )}
            </div>
                )}

            {activeTab === 'pathAnalysis' && (
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Where Users Go After Dropping</h3>
                {pathAnalysisData.length === 0 && !isLoading && (data.length === 0 || data.every(s => (s.visitors ?? 0) === 0)) ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-center text-slate-500 max-w-md">
                      <Calendar size={48} className="mx-auto mb-4 opacity-40 text-slate-300" />
                      <p className="text-lg font-medium text-slate-700 mb-2">No data for selected date range</p>
                      <p className="text-sm text-slate-500">Try a different date range to see path analysis.</p>
                    </div>
                  </div>
                ) : pathAnalysisData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-slate-400">
                    <div className="text-center">
                      <Clock size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Loading path analysis...</p>
                    </div>
                  </div>
                ) : (
                pathAnalysisData.map((analysis, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-slate-700">{analysis.step_name} → {analysis.next_step}</h4>
                      <span className="text-xs text-slate-500">{analysis.total_paths} paths tracked</span>
            </div>
                    {analysis.exit_paths && analysis.exit_paths.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-red-600 uppercase mb-2">Exit Paths</div>
                        <div className="space-y-1">
                          {analysis.exit_paths.slice(0, 3).map((path: any, pidx: number) => (
                            <div key={pidx} className="flex items-center justify-between text-sm text-slate-600 bg-red-50 p-2 rounded">
                              <span>{path.event_type}</span>
                              <span className="font-mono">{path.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysis.retry_paths && analysis.retry_paths.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-blue-600 uppercase mb-2">Retry Paths</div>
                        <div className="space-y-1">
                          {analysis.retry_paths.slice(0, 3).map((path: any, pidx: number) => (
                            <div key={pidx} className="flex items-center justify-between text-sm text-slate-600 bg-blue-50 p-2 rounded">
                              <span>{path.event_type}</span>
                              <span className="font-mono">{path.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysis.navigation_paths && analysis.navigation_paths.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-600 uppercase mb-2">Navigation</div>
                        <div className="space-y-1">
                          {analysis.navigation_paths.slice(0, 5).map((path: any, pidx: number) => (
                            <div key={pidx} className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 p-2 rounded">
                              <span className="truncate">{path.page_url || path.event_type}</span>
                              <span className="font-mono">{path.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
                )}
              </div>
            )}

            {activeTab === 'priceSensitivity' && (
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Price Changes Through Funnel</h3>
                {priceSensitivityData.length === 0 && !isLoading && (data.length === 0 || data.every(s => (s.visitors ?? 0) === 0)) ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-center text-slate-500 max-w-md">
                      <Calendar size={48} className="mx-auto mb-4 opacity-40 text-slate-300" />
                      <p className="text-lg font-medium text-slate-700 mb-2">No data for selected date range</p>
                      <p className="text-sm text-slate-500">Try a different date range to see price sensitivity.</p>
                    </div>
                  </div>
                ) : priceSensitivityData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-slate-400">
                    <div className="text-center">
                      <Clock size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Loading price data...</p>
                    </div>
                  </div>
                ) : (
                priceSensitivityData.map((step, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-slate-700">{step.step_name}</h4>
                      {step.has_price_increase && (
                        <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">Price Increase Alert</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Avg Price</div>
                        <div className="font-semibold text-slate-800">${step.avg_price?.toFixed(2) || '0.00'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Median Price</div>
                        <div className="font-semibold text-slate-800">${step.median_price?.toFixed(2) || '0.00'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Price Change</div>
                        <div className={`font-semibold ${step.price_change_percent > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {step.price_change_percent > 0 ? '+' : ''}{step.price_change_percent?.toFixed(1) || '0.0'}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))
                )}
              </div>
            )}

            {activeTab === 'cohortAnalysis' && (
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Cohort Recovery Analysis</h3>
                {cohortAnalysisData.map((cohort, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-white">
                    <h4 className="font-medium text-slate-700 mb-3">{cohort.step_name}</h4>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Total Dropped</div>
                        <div className="text-lg font-semibold text-slate-800">{cohort.total_dropped?.toLocaleString() || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Recovered</div>
                        <div className="text-lg font-semibold text-green-600">{cohort.recovered?.toLocaleString() || 0}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Recovery Rate</div>
                        <div className="text-lg font-semibold text-blue-600">{cohort.recovery_rate?.toFixed(1) || '0.0'}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Avg Days to Rebook</div>
                        <div className="text-lg font-semibold text-slate-800">{cohort.avg_days_to_rebook?.toFixed(1) || '0.0'} days</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">First-Time Visitors</div>
                          <div className="font-semibold text-slate-800">{cohort.first_time_count?.toLocaleString() || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Returning Guests</div>
                          <div className="font-semibold text-slate-800">{cohort.returning_count?.toLocaleString() || 0}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'executive' && executiveSummary && (
              <div className="p-6 space-y-6">
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-red-800 mb-2">Total Revenue Lost</h3>
                  <div className="text-4xl font-bold text-red-600 mb-1">
                    ${(executiveSummary.total_revenue_lost / 1000).toFixed(1)}k
                  </div>
                  <div className="text-sm text-red-700">Last {executiveSummary.period_days} days • {executiveSummary.location}</div>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold text-slate-800 mb-4">Top 3 Funnel Leaks</h4>
                  <div className="space-y-3">
                    {executiveSummary.top_3_leaks?.map((leak: any, idx: number) => (
                      <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-700">Step {leak.step}</span>
                          <span className="text-sm font-semibold text-red-600">{leak.dropoff_rate?.toFixed(1)}% drop-off</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Reached</div>
                            <div className="font-semibold text-slate-800">{leak.reached?.toLocaleString() || 0}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Dropped</div>
                            <div className="font-semibold text-red-600">{leak.dropped?.toLocaleString() || 0}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Revenue Lost</div>
                            <div className="font-semibold text-red-600">${(leak.revenue_lost / 1000).toFixed(1)}k</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Table */}
            <div className="mt-6 border-t border-slate-200 pt-6">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                        <tr>
                            <th className="p-4">Step Name</th>
                            <th className="p-4">Visitors</th>
                            <th className="p-4">Conversion</th>
                            <th className="p-4">Drop-off</th>
                    <th className="p-4">Revenue at Risk</th>
                            <th className="p-4">Top Friction</th>
                    <th className="p-4 text-right">AI</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {data.map((row, idx) => (
                            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-medium text-slate-700">
                                    <span className="text-slate-400 mr-2">{idx + 1}.</span>
                                    {row.name}
                                </td>
                                <td className="p-4 text-slate-600">{row.visitors.toLocaleString()}</td>
                                <td className="p-4 text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-brand-500" style={{ width: `${row.conversionRate}%` }}></div>
                                        </div>
                                        {row.conversionRate}%
                                    </div>
                                </td>
                                <td className="p-4 text-red-500 font-medium">
                                    {idx > 0 && `-${row.dropOffRate}%`}
                                </td>
                      <td className="p-4">
                        <span className="text-red-600 font-semibold">${(row.revenueAtRisk / 1000).toFixed(1)}k</span>
                      </td>
                                <td className="p-4">
                        {frictionData[row.id] && frictionData[row.id].length > 0 ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-50 text-red-600 border border-red-100">
                            <AlertTriangle size={10} /> {frictionData[row.id][0].element} ({frictionData[row.id][0].failure_rate}%)
                                        </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                                    )}
                                </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onExplain(`Step Forensics: ${row.name}`, {
                              step: row,
                              friction: frictionData[row.id] || [],
                              pathAnalysis: pathAnalysisData.find((p: any) => p.step_name === row.name) || null,
                            })
                          }
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                        >
                          <Sparkles size={12} className="mr-1" />
                          AI
                        </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
            </div>

      {/* Add Step Modal */}
      {showAddStepModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Add Funnel Step</h3>
              <button onClick={() => setShowAddStepModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
        </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {/* Category Tabs: Hospitality (hardcoded) + Generic (dynamic from DB) */}
              <div className="flex gap-2 mb-6 border-b border-slate-200">
                <button
                  onClick={() => setSelectedEventCategory('hospitality')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    selectedEventCategory === 'hospitality'
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Hospitality Milestones
                </button>
                <button
                  onClick={() => setSelectedEventCategory('generic')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    selectedEventCategory === 'generic'
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Generic Events
                </button>
                <button
                  onClick={() => setSelectedEventCategory('custom')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    selectedEventCategory === 'custom'
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Custom ({customEvents.length})
                </button>
      </div>

              {/* Event List */}
              <div className="grid grid-cols-1 gap-2">
                {selectedEventCategory === 'custom' ? (
                  /* Custom Events */
                  <>
                    {/* Create New Custom Event Button */}
                    <button
                      onClick={() => setShowCustomEventBuilder(true)}
                      className="p-4 border-2 border-dashed border-brand-400 rounded-lg hover:border-brand-500 hover:bg-brand-50 transition-all text-brand-600 font-medium flex items-center justify-center gap-2"
                    >
                      <Plus size={20} /> Create New Custom Event
                    </button>
                    
                    {/* List of Custom Events */}
                    {customEvents.length > 0 ? (
                      customEvents.map((event: any) => (
                        <div
                          key={event.template_id}
                          className="p-4 border border-slate-200 rounded-lg hover:border-brand-400 hover:bg-brand-50 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">{event.icon || '📦'}</div>
                            <div className="flex-1">
                              <div className="font-medium text-slate-800">{event.name}</div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {event.base_event_type} + {event.filters?.length || 0} filter{event.filters?.length !== 1 ? 's' : ''}
                              </div>
                              {event.description && (
                                <div className="text-xs text-slate-400 mt-1">{event.description}</div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddStep(event.name, 'custom', event)}
                                className="px-3 py-1.5 bg-brand-500 text-white text-xs rounded hover:bg-brand-600 transition-colors"
                              >
                                Use
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete "${event.name}"?`)) {
                                    deleteCustomEvent(event.template_id);
                                  }
                                }}
                                className="px-3 py-1.5 bg-red-100 text-red-600 text-xs rounded hover:bg-red-200 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-slate-400">
                        <MousePointerClick size={32} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-medium">No custom events yet</p>
                        <p className="text-xs mt-1">Create your first custom event template!</p>
                      </div>
                    )}
                  </>
                ) : selectedEventCategory === 'hospitality' ? (
                  /* Hospitality: Hardcoded curated events for demos */
                  HOSPITALITY_MILESTONES.map((event) => (
                    <button
                      key={event.event_name}
                      onClick={() => handleAddStep(event.name, 'hospitality')}
                      className="text-left p-4 border border-slate-200 rounded-lg hover:border-brand-400 hover:bg-brand-50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-brand-100">
                          <Target size={20} className="text-slate-600 group-hover:text-brand-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{event.name}</div>
                          {event.description && (
                            <div className="text-xs text-slate-500 mt-0.5">{event.description}</div>
                          )}
                        </div>
                        <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-500" />
                      </div>
                    </button>
                  ))
                ) : (
                  /* Generic: Dynamic events from database */
                  dynamicEvents.length > 0 ? (
                    dynamicEvents.map((ev) => (
                      <button
                        key={ev.event_type}
                        onClick={() => handleAddStep(ev.event_type, 'generic', { label: ev.label || ev.event_type })}
                        className="text-left p-4 border border-slate-200 rounded-lg hover:border-brand-400 hover:bg-brand-50 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-brand-100">
                            <MousePointerClick size={20} className="text-slate-600 group-hover:text-brand-600" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-slate-800">{ev.label || ev.event_type}</div>
                            <div className="text-xs text-slate-500 font-mono">{ev.event_type}</div>
                          </div>
                          <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-500" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-brand-500 mx-auto mb-2"></div>
                      <p className="text-sm">Loading events from database...</p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Event Builder Modal */}
      {showCustomEventBuilder && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowCustomEventBuilder(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-[500px] max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Create Custom Event</h3>
              <button onClick={() => setShowCustomEventBuilder(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <CustomEventBuilderForm
              eventSchema={eventSchema}
              onSave={async (template) => {
                try {
                  await createCustomEvent(template);
                  setShowCustomEventBuilder(false);
                  alert(`✅ Custom event "${template.template_name}" created!`);
                } catch (error) {
                  alert('❌ Failed to create custom event');
                }
              }}
              onCancel={() => setShowCustomEventBuilder(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Filter Builder Component
interface FilterBuilderProps {
  step: FunnelStepConfig;
  eventSchema: any;
  onAddFilter: (filter: EventFilter) => void;
}

const FilterBuilder: React.FC<FilterBuilderProps> = ({ step, eventSchema, onAddFilter }) => {
  const [selectedProperty, setSelectedProperty] = React.useState('');
  const [selectedOperator, setSelectedOperator] = React.useState<string>('equals');
  const [filterValue, setFilterValue] = React.useState('');

  // Get ALL available properties (not just event-specific ones) - Amplitude style
  const availableProperties = React.useMemo(() => {
    if (!eventSchema) return [];
    // Show all properties from the schema, organized by category
    return eventSchema.all_properties || [];
  }, [eventSchema]);

  // Get property type to determine available operators
  const selectedPropertyType = React.useMemo(() => {
    if (!selectedProperty) return null;
    const prop = availableProperties.find((p: any) => (p.property || p.field) === selectedProperty);
    return prop?.type || 'string';
  }, [selectedProperty, availableProperties]);

  // Get available operators based on property type
  const availableOperators = React.useMemo(() => {
    if (!selectedPropertyType) return [];
    
    const operators: { value: string; label: string }[] = [];
    
    if (selectedPropertyType === 'boolean') {
      operators.push(
        { value: 'equals', label: 'is' },
        { value: 'not_equals', label: 'is not' }
      );
    } else if (selectedPropertyType === 'number') {
      operators.push(
        { value: 'equals', label: '=' },
        { value: 'not_equals', label: '≠' },
        { value: 'greater_than', label: '>' },
        { value: 'greater_than_or_equal', label: '≥' },
        { value: 'less_than', label: '<' },
        { value: 'less_than_or_equal', label: '≤' },
        { value: 'in', label: 'in' },
        { value: 'not_in', label: 'not in' }
      );
    } else if (selectedPropertyType === 'date') {
      operators.push(
        { value: 'equals', label: 'is' },
        { value: 'not_equals', label: 'is not' },
        { value: 'greater_than', label: 'after' },
        { value: 'less_than', label: 'before' }
      );
    } else {
      // String type
      operators.push(
        { value: 'equals', label: 'is' },
        { value: 'not_equals', label: 'is not' },
        { value: 'contains', label: 'contains' },
        { value: 'not_contains', label: 'does not contain' },
        { value: 'starts_with', label: 'starts with' },
        { value: 'ends_with', label: 'ends with' },
        { value: 'in', label: 'is one of' },
        { value: 'not_in', label: 'is not one of' }
      );
    }
    
    // Add null checks for all types
    operators.push(
      { value: 'is_null', label: 'is empty' },
      { value: 'is_not_null', label: 'is not empty' }
    );
    
    return operators;
  }, [selectedPropertyType]);

  // Update operator when property changes
  React.useEffect(() => {
    if (availableOperators.length > 0 && !availableOperators.find(op => op.value === selectedOperator)) {
      setSelectedOperator(availableOperators[0].value);
    }
  }, [availableOperators, selectedOperator]);

  const handleAdd = () => {
    if (!selectedProperty) return;
    
    // For null checks, value is not required
    if (selectedOperator !== 'is_null' && selectedOperator !== 'is_not_null' && !filterValue) {
      return;
    }
    
    // Parse value based on type
    let parsedValue: any = filterValue;
    if (selectedPropertyType === 'number') {
      parsedValue = filterValue.includes(',') 
        ? filterValue.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
        : parseFloat(filterValue);
    } else if (selectedPropertyType === 'boolean') {
      parsedValue = filterValue.toLowerCase() === 'true' || filterValue === '1';
    }
    
    onAddFilter({
      property: selectedProperty,
      operator: selectedOperator as EventFilter['operator'],
      value: parsedValue || filterValue
    });
    
    // Reset form
    setSelectedProperty('');
    setFilterValue('');
    setSelectedOperator('equals');
  };

  // Group properties by category
  const groupedProperties = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    availableProperties.forEach((prop: any) => {
      const category = prop.category || 'Other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(prop);
    });
    return groups;
  }, [availableProperties]);

  const isNullOperator = selectedOperator === 'is_null' || selectedOperator === 'is_not_null';

  return (
    <div className="space-y-2 p-2 bg-slate-50 rounded border border-slate-200">
      <div className="grid grid-cols-3 gap-2">
        <select
          value={selectedProperty}
          onChange={(e) => {
            setSelectedProperty(e.target.value);
            setFilterValue(''); // Reset value when property changes
          }}
          className="text-xs bg-white border border-slate-200 rounded p-1.5"
        >
          <option value="">Select Property</option>
          {Object.entries(groupedProperties).map(([category, props]) => (
            <optgroup key={category} label={category}>
              {props.map((prop: any) => (
                <option key={prop.property || prop.field} value={prop.property || prop.field}>
                  {prop.label || prop.property || prop.field}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        
        <select
          value={selectedOperator}
          onChange={(e) => setSelectedOperator(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded p-1.5"
          disabled={!selectedProperty}
        >
          {availableOperators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
        
        <input
          type={selectedPropertyType === 'number' ? 'number' : selectedPropertyType === 'date' ? 'date' : 'text'}
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          placeholder={
            isNullOperator 
              ? 'No value needed' 
              : selectedOperator === 'in' || selectedOperator === 'not_in'
              ? 'Comma-separated values'
              : 'Value'
          }
          className="text-xs bg-white border border-slate-200 rounded p-1.5"
          disabled={isNullOperator}
          onKeyPress={(e) => e.key === 'Enter' && !isNullOperator && handleAdd()}
        />
      </div>
      <button
        onClick={handleAdd}
        disabled={!selectedProperty || (!isNullOperator && !filterValue)}
        className="w-full text-xs px-2 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        + Add Filter
      </button>
    </div>
  );
};

// Simplified Segment Filter Builder - Uses dropdowns with actual database values
interface SegmentFilterBuilderProps {
  segmentValues: any;
  isLoading: boolean;
  onAddFilter: (filter: EventFilter) => void;
}

const SegmentFilterBuilder: React.FC<SegmentFilterBuilderProps> = ({ segmentValues, isLoading, onAddFilter }) => {
  const [selectedProperty, setSelectedProperty] = React.useState('');
  const [selectedValue, setSelectedValue] = React.useState('');

  // Map property keys to user-friendly labels
  const propertyLabels: Record<string, string> = {
    'device_type': '📱 Device Type',
    'guest_segment': '👥 Guest Segment',
    'selected_location': '🏔️ Location',
    'traffic_source': '🔗 Traffic Source',
    'browser': '🌐 Browser',
    'os': '💻 Operating System',
    'is_returning_visitor': '🔄 Visitor Type'
  };

  const handleAdd = () => {
    if (!selectedProperty || !selectedValue) return;
    
    // Convert string "true"/"false" to boolean for is_returning_visitor
    let finalValue: string | boolean = selectedValue;
    if (selectedProperty === 'is_returning_visitor') {
      finalValue = selectedValue === 'true';
    }
    
    onAddFilter({
      property: selectedProperty,
      operator: 'equals',
      value: finalValue
    });
    
    // Reset form
    setSelectedProperty('');
    setSelectedValue('');
  };

  // Get available values for selected property
  const availableValues = selectedProperty && segmentValues ? segmentValues[selectedProperty] : [];

  if (isLoading) {
    return (
      <div className="space-y-2 p-2 bg-brand-50 rounded border border-brand-200">
        <div className="flex items-center justify-center py-2 text-xs text-brand-600">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-brand-500 border-t-transparent mr-2"></div>
          Loading available values...
        </div>
      </div>
    );
  }

  if (!segmentValues || Object.keys(segmentValues).length === 0) {
    return (
      <div className="space-y-2 p-2 bg-amber-50 rounded border border-amber-200">
        <div className="text-xs text-amber-700 text-center py-2">
          ⚠️ No segment data available. Please check your database.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2 bg-brand-50 rounded border border-brand-200">
      <div className="text-[10px] text-brand-700 font-medium mb-1">
        💡 One filter per segment. Need more? Create another segment!
      </div>
      <div className="grid grid-cols-2 gap-2">
        {/* Property Selector */}
        <select
          value={selectedProperty}
          onChange={(e) => {
            setSelectedProperty(e.target.value);
            setSelectedValue(''); // Reset value when property changes
          }}
          className="text-xs bg-white border border-brand-400 rounded p-1.5 text-brand-700"
        >
          <option value="">Select Property</option>
          {Object.keys(segmentValues).map((propKey) => (
            <option key={propKey} value={propKey}>
              {propertyLabels[propKey] || propKey}
            </option>
          ))}
        </select>
        
        {/* Value Selector - Shows dropdown of actual values (no counts) */}
        <select
          value={selectedValue}
          onChange={(e) => setSelectedValue(e.target.value)}
          className="text-xs bg-white border border-brand-400 rounded p-1.5 text-brand-700"
          disabled={!selectedProperty}
        >
          <option value="">Select Value</option>
          {availableValues && availableValues.length > 0 ? (
            availableValues.map((val: any) => (
              <option key={val.value} value={val.value}>
                {val.label}
              </option>
            ))
          ) : (
            selectedProperty && <option value="" disabled>No data available</option>
          )}
        </select>
      </div>
      <button
        onClick={handleAdd}
        disabled={!selectedProperty || !selectedValue || !availableValues || availableValues.length === 0}
        className="w-full text-xs px-2 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
      >
        ✓ Set Filter
      </button>
      {selectedProperty && availableValues && availableValues.length === 0 && (
        <div className="text-[9px] text-amber-600 text-center">
          ⚠️ No data for this property
        </div>
      )}
    </div>
  );
};

// Custom Event Builder Form Component
interface CustomEventBuilderFormProps {
  eventSchema: any;
  onSave: (template: {
    template_name: string;
    description?: string;
    base_event_type: string;
    filters: any[];
    icon?: string;
  }) => void;
  onCancel: () => void;
}

const CustomEventBuilderForm: React.FC<CustomEventBuilderFormProps> = ({ eventSchema, onSave, onCancel }) => {
  const [templateName, setTemplateName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [baseEvent, setBaseEvent] = React.useState('');
  const [icon, setIcon] = React.useState('📦');
  const [filters, setFilters] = React.useState<any[]>([]);
  
  // Filter builder state
  const [selectedProperty, setSelectedProperty] = React.useState('');
  const [selectedOperator, setSelectedOperator] = React.useState('equals');
  const [filterValue, setFilterValue] = React.useState('');
  
  const genericEvents = eventSchema?.generic_events || [];
  const allProperties = eventSchema?.all_properties || [];
  
  const handleAddFilter = () => {
    if (!selectedProperty || !filterValue) return;
    
    const newFilter = {
      property: selectedProperty,
      operator: selectedOperator,
      value: filterValue
    };
    
    setFilters([...filters, newFilter]);
    setSelectedProperty('');
    setFilterValue('');
  };
  
  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };
  
  const handleSave = () => {
    if (!templateName || !baseEvent) {
      alert('Please provide a name and select a base event');
      return;
    }
    
    onSave({
      template_name: templateName,
      description,
      base_event_type: baseEvent,
      filters,
      icon
    });
  };
  
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Template Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Custom Event Name *
        </label>
        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="e.g., Add-on Viewed"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>
      
      {/* Icon Picker */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Icon (Emoji)
        </label>
        <div className="flex gap-2">
          {['📦', '🎁', '🛒', '💳', '✅', '❌', '📱', '💻', '🏠', '⭐'].map(emoji => (
            <button
              key={emoji}
              onClick={() => setIcon(emoji)}
              className={`text-2xl p-2 rounded-lg border-2 transition-all ${
                icon === emoji ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-400'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      
      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Description (Optional)
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., User viewed add-on options"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>
      
      {/* Base Event Type */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Base Event Type *
        </label>
        <select
          value={baseEvent}
          onChange={(e) => setBaseEvent(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          <option value="">Select a base event...</option>
          {genericEvents.map((event: any) => (
            <option key={event.event_type} value={event.name}>
              {event.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          This is the generic event your custom event is based on
        </p>
      </div>
      
      {/* Filters */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Filters (Optional)
        </label>
        <p className="text-xs text-slate-500 mb-3">
          Add filters to make your custom event more specific
        </p>
        
        {/* Current Filters */}
        {filters.length > 0 && (
          <div className="mb-3 space-y-2">
            {filters.map((filter, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-brand-50 border border-brand-200 rounded-lg text-sm">
                <span className="font-medium text-brand-700">{filter.property}</span>
                <span className="text-brand-500">{filter.operator}</span>
                <span className="text-brand-700">{filter.value}</span>
                <button
                  onClick={() => handleRemoveFilter(index)}
                  className="ml-auto text-red-500 hover:text-red-700"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Add Filter */}
        <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="grid grid-cols-3 gap-2">
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="text-sm px-2 py-1.5 border border-slate-300 rounded"
            >
              <option value="">Property...</option>
              {allProperties.map((prop: any) => (
                <option key={prop.property} value={prop.property}>
                  {prop.label || prop.property}
                </option>
              ))}
            </select>
            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="text-sm px-2 py-1.5 border border-slate-300 rounded"
            >
              <option value="equals">equals</option>
              <option value="contains">contains</option>
              <option value="starts_with">starts with</option>
              <option value="greater_than">{'>'}</option>
              <option value="less_than">{'<'}</option>
            </select>
            <input
              type="text"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              placeholder="Value..."
              className="text-sm px-2 py-1.5 border border-slate-300 rounded"
            />
          </div>
          <button
            onClick={handleAddFilter}
            disabled={!selectedProperty || !filterValue}
            className="w-full text-sm px-3 py-1.5 bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Filter
          </button>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-slate-200">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!templateName || !baseEvent}
          className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Save Template
        </button>
      </div>
    </div>
  );
};

export default FunnelLab;
