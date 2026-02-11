import React, { useState, useEffect } from 'react';
import { 
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  Radar, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Cell
} from 'recharts';
import { 
  Sparkles, 
  Users, 
  DollarSign, 
  TrendingUp,
  Filter,
  Settings,
  AlertTriangle,
  Zap,
  Target,
  BarChart3,
  Activity,
  ChevronDown
} from 'lucide-react';

interface SegmentStudioProps {
  onExplain: (title: string, data: any) => void;
}

// Pre-defined Hospitality Segments
const HOSPITALITY_SEGMENTS = [
  { value: 'all', label: 'All Users', color: '#64748b' },
  { value: 'family', label: 'Families', color: '#3b82f6', filter: "guest_segment = 'family_with_young_kids'" },
  { value: 'luxury', label: 'Luxury Seekers', color: '#8b5cf6', filter: "guest_segment = 'luxury'" },
  { value: 'couple', label: 'Couples', color: '#ec4899', filter: "guest_segment = 'couple'" },
  { value: 'business', label: 'Business Travelers', color: '#10b981', filter: "guest_segment = 'business'" },
];

// Forensic Segments (Advanced)
const FORENSIC_SEGMENTS = [
  { 
    value: 'price_sensitive', 
    label: 'Price Sensitive', 
    color: '#f59e0b', 
    filter: "price_sensitivity_score > 0.7",
    description: 'Users who only book with discounts'
  },
  { 
    value: 'high_friction', 
    label: 'High Friction (Lost Revenue)', 
    color: '#ef4444', 
    filter: "friction_score > 0.6 AND converted = 0",
    description: 'Wanted to book but got stuck'
  },
  { 
    value: 'urgent_family', 
    label: 'Urgent Families', 
    color: '#06b6d4', 
    filter: "guest_segment = 'family_with_young_kids' AND urgency_score > 0.8",
    description: 'Booking for school holidays/immediate weekends'
  },
  { 
    value: 'returning', 
    label: 'Returning Guests', 
    color: '#14b8a6', 
    filter: "is_returning_visitor = true",
    description: 'Loyal repeat customers'
  },
];

// Event types
const EVENT_TYPES = [
  { value: 'Page View', label: 'Page View' },
  { value: 'Room Select', label: 'Room Select' },
  { value: 'Date Select', label: 'Date Select' },
  { value: 'Add to Cart', label: 'Add to Cart' },
  { value: 'Payment', label: 'Payment' },
  { value: 'Confirmation', label: 'Confirmation' },
  { value: 'View Amenities', label: 'View Amenities' },
  { value: 'View Dining', label: 'View Dining' },
];

// Measurement types
const MEASUREMENT_TYPES = [
  { value: 'count', label: 'Total Count', icon: BarChart3 },
  { value: 'unique_users', label: 'Unique Users', icon: Users },
  { value: 'sum_revenue', label: 'Total Revenue', icon: DollarSign },
  { value: 'avg_session_duration', label: 'Avg Session Time', icon: Activity },
];

// Visualization modes
const VIZ_MODES = [
  { value: 'trend', label: 'Trend (Over Time)', icon: TrendingUp },
  { value: 'distribution', label: 'Distribution (Bar Chart)', icon: BarChart3 },
  { value: 'benchmark', label: 'Benchmark (vs Average)', icon: Target },
];

const SegmentStudio: React.FC<SegmentStudioProps> = ({ onExplain }) => {
  // Control Panel State
  const [selectedEvent, setSelectedEvent] = useState('Page View');
  const [selectedSegments, setSelectedSegments] = useState<string[]>(['family', 'couple']);
  const [selectedMeasurement, setSelectedMeasurement] = useState('unique_users');
  const [selectedVizMode, setSelectedVizMode] = useState('trend');
  const [showForensic, setShowForensic] = useState(false);
  
  // Data State
  const [segmentData, setSegmentData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mock data generator (replace with actual API call)
  const generateMockData = () => {
    setIsLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      if (selectedVizMode === 'trend') {
        // Time series data
        const data = [];
        const dates = ['Jan 1', 'Jan 8', 'Jan 15', 'Jan 22', 'Jan 29', 'Feb 5'];
        for (const date of dates) {
          const row: any = { date };
          selectedSegments.forEach(seg => {
            const segment = [...HOSPITALITY_SEGMENTS, ...FORENSIC_SEGMENTS].find(s => s.value === seg);
            if (segment) {
              row[segment.label] = Math.floor(Math.random() * 5000) + 1000;
            }
          });
          data.push(row);
        }
        setSegmentData(data);
      } else if (selectedVizMode === 'distribution') {
        // Bar chart data by property
        const data = [
          { property: 'Sandusky, OH', ...Object.fromEntries(selectedSegments.map(seg => {
            const segment = [...HOSPITALITY_SEGMENTS, ...FORENSIC_SEGMENTS].find(s => s.value === seg);
            return [segment?.label || seg, Math.floor(Math.random() * 3000) + 500];
          })) },
          { property: 'Wisconsin Dells', ...Object.fromEntries(selectedSegments.map(seg => {
            const segment = [...HOSPITALITY_SEGMENTS, ...FORENSIC_SEGMENTS].find(s => s.value === seg);
            return [segment?.label || seg, Math.floor(Math.random() * 2500) + 400];
          })) },
          { property: 'Round Rock, TX', ...Object.fromEntries(selectedSegments.map(seg => {
            const segment = [...HOSPITALITY_SEGMENTS, ...FORENSIC_SEGMENTS].find(s => s.value === seg);
            return [segment?.label || seg, Math.floor(Math.random() * 2800) + 600];
          })) },
        ];
        setSegmentData(data);
      } else if (selectedVizMode === 'benchmark') {
        // Benchmark vs average
        const data = selectedSegments.map(seg => {
          const segment = [...HOSPITALITY_SEGMENTS, ...FORENSIC_SEGMENTS].find(s => s.value === seg);
          const value = Math.floor(Math.random() * 5000) + 1000;
          const average = 3500;
          return {
            segment: segment?.label || seg,
            value,
            average,
            diff: value - average,
            color: segment?.color || '#64748b'
          };
        });
        setSegmentData(data);
      }
      
      setIsLoading(false);
    }, 500);
  };

  useEffect(() => {
    generateMockData();
  }, [selectedEvent, selectedSegments, selectedMeasurement, selectedVizMode]);

  const toggleSegment = (segmentValue: string) => {
    if (selectedSegments.includes(segmentValue)) {
      setSelectedSegments(selectedSegments.filter(s => s !== segmentValue));
    } else {
      setSelectedSegments([...selectedSegments, segmentValue]);
    }
  };

  const getSegmentColor = (segmentLabel: string) => {
    const segment = [...HOSPITALITY_SEGMENTS, ...FORENSIC_SEGMENTS].find(s => s.label === segmentLabel);
    return segment?.color || '#64748b';
  };

  return (
    <div className="h-full flex flex-col gap-6 p-6 overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Segment Studio</h2>
          <p className="text-slate-500">Marketing Intelligence Explorer</p>
        </div>
        <button 
          onClick={() => onExplain('Segment Analysis', { 
            selectedEvent, 
            selectedSegments, 
            selectedMeasurement, 
            segmentData 
          })}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-all"
        >
          <Sparkles size={16} />
          AI Insights
        </button>
      </div>

      {/* Unified Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 1. PERFORMED Block */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Activity size={16} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Performed</h3>
              <p className="text-xs text-slate-500">Event Selection</p>
            </div>
          </div>
          
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {EVENT_TYPES.map(event => (
              <option key={event.value} value={event.value}>{event.label}</option>
            ))}
          </select>

          <div className="mt-3 pt-3 border-t border-slate-100">
            <label className="text-xs font-medium text-slate-600 block mb-2">Measured As</label>
            <select
              value={selectedMeasurement}
              onChange={(e) => setSelectedMeasurement(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {MEASUREMENT_TYPES.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
                 </div>
             </div>

        {/* 2. SEGMENTED BY Block */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users size={16} className="text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Segmented By</h3>
              <p className="text-xs text-slate-500">Personas & Cohorts</p>
             </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            <div className="text-xs font-medium text-slate-600 mb-2">Pre-Defined Segments</div>
            {HOSPITALITY_SEGMENTS.filter(s => s.value !== 'all').map(segment => (
              <button
                key={segment.value}
                onClick={() => toggleSegment(segment.value)}
                className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-all flex items-center justify-between ${
                  selectedSegments.includes(segment.value)
                    ? 'bg-blue-50 border-2 border-blue-500 font-medium'
                    : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }}></div>
                  {segment.label}
                </div>
                {selectedSegments.includes(segment.value) && (
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                )}
              </button>
            ))}

            <button
              onClick={() => setShowForensic(!showForensic)}
              className="w-full px-3 py-2 mt-3 bg-amber-50 border border-amber-200 rounded-lg text-left text-sm font-medium text-amber-700 hover:bg-amber-100 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Zap size={14} />
                Forensic Segments
              </div>
              <ChevronDown size={14} className={`transition-transform ${showForensic ? 'rotate-180' : ''}`} />
            </button>

            {showForensic && (
              <div className="space-y-2 mt-2">
                {FORENSIC_SEGMENTS.map(segment => (
                  <button
                    key={segment.value}
                    onClick={() => toggleSegment(segment.value)}
                    className={`w-full px-3 py-2 rounded-lg text-left text-xs transition-all ${
                      selectedSegments.includes(segment.value)
                        ? 'bg-amber-50 border-2 border-amber-500 font-medium'
                        : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: segment.color }}></div>
                        <span className="font-medium">{segment.label}</span>
                      </div>
                      {selectedSegments.includes(segment.value) && (
                        <div className="w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs">{segment.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
      </div>

        {/* 3. MEASURED AS Block */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Visualization</h3>
              <p className="text-xs text-slate-500">Chart Type</p>
            </div>
          </div>

          <div className="space-y-2">
            {VIZ_MODES.map(mode => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.value}
                  onClick={() => setSelectedVizMode(mode.value)}
                  className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-all flex items-center gap-2 ${
                    selectedVizMode === mode.value
                      ? 'bg-green-50 border-2 border-green-500 font-medium'
                      : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={14} />
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Visualization Area */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-slate-800">{selectedEvent} - {MEASUREMENT_TYPES.find(m => m.value === selectedMeasurement)?.label}</h3>
            <p className="text-sm text-slate-500">{selectedSegments.length} segments selected</p>
          </div>
          {selectedSegments.length === 0 && (
            <div className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">
              Select at least one segment to view data
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-slate-400">Loading data...</div>
          </div>
        ) : selectedSegments.length === 0 ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <Users size={48} className="mx-auto mb-2 opacity-50" />
              <p>Select segments from the control panel</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            {selectedVizMode === 'trend' ? (
              <LineChart data={segmentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Legend />
                {selectedSegments.map(seg => {
                  const segment = [...HOSPITALITY_SEGMENTS, ...FORENSIC_SEGMENTS].find(s => s.value === seg);
                  return segment ? (
                    <Line
                      key={seg}
                      type="monotone"
                      dataKey={segment.label}
                      stroke={segment.color}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ) : null;
                })}
              </LineChart>
            ) : selectedVizMode === 'distribution' ? (
              <BarChart data={segmentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="property" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Legend />
                {selectedSegments.map(seg => {
                  const segment = [...HOSPITALITY_SEGMENTS, ...FORENSIC_SEGMENTS].find(s => s.value === seg);
                  return segment ? (
                    <Bar key={seg} dataKey={segment.label} fill={segment.color} />
                  ) : null;
                })}
              </BarChart>
            ) : (
              <BarChart data={segmentData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis dataKey="segment" type="category" tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="value" name="Segment Value">
                  {segmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
                <Bar dataKey="average" name="Average" fill="#94a3b8" opacity={0.5} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Intelligence Insights */}
      {selectedSegments.includes('high_friction') && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900 mb-1">High Friction Segment Detected</h4>
              <p className="text-sm text-red-700">
                These users wanted to book but encountered friction. Consider triggering automated recovery emails 
                with a "Hassle-Free Booking" link or live chat support.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedSegments.includes('price_sensitive') && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <DollarSign size={20} className="text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 mb-1">Price Sensitive Users</h4>
              <p className="text-sm text-amber-700">
                This segment only converts with discounts. Trigger "Last Minute Deal" popups or retargeting 
                campaigns with limited-time offers.
                </p>
            </div>
       </div>
        </div>
      )}
    </div>
  );
};

export default SegmentStudio;
