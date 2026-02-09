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
  Area,
  Sparkline
} from 'recharts';
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
import { FunnelStep, FunnelDefinition, FunnelStepConfig, FrictionPoint, EventFilter } from '../types';
import { fetchFunnelData, fetchFrictionData, fetchOverTimeData, fetchEventSchema, fetchPathAnalysis, fetchLatencyData, fetchAbnormalDropoffs, fetchPriceSensitivity, fetchCohortAnalysis, fetchExecutiveSummary } from '../services/funnelService';

interface FunnelLabProps {
  onExplain: (title: string, data: any) => void;
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

const DEFAULT_STEPS: FunnelStepConfig[] = [
  { id: '1', label: 'Landed', event_category: 'hospitality', event_type: 'Landed' },
  { id: '2', label: 'Location Select', event_category: 'hospitality', event_type: 'Location Select' },
  { id: '3', label: 'Date Select', event_category: 'hospitality', event_type: 'Date Select' },
  { id: '4', label: 'Room Select', event_category: 'hospitality', event_type: 'Room Select' },
  { id: '5', label: 'Payment', event_category: 'hospitality', event_type: 'Payment' },
  { id: '6', label: 'Confirmation', event_category: 'hospitality', event_type: 'Confirmation' },
];

const FunnelLab: React.FC<FunnelLabProps> = ({ onExplain }) => {
  const [config, setConfig] = useState<FunnelDefinition>({
    steps: DEFAULT_STEPS,
    view_type: 'conversion',
    completed_within: 1, // days
    counting_by: 'unique_users',
    order: 'strict',
    group_by: null,
    global_filters: {},
    compare_segment: null
  });

  const [data, setData] = useState<FunnelStep[]>([]);
  const [overTimeData, setOverTimeData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [selectedEventCategory, setSelectedEventCategory] = useState<'generic' | 'hospitality'>('hospitality');
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
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
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const API_BASE = 'http://localhost:8000';

  // Fetch event schema on mount
  useEffect(() => {
    const loadSchema = async () => {
      const schema = await fetchEventSchema();
      setEventSchema(schema);
    };
    loadSchema();
    
    // Load available locations
    const loadLocations = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/funnel/locations`);
        if (response.ok) {
          const locations = await response.json();
          setAvailableLocations(locations);
        }
      } catch (error) {
        console.error('Error loading locations:', error);
      }
    };
    loadLocations();
  }, []);

  // Fetch funnel data when config changes
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [funnelData, timeSeriesData, pathData, latency, abnormal, price, cohort, executive] = await Promise.all([
          fetchFunnelData(config),
          fetchOverTimeData(config),
          fetchPathAnalysis(config),
          fetchLatencyData(config),
          fetchAbnormalDropoffs(config),
          fetchPriceSensitivity(config),
          fetchCohortAnalysis(config),
          fetchExecutiveSummary(config.global_filters?.location, 30)
        ]);
        setData(funnelData);
        setOverTimeData(timeSeriesData);
        setPathAnalysisData(pathData);
        setLatencyData(latency);
        setAbnormalDropoffsData(abnormal);
        setPriceSensitivityData(price);
        setCohortAnalysisData(cohort);
        setExecutiveSummary(executive);
        
        // Load friction data for each step
        const frictionPromises = funnelData.map((step, idx) => 
          fetchFrictionData(step.event_name || step.name || config.steps[idx]?.event_type || `step_${idx + 1}`).then(result => ({
            stepId: step.id,
            friction: result.friction_points || []
          }))
        );
        const frictionResults = await Promise.all(frictionPromises);
        const frictionMap: Record<string, FrictionPoint[]> = {};
        frictionResults.forEach(({ stepId, friction }) => {
          frictionMap[stepId] = friction;
      });
        setFrictionData(frictionMap);
      } catch (error) {
        console.error('Error loading funnel data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (config.steps.length > 0) {
      loadData();
    }
  }, [config]);

  const handleAddStep = (eventType: string, category: 'generic' | 'hospitality') => {
    const newStep: FunnelStepConfig = {
      id: Date.now().toString(),
      label: eventType,
      event_category: category,
      event_type: eventType,
      filters: []
    };
         setConfig(prev => ({
             ...prev,
      steps: [...prev.steps, newStep]
    }));
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
    setConfig(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== id)
    }));
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
    setConfig(prev => ({ ...prev, view_type: viewType }));
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
    setConfig(prev => ({ ...prev, completed_within: days }));
  };

  const handleUpdateCountingBy = (countingBy: 'unique_users' | 'sessions' | 'events') => {
    setConfig(prev => ({ ...prev, counting_by: countingBy }));
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
    setConfig(prev => ({ ...prev, group_by }));
  };

  // Global filter handlers: act as top-level WHERE filters in ClickHouse
  const handleUpdateLocationFilter = (locationValue: string) => {
    setConfig(prev => ({
      ...prev,
      global_filters: {
        ...(prev.global_filters || {}),
        location: locationValue === 'All Locations' ? undefined : locationValue,
      },
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
                <span className="font-mono font-semibold">${(d.revenueAtRisk / 1000).toFixed(1)}k</span>
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
        <div className="p-4 border-b border-slate-200 bg-white">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Filter size={12} />
            Global Filters
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={14} className="text-slate-400" />
              <select
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded p-1.5 outline-none"
                value={config.global_filters?.location || 'All Locations'}
                onChange={(e) => handleUpdateLocationFilter(e.target.value)}
              >
                <option value="All Locations">All Locations</option>
                {availableLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
            
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

          {/* Group By Section */}
          <div className="pt-4 border-t border-slate-200 mt-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Group By</h3>
            <div className="space-y-1.5">
              {(['device_type', 'guest_segment', 'traffic_source'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => handleUpdateGroupBy(config.group_by === option ? null : option)}
                  className={`w-full text-left px-3 py-2 text-sm rounded border transition-colors ${
                    config.group_by === option
                      ? 'bg-brand-50 border-brand-200 text-brand-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {option.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </button>
              ))}
                        </div>
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
          <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-500 text-xs font-medium uppercase mb-1">Total Conversion</div>
              <div className="text-2xl font-bold text-slate-800">{totalConversion}%</div>
                    <div className="text-xs text-green-600 mt-1 flex items-center">
                <TrendingUp size={12} className="mr-1" /> +2.4% vs last {config.window}
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-500 text-xs font-medium uppercase mb-1">Dropped Off</div>
              <div className="text-2xl font-bold text-slate-800">{totalDropped}</div>
                    <div className="text-xs text-slate-400 mt-1">Guests lost</div>
                </div>
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-500 text-xs font-medium uppercase mb-1">Revenue at Risk</div>
              <div className="text-2xl font-bold text-red-600">${(totalRevenueAtRisk / 1000).toFixed(1)}k</div>
                    <div className="text-xs text-red-500 mt-1 font-medium">High Alert</div>
                </div>
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-500 text-xs font-medium uppercase mb-1">Avg Time to Convert</div>
                    <div className="text-2xl font-bold text-slate-800">
                      {(() => {
                        // Use the LAST step's cumulative time (time from start to final conversion)
                        const lastStep = latencyData[latencyData.length - 1];
                        const totalSeconds = lastStep?.median_time_seconds || 0;
                        const minutes = Math.floor(totalSeconds / 60);
                        const seconds = Math.floor(totalSeconds % 60);
                        return totalSeconds > 0 ? `${minutes}m ${seconds}s` : '--';
                      })()}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Median duration</div>
            </div>
                </div>
            </div>

        {/* Chart Tabs */}
        <div className="px-6 pt-2 border-b border-slate-200 bg-white">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('conversion')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'conversion'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Conversion
            </button>
            <button
              onClick={() => setActiveTab('overTime')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overTime'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Over Time
            </button>
            <button
              onClick={() => setActiveTab('timeToConvert')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'timeToConvert'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Time to Convert
            </button>
            <button
              onClick={() => setActiveTab('pathAnalysis')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'pathAnalysis'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Path Analysis
            </button>
            <button
              onClick={() => setActiveTab('priceSensitivity')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'priceSensitivity'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Price Sensitivity
            </button>
            <button
              onClick={() => setActiveTab('cohortAnalysis')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'cohortAnalysis'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Cohort Analysis
            </button>
            <button
              onClick={() => setActiveTab('executive')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'executive'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Executive Summary
            </button>
          </div>
        </div>

        {/* Main Chart */}
        <div className="flex-1 p-6 pt-0 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-h-[500px]">
                {activeTab === 'conversion' && (
              <div className="h-[700px] w-full">
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
                    </div>
                )}

                 {activeTab === 'overTime' && (
              <div className="h-[500px] w-full">
                {overTimeData.length > 0 ? (
                         <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={overTimeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        {config.steps.map((step, idx) => (
                          <linearGradient key={step.id} id={`color-${step.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={idx === config.steps.length - 1 ? '#10b981' : '#3b82f6'} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={idx === config.steps.length - 1 ? '#10b981' : '#3b82f6'} stopOpacity={0}/>
                          </linearGradient>
                        ))}
                      </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="date" 
                        tick={{fontSize: 11, fill: '#64748b'}}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis tick={{fontSize: 11, fill: '#64748b'}} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                        labelFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        }}
                      />
                      {config.steps.map((step, idx) => {
                        const stepKey = step.label || step.event_type || `step_${idx + 1}`;
                        return (
                          <Area
                            key={step.id}
                            type="monotone"
                            dataKey={stepKey}
                            stackId="1"
                            stroke={idx === config.steps.length - 1 ? '#10b981' : '#3b82f6'}
                            fill={`url(#color-${step.id})`}
                            strokeWidth={2}
                            animationDuration={800}
                          />
                        );
                      })}
                            </AreaChart>
                         </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <Clock size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Loading time-series data...</p>
                    </div>
                    </div>
                )}
              </div>
            )}

                {activeTab === 'timeToConvert' && (
              <div className="h-[600px] p-6">
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
                            const totalSeconds = lastStep?.median_time_seconds || 0;
                            const minutes = Math.floor(totalSeconds / 60);
                            const seconds = Math.floor(totalSeconds % 60);
                            return `${minutes}m ${seconds}s`;
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
                        const minutes = Math.floor(step.median_time_seconds / 60);
                        const seconds = Math.floor(step.median_time_seconds % 60);
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
                ) : (
                  <div className="flex items-center justify-center h-[400px]">
                    <div className="text-center text-slate-400">
                      <Clock size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-sm">
                        {data.length > 0 ? 'Calculating time metrics...' : 'Configure funnel to see time data'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
                )}

            {activeTab === 'pathAnalysis' && (
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Where Users Go After Dropping</h3>
                {pathAnalysisData.map((analysis, idx) => (
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
                ))}
              </div>
            )}

            {activeTab === 'priceSensitivity' && (
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Price Changes Through Funnel</h3>
                {priceSensitivityData.map((step, idx) => (
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
                ))}
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
                      <td className="p-4 text-red-600 font-medium">
                        ${(row.revenueAtRisk / 1000).toFixed(1)}k
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
              {/* Category Tabs */}
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
      </div>

              {/* Event List */}
              <div className="grid grid-cols-1 gap-2">
                {eventSchema ? (
                  (selectedEventCategory === 'hospitality' 
                    ? eventSchema.hospitality_events || []
                    : eventSchema.generic_events || []
                  ).map((event: any) => (
                    <button
                      key={event.name || event.event_type}
                      onClick={() => handleAddStep(event.name || event.event_type, selectedEventCategory)}
                      className="text-left p-4 border border-slate-200 rounded-lg hover:border-brand-400 hover:bg-brand-50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-brand-100">
                          {selectedEventCategory === 'hospitality' ? (
                            <Target size={20} className="text-slate-600 group-hover:text-brand-600" />
                          ) : (
                            <MousePointerClick size={20} className="text-slate-600 group-hover:text-brand-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{event.name}</div>
                          {event.properties && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {event.properties.length} filterable properties
                            </div>
                          )}
                        </div>
                        <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-500" />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-brand-500 mx-auto mb-2"></div>
                    <p className="text-sm">Loading event types...</p>
                  </div>
                )}
              </div>
            </div>
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
      operator: selectedOperator,
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

export default FunnelLab;
