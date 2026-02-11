import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Plus, X, TrendingUp, Users, BarChart3, Calendar, Filter, ChevronDown } from 'lucide-react';
import { EventFilter } from '../types';

interface SegmentationEvent {
  id: string;
  event_type: string;
  event_category: 'generic' | 'hospitality' | 'custom';
  filters: EventFilter[];
  label: string;
}

interface SegmentationViewProps {
  eventSchema: any;
}

interface SegmentationResult {
  event_id: string;
  event_label: string;
  metric_value: number;
  time_series: Array<{ date: string; value: number }>;
  breakdown: Array<{ group: string; value: number; secondary: number }>;
}

const SegmentationView: React.FC<SegmentationViewProps> = ({ eventSchema }) => {
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
  
  const [data, setData] = useState<SegmentationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  
  const API_BASE = 'http://localhost:8000';

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

  // Fetch data
  const fetchData = async () => {
    if (events.length === 0) return;
    
    setIsLoading(true);
    try {
      console.log('Fetching segmentation data with:', {
        events,
        measurement,
        time_period: timePeriod,
        group_by: groupBy,
        interval
      });
      
      const response = await fetch(`${API_BASE}/api/analytics/segmentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: events,
          measurement: measurement,
          time_period: timePeriod,
          group_by: groupBy,
          interval: interval
        })
      });
      
      console.log('Segmentation API response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Segmentation API result:', result);
        setData(result.results || []);
      } else {
        const errorText = await response.text();
        console.error('Segmentation API error:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching segmentation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [events, measurement, timePeriod, groupBy, interval]);

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

  // Prepare chart data (combine all time series)
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

  const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Measurement Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Measured as</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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

          {/* Time Period */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Time Period</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              value={timePeriod}
              onChange={(e) => setTimePeriod(Number(e.target.value))}
            >
              {timePeriodOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Group By */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Group By</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              value={groupBy || ''}
              onChange={(e) => setGroupBy(e.target.value || null)}
            >
              {groupByOptions.map(opt => (
                <option key={opt.id || 'none'} value={opt.id || ''}>{opt.name}</option>
              ))}
            </select>
          </div>

          {/* Interval */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Interval</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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

      {/* Events Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Events to Analyze</h3>
          <button
            onClick={handleAddEvent}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
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

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
        </div>
      )}

      {/* Results */}
      {!isLoading && data.length > 0 && (
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
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar size={20} className="text-purple-600" />
              Trend Over Time
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {data.map((result, index) => (
                  <Line
                    key={result.event_id}
                    type="monotone"
                    dataKey={result.event_id}
                    name={result.event_label}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
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
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={result.breakdown}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="group" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                        />
                        <Bar dataKey="value" fill={COLORS[index % COLORS.length]} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              ))}
            </div>
          )}

          {/* Insights */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <TrendingUp size={20} className="text-purple-600" />
              💡 Segmentation Insights
            </h3>
            <div className="space-y-2">
              {data.map((result, index) => {
                const trend = result.time_series.length > 1 
                  ? ((result.time_series[result.time_series.length - 1].value - result.time_series[0].value) / result.time_series[0].value * 100)
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

      {/* Empty State */}
      {!isLoading && data.length === 0 && events.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BarChart3 size={64} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">Start Analyzing Events</h3>
          <p className="text-slate-600 mb-6">
            Add events to compare user behavior and discover insights
          </p>
          <button
            onClick={handleAddEvent}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Add Your First Event
          </button>
        </div>
      )}
    </div>
  );
};

export default SegmentationView;
