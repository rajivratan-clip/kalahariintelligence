import React, { useState, useEffect } from 'react';
import { Plus, X, TrendingUp, Users, BarChart3, Calendar, Filter, Brain, User, Zap, Sparkles } from 'lucide-react';
import { EventFilter } from '../types';
import DateFilter, { DateRange } from './DateFilter';
import ChartTypeSelector, { ChartType } from './ChartTypeSelector';
import ChartRenderer from './ChartRenderer';

type SegmentMode = 'event' | 'behavioral' | 'guest';

interface SegmentationEvent {
  id: string;
  event_type: string;
  event_category: 'generic' | 'hospitality' | 'custom';
  filters: EventFilter[];
  label: string;
}

interface SegmentationViewProps {
  eventSchema: any;
  onExplain?: (title: string, data: unknown) => void;
  onExplainPayloadReady?: (getter: (() => { title: string; data: unknown } | null) | null) => void;
  injectedSegmentMode?: 'event' | 'behavioral' | 'guest' | null;
  onInjectedSegmentModeConsumed?: () => void;
  /** Optional injections from AI-guided build */
  injectedMeasurement?: string | null;
  injectedGroupBy?: string | null;
  injectedTimePeriodDays?: number | null;
  injectedInterval?: 'day' | 'week' | 'month' | null;
  injectedEvents?: SegmentationEvent[] | null;
}

interface SegmentationResult {
  event_id: string;
  event_label: string;
  metric_value: number;
  time_series: Array<{ date: string; value: number }>;
  breakdown: Array<{ group: string; value: number; secondary: number }>;
}

interface BehavioralSegmentSummary {
  segment_type: string;
  label: string;
  sessions: number;
  conversions: number;
  conversion_rate_pct: number;
  revenue: number;
  avg_potential_revenue: number;
  pct_of_total?: number;
}

interface BehavioralSegmentsResponse {
  mode: string;
  time_period_days: number;
  total_sessions?: number;
  segments: BehavioralSegmentSummary[];
  time_series_by_segment: Record<string, Array<{ date: string; value: number }>>;
  segment_definitions: Record<string, { label: string; color: string; description?: string }>;
}

const BEHAVIORAL_SEGMENT_CHIPS = [
  { id: 'researcher', label: 'Researchers', description: 'High pages, low conversion' },
  { id: 'bargain_hunter', label: 'Bargain Hunters', description: 'Price checks & discount attempts' },
  { id: 'last_minute', label: 'Last-Minute Bookers', description: 'Short decision, high urgency' },
  { id: 'high_friction', label: 'High-Friction Droppers', description: 'Friction, rage clicks' },
  { id: 'high_intent_non_booker', label: 'High-Intent Non-Bookers', description: 'Wanted to book, didn\'t' },
  { id: 'converter', label: 'Converters', description: 'Completed booking' },
  { id: 'other', label: 'Other', description: 'All other sessions' },
];

const GUEST_SEGMENT_CHIPS = [
  { id: 'family', label: 'Families' },
  { id: 'luxury', label: 'Luxury Seekers' },
  { id: 'couple', label: 'Couples' },
  { id: 'business', label: 'Business Travelers' },
  { id: 'returning', label: 'Returning Guests' },
  { id: 'new', label: 'New Visitors' },
  { id: 'mobile', label: 'Mobile Guests' },
  { id: 'desktop', label: 'Desktop Guests' },
  { id: 'high_value', label: 'High-Value' },
  { id: 'price_sensitive', label: 'Price-Sensitive' },
  { id: 'other', label: 'Other' },
];

const SegmentationView: React.FC<SegmentationViewProps> = ({
  eventSchema,
  onExplain,
  onExplainPayloadReady,
  injectedSegmentMode,
  onInjectedSegmentModeConsumed,
  injectedMeasurement,
  injectedGroupBy,
  injectedTimePeriodDays,
  injectedInterval,
  injectedEvents,
}) => {
  const [segmentMode, setSegmentMode] = useState<SegmentMode>('event');
  
  const [events, setEvents] = useState<SegmentationEvent[]>([
    {
      id: 'event-1',
      event_type: 'Page Viewed',
      event_category: 'hospitality',
      filters: [],
      label: 'Page Viewed'
    }
  ]);
  
  const [measurement, setMeasurement] = useState('uniques');
  const [timePeriod, setTimePeriod] = useState(30);
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [interval, setInterval] = useState('day');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [chartType, setChartType] = useState<ChartType>('line');
  
  const [data, setData] = useState<SegmentationResult[]>([]);
  const [behavioralData, setBehavioralData] = useState<BehavioralSegmentsResponse | null>(null);
  const [guestData, setGuestData] = useState<BehavioralSegmentsResponse | null>(null);
  const [selectedBehavioralSegments, setSelectedBehavioralSegments] = useState<string[]>([]);
  const [selectedGuestSegments, setSelectedGuestSegments] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  
  const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || 'http://localhost:8000';

  // Initialize with default date range (last 30 days)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    setDateRange({ startDate, endDate: today });
  }, []);

  // Measurements available
  const measurements = [
    { id: 'uniques', name: 'Uniques', description: 'Unique users who performed the event', icon: <Users size={16} /> },
    { id: 'event_totals', name: 'Event Totals', description: 'Total count of events', icon: <BarChart3 size={16} /> },
    { id: 'average', name: 'Average', description: 'Avg events per user', icon: <TrendingUp size={16} /> },
    { id: 'revenue_per_user', name: '💰 Revenue per User', description: 'Revenue metrics', icon: <TrendingUp size={16} /> }
  ];

  // Group by options
  const groupByOptions = [
    { id: null, name: 'None' },
    { id: 'device_type', name: 'Device Type' },
    { id: 'guest_segment', name: 'Guest Segment' },
    { id: 'traffic_source', name: 'Traffic Source' },
    { id: 'browser', name: 'Browser' },
    { id: 'is_returning_visitor', name: 'Returning vs New' }
  ];

  // Time period options
  const timePeriodOptions = [
    { value: 7, label: 'Last 7 days' },
    { value: 14, label: 'Last 14 days' },
    { value: 30, label: 'Last 30 days' },
    { value: 60, label: 'Last 60 days' },
    { value: 90, label: 'Last 90 days' }
  ];

  // Fetch data based on segment mode
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Calculate time period from date range if available
      let calculatedTimePeriod = timePeriod;
      if (dateRange) {
        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate);
        calculatedTimePeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }

      if (segmentMode === 'behavioral') {
        const requestBody: any = {
          time_period: calculatedTimePeriod,
          interval,
          segment_ids: selectedBehavioralSegments.length > 0 ? selectedBehavioralSegments : undefined,
        };
        if (dateRange) {
          requestBody.date_range = {
            start_date: dateRange.startDate,
            end_date: dateRange.endDate,
          };
        }
        const response = await fetch(`${API_BASE}/api/analytics/behavioral-segments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if (response.ok) {
          const result = await response.json();
          setBehavioralData(result);
        } else {
          setBehavioralData(null);
        }
        return;
      }
      
      if (segmentMode === 'guest') {
        const requestBody: any = {
          time_period: calculatedTimePeriod,
          interval,
          segment_ids: selectedGuestSegments.length > 0 ? selectedGuestSegments : undefined,
        };
        if (dateRange) {
          requestBody.date_range = {
            start_date: dateRange.startDate,
            end_date: dateRange.endDate,
          };
        }
        const response = await fetch(`${API_BASE}/api/analytics/guest-segments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if (response.ok) {
          const result = await response.json();
          setGuestData(result);
        } else {
          setGuestData(null);
        }
        return;
      }
      
      // Event-based
      if (events.length === 0) return;
      
      const requestBody: any = {
        events,
        measurement,
        time_period: calculatedTimePeriod,
        group_by: groupBy,
        interval,
      };
      if (dateRange) {
        requestBody.date_range = {
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
        };
      }
      const response = await fetch(`${API_BASE}/api/analytics/segmentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      if (response.ok) {
        const result = await response.json();
        setData(result.results || []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('Error fetching segmentation data:', error);
      setData([]);
      setBehavioralData(null);
      setGuestData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Update time period when date range changes
  useEffect(() => {
    if (dateRange) {
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      setTimePeriod(days);
    }
  }, [dateRange]);

  useEffect(() => {
    if (dateRange) {
      fetchData();
    }
  }, [segmentMode, events, measurement, timePeriod, groupBy, interval, selectedBehavioralSegments, selectedGuestSegments, dateRange]);

  // Apply injected segment mode from AI guided build
  useEffect(() => {
    if (injectedSegmentMode) {
      setSegmentMode(injectedSegmentMode);
      onInjectedSegmentModeConsumed?.();
    }
  }, [injectedSegmentMode]);

  // Apply injected measurement / groupBy / timePeriod / interval / events from AI guided build
  useEffect(() => {
    if (injectedMeasurement) {
      setMeasurement(injectedMeasurement);
    }
  }, [injectedMeasurement]);

  useEffect(() => {
    if (typeof injectedGroupBy !== 'undefined' && injectedGroupBy !== null) {
      setGroupBy(injectedGroupBy);
    }
  }, [injectedGroupBy]);

  useEffect(() => {
    if (typeof injectedTimePeriodDays === 'number' && injectedTimePeriodDays > 0) {
      setTimePeriod(injectedTimePeriodDays);
    }
  }, [injectedTimePeriodDays]);

  useEffect(() => {
    if (injectedInterval) {
      setInterval(injectedInterval);
    }
  }, [injectedInterval]);

  useEffect(() => {
    if (injectedEvents && injectedEvents.length > 0) {
      setEvents(injectedEvents);
    }
  }, [injectedEvents]);

  // Register explain payload for parent (Analytics Studio header "Ask AI")
  useEffect(() => {
    if (!onExplainPayloadReady) return;
    const getter = () => {
      const payload: { title: string; data: unknown } = {
        title: 'Segmentation Analysis',
        data: {
          segment_mode: segmentMode,
          measurement,
          time_period_days: timePeriod,
          group_by: groupBy,
          interval,
          events: segmentMode === 'event' ? events : undefined,
          event_results: segmentMode === 'event' && data.length > 0 ? data : undefined,
          behavioral_segments: segmentMode === 'behavioral' && behavioralData ? behavioralData : undefined,
          guest_segments: segmentMode === 'guest' && guestData ? guestData : undefined,
          total_sessions: segmentMode === 'behavioral' ? behavioralData?.total_sessions : segmentMode === 'guest' ? guestData?.total_sessions : undefined,
        }
      };
      const hasData = (segmentMode === 'event' && data.length > 0) || (segmentMode === 'behavioral' && behavioralData) || (segmentMode === 'guest' && guestData);
      return hasData ? payload : null;
    };
    onExplainPayloadReady(getter);
    return () => { onExplainPayloadReady(null); };
  }, [onExplainPayloadReady, segmentMode, measurement, timePeriod, groupBy, interval, events, data, behavioralData, guestData]);

  const toggleBehavioralSegment = (id: string) => {
    setSelectedBehavioralSegments(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };
  const toggleGuestSegment = (id: string) => {
    setSelectedGuestSegments(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  // Add new event
  const handleAddEvent = () => {
    setEvents([...events, {
      id: `event-${Date.now()}`,
      event_type: 'Page Viewed',
      event_category: 'hospitality',
      filters: [],
      label: 'Page Viewed'
    }]);
  };

  // Remove event
  const handleRemoveEvent = (eventId: string) => {
    setEvents(events.filter(e => e.id !== eventId));
  };

  // Update event
  const handleUpdateEvent = (eventId: string, updates: Partial<SegmentationEvent>) => {
    setEvents(events.map(e => e.id === eventId ? { ...e, ...updates } : e));
  };

  // Prepare chart data for event-based (combine all time series)
  const chartData: any[] = [];
  if (data.length > 0 && data[0].time_series.length > 0) {
    const dates = data[0].time_series.map(ts => ts.date);
    dates.forEach(date => {
      const dataPoint: any = { date };
      data.forEach(result => {
        const ts = result.time_series.find(t => t.date === date);
        dataPoint[result.event_id] = ts?.value || 0;
      });
      chartData.push(dataPoint);
    });
  }

  // Prepare chart data for behavioral/guest modes
  const behavioralChartData: any[] = [];
  const segmentResponse = segmentMode === 'behavioral' ? behavioralData : guestData;
  if (segmentResponse?.time_series_by_segment && Object.keys(segmentResponse.time_series_by_segment).length > 0) {
    const allDates = new Set<string>();
    Object.values(segmentResponse.time_series_by_segment).forEach(series => {
      series.forEach(p => allDates.add(p.date));
    });
    const sortedDates = Array.from(allDates).sort();
    sortedDates.forEach(date => {
      const point: Record<string, string | number> = { date };
      Object.entries(segmentResponse.time_series_by_segment).forEach(([seg, series]) => {
        const p = series.find(s => s.date === date);
        point[seg] = p?.value ?? 0;
      });
      behavioralChartData.push(point);
    });
  }

  const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4', '#64748b'];

  return (
    <div className="space-y-6">
      {/* Segment Type Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 mb-2">Segment Type</label>
        <div className="flex flex-wrap gap-2">
          {[
            { mode: 'event' as SegmentMode, label: 'Event-based', icon: Zap, desc: 'Analyze by events (Page View, Room Select, etc.)' },
            { mode: 'behavioral' as SegmentMode, label: 'Behavioral', icon: Brain, desc: 'Pre-defined behavior patterns (Researchers, Bargain Hunters, etc.)' },
            { mode: 'guest' as SegmentMode, label: 'Guest / User', icon: User, desc: 'By guest segment, device, value tier, returning vs new' },
          ].map(({ mode, label, icon: Icon, desc }) => (
            <button
              key={mode}
              onClick={() => setSegmentMode(mode)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                segmentMode === mode
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {segmentMode === 'event' && 'Add events and measure uniques, totals, or revenue per user.'}
          {segmentMode === 'behavioral' && 'Compare sessions by behavior: researchers, bargain hunters, high-friction droppers, and more.'}
          {segmentMode === 'guest' && 'Compare sessions by guest profile, device, value tier, and visitor type.'}
        </p>
      </div>

      {/* Control Bar - shared controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1" />
          {onExplain && (
            <button
              onClick={() => {
                const payload = (segmentMode === 'event' && data.length > 0) || (segmentMode === 'behavioral' && behavioralData) || (segmentMode === 'guest' && guestData)
                  ? {
                      title: 'Segmentation Analysis',
                      data: {
                        segment_mode: segmentMode,
                        measurement,
                        time_period_days: timePeriod,
                        group_by: groupBy,
                        interval,
                        events: segmentMode === 'event' ? events : undefined,
                        event_results: segmentMode === 'event' ? data : undefined,
                        behavioral_segments: segmentMode === 'behavioral' ? behavioralData : undefined,
                        guest_segments: segmentMode === 'guest' ? guestData : undefined,
                      }
                    }
                  : null;
                if (payload) onExplain(payload.title, payload.data);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-sm font-medium hover:bg-indigo-100 hover:border-indigo-200 transition-all"
            >
              <Sparkles size={16} />
              AI Insights
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {segmentMode === 'event' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Measured as</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  value={measurement}
                  onChange={(e) => setMeasurement(e.target.value)}
                >
                  {measurements.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {measurements.find(m => m.id === measurement)?.description}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Group By</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  value={groupBy || ''}
                  onChange={(e) => setGroupBy(e.target.value || null)}
                >
                  {groupByOptions.map(opt => (
                    <option key={opt.id || 'none'} value={opt.id || ''}>{opt.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date Range</label>
            <DateFilter value={dateRange} onChange={setDateRange} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Interval</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Behavioral Segment Chips */}
      {segmentMode === 'behavioral' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-2">Filter by segments (optional)</h3>
          <p className="text-xs text-slate-500 mb-3">Select segments to compare, or leave empty to show all.</p>
          <div className="flex flex-wrap gap-2">
            {BEHAVIORAL_SEGMENT_CHIPS.map(seg => (
              <button
                key={seg.id}
                onClick={() => toggleBehavioralSegment(seg.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                  selectedBehavioralSegments.includes(seg.id)
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                {seg.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Guest Segment Chips */}
      {segmentMode === 'guest' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-2">Filter by segments (optional)</h3>
          <p className="text-xs text-slate-500 mb-3">Select segments to compare, or leave empty to show all.</p>
          <div className="flex flex-wrap gap-2">
            {GUEST_SEGMENT_CHIPS.map(seg => (
              <button
                key={seg.id}
                onClick={() => toggleGuestSegment(seg.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                  selectedGuestSegments.includes(seg.id)
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                {seg.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Events Section - Event mode only */}
      {segmentMode === 'event' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Events to Analyze</h3>
            <button
              onClick={handleAddEvent}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              Add Event
            </button>
          </div>

          <div className="space-y-3">
            {events.map((event, index) => (
              <div key={event.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                  {String.fromCharCode(65 + index)}
                </div>
                
                <select
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={event.event_type}
                  onChange={(e) => handleUpdateEvent(event.id, { event_type: e.target.value, label: e.target.value })}
                >
                  <optgroup label="Hospitality Events">
                    <option value="Page Viewed">Page Viewed</option>
                    <option value="Location Select">Location Select</option>
                    <option value="Date Select">Date Select</option>
                    <option value="Room Select">Room Select</option>
                    <option value="Payment">Payment</option>
                    <option value="Confirmation">Confirmation</option>
                  </optgroup>
                  <optgroup label="Generic Events">
                    <option value="Click">Click</option>
                    <option value="Form Submitted">Form Submitted</option>
                    <option value="Error">Error</option>
                    <option value="Scroll">Scroll</option>
                  </optgroup>
                </select>

                <input
                  type="text"
                  className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Custom label..."
                  value={event.label}
                  onChange={(e) => handleUpdateEvent(event.id, { label: e.target.value })}
                />

                <button
                  onClick={() => handleRemoveEvent(event.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  disabled={events.length === 1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-500 border-t-transparent"></div>
        </div>
      )}

      {/* Behavioral / Guest Results */}
      {!isLoading && segmentResponse?.segments && segmentResponse.segments.length > 0 && (
        <>
          {segmentResponse.total_sessions != null && segmentResponse.total_sessions > 0 && (
            <div className="bg-slate-100 rounded-xl border border-slate-200 px-4 py-2 flex justify-between items-center">
              <span className="text-sm font-medium text-slate-600">Total sessions in period</span>
              <span className="text-lg font-bold text-slate-900">{segmentResponse.total_sessions.toLocaleString()}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {segmentResponse.segments.map((seg: BehavioralSegmentSummary, idx: number) => {
              const def = segmentResponse.segment_definitions?.[seg.segment_type];
              const color = def?.color || COLORS[idx % COLORS.length];
              return (
                <div key={seg.segment_type} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium text-slate-700">{seg.label}</span>
                    </div>
                    {seg.pct_of_total != null && (
                      <span className="text-xs font-semibold text-slate-500">{seg.pct_of_total}%</span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{seg.sessions.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">sessions</div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>{seg.conversions.toLocaleString()} converted</span>
                    <span>{seg.conversion_rate_pct}% CVR</span>
                    <span className="text-green-600 font-medium">${seg.revenue.toLocaleString()} rev</span>
                  </div>
                </div>
              );
            })}
          </div>
          {behavioralChartData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calendar size={20} className="text-brand-600" />
                  Sessions by {segmentMode === 'behavioral' ? 'Behavior' : 'Guest'} Over Time
                </h3>
                <div className="flex items-center gap-3">
                  <DateFilter value={dateRange} onChange={setDateRange} />
                  <ChartTypeSelector
                    value={chartType}
                    onChange={setChartType}
                    availableTypes={['line', 'area', 'bar', 'composed']}
                  />
                </div>
              </div>
              <ChartRenderer
                data={behavioralChartData}
                chartType={chartType}
                dataKeys={Object.keys(segmentResponse.time_series_by_segment || {})}
                xAxisKey="date"
                colors={Object.keys(segmentResponse.time_series_by_segment || {}).map((seg, idx) => {
                  const def = segmentResponse.segment_definitions?.[seg];
                  return def?.color || COLORS[idx % COLORS.length];
                })}
                height={350}
                xAxisLabel="Date"
                yAxisLabel="Sessions"
              />
            </div>
          )}
        </>
      )}

      {/* Event-based Results */}
      {!isLoading && segmentMode === 'event' && data.length > 0 && (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {data.map((result, index) => (
              <div key={result.event_id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span className="text-sm font-medium text-slate-600">{result.event_label}</span>
                </div>
                <div className="text-3xl font-bold text-slate-900 mb-1">
                  {measurement === 'revenue_per_user' ? `$${result.metric_value.toFixed(0)}` : result.metric_value.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500">
                  {measurement === 'uniques' && 'Unique users'}
                  {measurement === 'event_totals' && 'Total events'}
                  {measurement === 'average' && 'Avg per user'}
                  {measurement === 'revenue_per_user' && 'Revenue per user'}
                </div>
              </div>
            ))}
          </div>

          {/* Time Series Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar size={20} className="text-brand-600" />
                Trend Over Time
              </h3>
              <div className="flex items-center gap-3">
                <DateFilter value={dateRange} onChange={setDateRange} />
                <ChartTypeSelector
                  value={chartType}
                  onChange={setChartType}
                  availableTypes={['line', 'area', 'bar', 'composed']}
                />
              </div>
            </div>
            <ChartRenderer
              data={chartData}
              chartType={chartType}
              dataKeys={data.map(d => d.event_id)}
              xAxisKey="date"
              colors={COLORS}
              height={350}
              xAxisLabel="Date"
              yAxisLabel={measurement === 'revenue_per_user' ? 'Revenue ($)' : measurement === 'uniques' ? 'Unique Users' : 'Count'}
            />
          </div>

          {/* Breakdown by Group */}
          {groupBy && data.some(d => d.breakdown.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.map((result, index) => (
                result.breakdown.length > 0 && (
                  <div key={result.event_id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Filter size={20} style={{ color: COLORS[index % COLORS.length] }} />
                      {result.event_label} by {groupByOptions.find(g => g.id === groupBy)?.name}
                    </h3>
                    <ChartRenderer
                      data={result.breakdown}
                      chartType="bar"
                      dataKeys={['value']}
                      xAxisKey="group"
                      colors={[COLORS[index % COLORS.length]]}
                      height={280}
                      xAxisLabel={groupByOptions.find(g => g.id === groupBy)?.name || 'Group'}
                      yAxisLabel="Value"
                    />
                  </div>
                )
              ))}
            </div>
          )}

          {/* Insights */}
          <div className="bg-gradient-to-br from-brand-50 to-blue-50 rounded-xl border border-brand-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <TrendingUp size={20} className="text-brand-600" />
              💡 Segmentation Insights
            </h3>
            <div className="space-y-2">
              {data.map((result, index) => {
                const firstVal = result.time_series[0]?.value ?? 0;
                const lastVal = result.time_series.length > 1 ? (result.time_series[result.time_series.length - 1]?.value ?? 0) : firstVal;
                const trend = result.time_series.length > 1 && firstVal > 0
                  ? ((lastVal - firstVal) / firstVal * 100)
                  : 0;
                
                return (
                  <p key={result.event_id} className="text-sm text-slate-700">
                    <strong style={{ color: COLORS[index % COLORS.length] }}>{result.event_label}:</strong> 
                    {' '}{result.metric_value.toLocaleString()} {measurement === 'uniques' ? 'unique users' : 'events'}
                    {trend !== 0 && (
                      <span className={trend > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {' '}({trend > 0 ? '+' : ''}{trend.toFixed(1)}% over period)
                      </span>
                    )}
                  </p>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Empty State - Event mode */}
      {!isLoading && segmentMode === 'event' && data.length === 0 && events.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BarChart3 size={64} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">Start Analyzing Events</h3>
          <p className="text-slate-600 mb-6">
            Add events to compare user behavior and discover insights
          </p>
          <button
            onClick={handleAddEvent}
            className="px-6 py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium"
          >
            Add Your First Event
          </button>
        </div>
      )}

      {/* Empty State - Behavioral/Guest when no data */}
      {!isLoading && (segmentMode === 'behavioral' || segmentMode === 'guest') && !segmentResponse?.segments?.length && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BarChart3 size={64} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No {segmentMode === 'behavioral' ? 'Behavioral' : 'Guest'} Data Yet</h3>
          <p className="text-slate-600 mb-6">
            Ensure sessions and raw_events tables have data for the selected time period.
          </p>
        </div>
      )}
    </div>
  );
};

export default SegmentationView;
