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
import { 
  Plus, 
  X, 
  Sparkles, 
  TrendingDown, 
  Filter, 
  Settings, 
  ChevronDown, 
  MoreHorizontal,
  ArrowRight,
  Clock,
  Users,
  Search,
  Wand2,
  Trash2,
  MoveVertical
} from 'lucide-react';
import { FunnelStep, FunnelDefinition } from '../types';

interface FunnelLabProps {
  onExplain: (title: string, data: any) => void;
}

const EVENTS_CATALOG = [
  'Session Start', 'View Resort', 'View Room Detail', 'Check Availability', 
  'Select Dates', 'Add to Cart', 'Enter Guest Info', 'Payment', 'Booking Complete'
];

const DEFAULT_STEPS = [
  { id: '1', name: 'View Resort', filter: 'All Properties' },
  { id: '2', name: 'View Room Detail', filter: 'Suites Only' },
  { id: '3', name: 'Check Availability' },
  { id: '4', name: 'Payment' },
  { id: '5', name: 'Booking Complete' }
];

const FunnelLab: React.FC<FunnelLabProps> = ({ onExplain }) => {
  const [config, setConfig] = useState<FunnelDefinition>({
    steps: DEFAULT_STEPS,
    measure: 'guests',
    window: '7 Days',
    order: 'strict'
  });

  const [activeTab, setActiveTab] = useState<'conversion' | 'overTime' | 'timeToConvert'>('conversion');
  const [data, setData] = useState<FunnelStep[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);

  // Mock Data Generator based on config
  useEffect(() => {
    // Simulate API call / processing
    const generateData = () => {
      let currentVisitors = 15000 + Math.floor(Math.random() * 2000);
      const newData: FunnelStep[] = config.steps.map((step, index) => {
        const dropOffBase = 0.2 + (index * 0.05); // Increasing dropoff
        const visitors = Math.floor(currentVisitors);
        const nextVisitors = Math.floor(visitors * (1 - dropOffBase));
        const dropOffRate = Math.round(dropOffBase * 100);
        const conversionRate = 100 - dropOffRate;
        const revenueAtRisk = Math.floor(visitors * dropOffBase * 120); // Arbitrary calculation
        
        currentVisitors = nextVisitors;

        return {
          id: step.id,
          name: step.name,
          visitors: visitors,
          conversionRate,
          dropOffRate,
          revenueAtRisk,
          avgTime: `${2 + index}m ${10 + index * 5}s`,
          topFriction: index === 3 ? 'Payment Gateway Timeout' : index === 1 ? 'Slow Image Load' : 'Generic Friction'
        };
      });
      setData(newData);
    };

    generateData();
  }, [config]);

  const handleAiBuild = (e: React.FormEvent) => {
    e.preventDefault();
    setIsBuilding(true);
    // Simulate AI thinking and building configuration
    setTimeout(() => {
      if (aiPrompt.toLowerCase().includes('mobile')) {
         setConfig(prev => ({ ...prev, order: 'strict', window: '1 Day' }));
         // Add a 'Mobile' filter indication purely visual for MVP
      } else if (aiPrompt.toLowerCase().includes('families')) {
         setConfig(prev => ({
             ...prev,
             steps: [
                 { id: 'f1', name: 'View Resort' },
                 { id: 'f2', name: 'View Waterpark' },
                 { id: 'f3', name: 'Family Suite Detail' },
                 { id: 'f4', name: 'Booking Complete' }
             ]
         }));
      }
      setIsBuilding(false);
      setAiPrompt('');
    }, 1200);
  };

  const removeStep = (id: string) => {
    setConfig(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== id)
    }));
  };

  const addStep = () => {
    const nextEvent = EVENTS_CATALOG[config.steps.length % EVENTS_CATALOG.length];
    setConfig(prev => ({
      ...prev,
      steps: [...prev.steps, { id: Date.now().toString(), name: nextEvent }]
    }));
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload as FunnelStep;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 text-sm max-w-[200px]">
          <p className="font-bold mb-1">{d.name}</p>
          <div className="flex justify-between items-center mb-1">
             <span className="text-slate-400">Visitors:</span>
             <span className="font-mono">{d.visitors.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center mb-1 text-red-400">
             <span>Drop-off:</span>
             <span className="font-mono">{d.dropOffRate}%</span>
          </div>
          <div className="flex justify-between items-center text-orange-300">
             <span>Risk:</span>
             <span className="font-mono">${(d.revenueAtRisk / 1000).toFixed(1)}k</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full bg-slate-50">
      
      {/* Left Configuration Panel */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-full overflow-hidden">
        
        {/* AI Builder Input */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-1">
                <Wand2 size={12} className="text-purple-600" />
                AI Funnel Builder
            </label>
            <form onSubmit={handleAiBuild} className="relative">
                <input 
                    type="text" 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder='e.g., "Mobile bookings for families in Dec"' 
                    className="w-full pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none shadow-sm"
                />
                {isBuilding ? (
                    <div className="absolute right-2 top-2.5 animate-spin text-brand-500"><Sparkles size={14} /></div>
                ) : (
                    <button type="submit" className="absolute right-2 top-2.5 text-slate-400 hover:text-brand-600">
                        <ArrowRight size={14} />
                    </button>
                )}
            </form>
        </div>

        {/* Configuration Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* Steps Section */}
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-slate-800">Funnel Steps</h3>
                    <span className="text-xs text-slate-400">{config.steps.length} Steps</span>
                </div>
                
                <div className="space-y-2">
                    {config.steps.map((step, idx) => (
                        <div key={step.id} className="group flex items-center gap-2">
                            <div className="text-xs font-mono text-slate-400 w-4">{idx + 1}</div>
                            <div className="flex-1 bg-white border border-slate-200 rounded-md p-2 shadow-sm hover:border-brand-400 transition-colors cursor-pointer group-hover:shadow-md relative">
                                <div className="flex justify-between items-start">
                                    <div className="font-medium text-sm text-slate-700">{step.name}</div>
                                    <button onClick={() => removeStep(step.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                                {step.filter && (
                                    <div className="mt-1 inline-flex items-center text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                        <Filter size={8} className="mr-1" /> {step.filter}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <button 
                        onClick={addStep}
                        className="w-full py-2 border border-dashed border-slate-300 rounded-md text-sm text-slate-500 hover:text-brand-600 hover:border-brand-400 flex items-center justify-center gap-1 transition-all"
                    >
                        <Plus size={14} /> Add Step
                    </button>
                </div>
            </div>

            {/* Segmentation */}
            <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Segment By</h3>
                <div className="space-y-2">
                     <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Users size={14} />
                            <span>Guest Type</span>
                        </div>
                        <ChevronDown size={14} className="text-slate-400" />
                     </div>
                     <div className="text-xs text-brand-600 font-medium cursor-pointer hover:underline">+ Add Segmentation</div>
                </div>
            </div>

             {/* Settings */}
             <div className="space-y-4 pt-4 border-t border-slate-100">
                <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Measured As</label>
                    <select 
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:border-brand-500"
                        value={config.measure}
                        onChange={(e) => setConfig({...config, measure: e.target.value as any})}
                    >
                        <option value="guests">Unique Guests</option>
                        <option value="sessions">Sessions</option>
                        <option value="bookings">Bookings</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Conversion Window</label>
                    <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-1.5">
                        <Clock size={14} className="text-slate-400" />
                        <select 
                            className="bg-transparent outline-none w-full"
                            value={config.window}
                            onChange={(e) => setConfig({...config, window: e.target.value})}
                        >
                            <option>1 Day</option>
                            <option>7 Days</option>
                            <option>30 Days</option>
                        </select>
                    </div>
                </div>
             </div>
        </div>
      </div>

      {/* Right Visualization Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        
        {/* Toolbar */}
        <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
            <div className="flex gap-6 h-full">
                <button 
                    onClick={() => setActiveTab('conversion')}
                    className={`h-full border-b-2 px-1 text-sm font-medium transition-colors ${activeTab === 'conversion' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Conversion
                </button>
                <button 
                    onClick={() => setActiveTab('overTime')}
                    className={`h-full border-b-2 px-1 text-sm font-medium transition-colors ${activeTab === 'overTime' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Over Time
                </button>
                <button 
                    onClick={() => setActiveTab('timeToConvert')}
                    className={`h-full border-b-2 px-1 text-sm font-medium transition-colors ${activeTab === 'timeToConvert' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Time to Convert
                </button>
            </div>
            
            <button 
              onClick={() => onExplain('Funnel Explorer Analysis', { config, data })}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md text-sm font-medium hover:bg-indigo-100 hover:border-indigo-200 transition-all"
            >
              <Sparkles size={14} />
              AI Insights
            </button>
        </div>

        {/* Main Chart Stage */}
        <div className="flex-1 p-6 overflow-y-auto">
            {/* Summary Metrics */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-500 text-xs font-medium uppercase mb-1">Total Conversion</div>
                    <div className="text-2xl font-bold text-slate-800">
                        {data.length > 0 ? ((data[data.length - 1].visitors / data[0].visitors) * 100).toFixed(1) : 0}%
                    </div>
                    <div className="text-xs text-green-600 mt-1 flex items-center">
                        <TrendingDown size={12} className="rotate-180 mr-1" /> +2.4% vs last {config.window}
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-500 text-xs font-medium uppercase mb-1">Dropped Off</div>
                    <div className="text-2xl font-bold text-slate-800">
                         {data.length > 0 ? (data[0].visitors - data[data.length-1].visitors).toLocaleString() : 0}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Guests lost</div>
                </div>
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-500 text-xs font-medium uppercase mb-1">Revenue at Risk</div>
                    <div className="text-2xl font-bold text-slate-800">
                         ${data.reduce((acc, curr) => acc + curr.revenueAtRisk, 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-red-500 mt-1 font-medium">High Alert</div>
                </div>
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-500 text-xs font-medium uppercase mb-1">Avg Time to Convert</div>
                    <div className="text-2xl font-bold text-slate-800">14m 20s</div>
                    <div className="text-xs text-slate-400 mt-1">Median duration</div>
                </div>
            </div>

            {/* Chart Container */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-h-[400px]">
                {activeTab === 'conversion' && (
                    <div className="h-[400px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={data} 
                                layout="vertical" 
                                margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                                barCategoryGap={20}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 12, fill: '#475569'}} />
                                <Tooltip cursor={{fill: '#f1f5f9'}} content={<CustomTooltip />} />
                                <Bar dataKey="visitors" radius={[0, 4, 4, 0]} barSize={40}>
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === data.length - 1 ? '#10b981' : '#3b82f6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
                 {activeTab === 'overTime' && (
                    <div className="h-[400px] w-full flex items-center justify-center text-slate-400">
                         {/* Placeholder for Over Time Line Chart */}
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={Array.from({length: 14}, (_, i) => ({
                                name: `Day ${i+1}`,
                                value: 40 + Math.random() * 20
                            }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#94a3b8" />
                                <YAxis tick={{fontSize: 12}} stroke="#94a3b8" />
                                <Tooltip />
                                <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.2} />
                            </AreaChart>
                         </ResponsiveContainer>
                    </div>
                )}
                {activeTab === 'timeToConvert' && (
                    <div className="h-[400px] w-full flex items-center justify-center text-slate-400">
                         <div className="text-center">
                             <Clock size={48} className="mx-auto mb-4 opacity-50" />
                             <p>Time Distribution Histogram</p>
                             <p className="text-xs mt-2">Median: 14m | P95: 45m</p>
                         </div>
                    </div>
                )}
            </div>

            {/* Detailed Table */}
            <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                        <tr>
                            <th className="p-4">Step Name</th>
                            <th className="p-4">Visitors</th>
                            <th className="p-4">Conversion</th>
                            <th className="p-4">Drop-off</th>
                            <th className="p-4">Avg Time</th>
                            <th className="p-4">Top Friction</th>
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
                                <td className="p-4 text-slate-500">{row.avgTime}</td>
                                <td className="p-4">
                                    {row.topFriction && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-50 text-red-600 border border-red-100">
                                            <TrendingDown size={10} /> {row.topFriction}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
      </div>
    </div>
  );
};

export default FunnelLab;
