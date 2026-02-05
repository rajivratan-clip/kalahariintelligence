import React from 'react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { Sparkles, Users, User, Zap, AlertCircle, DollarSign } from 'lucide-react';
import { SegmentData } from '../types';

interface SegmentStudioProps {
  onExplain: (title: string, data: any) => void;
}

const SEGMENT_A: SegmentData = {
  id: 'families',
  name: 'Families (3+ Guests)',
  bookingVelocity: 65, // Low is better (fast) but for chart we normalize 0-100 where 100 is best
  frictionIndex: 85, // High means high friction
  priceSensitivity: 70,
  intentScore: 40,
  avgCartValue: 1250,
};

const SEGMENT_B: SegmentData = {
  id: 'couples',
  name: 'Couples (2 Guests)',
  bookingVelocity: 90,
  frictionIndex: 20,
  priceSensitivity: 40,
  intentScore: 85,
  avgCartValue: 680,
};

// Normalized data for Radar Chart
const RADAR_DATA = [
  { subject: 'Booking Velocity', A: SEGMENT_A.bookingVelocity, B: SEGMENT_B.bookingVelocity, fullMark: 100 },
  { subject: 'Friction Index', A: SEGMENT_A.frictionIndex, B: SEGMENT_B.frictionIndex, fullMark: 100 },
  { subject: 'Price Sensitivity', A: SEGMENT_A.priceSensitivity, B: SEGMENT_B.priceSensitivity, fullMark: 100 },
  { subject: 'Intent Score', A: SEGMENT_A.intentScore, B: SEGMENT_B.intentScore, fullMark: 100 },
];

const MetricCard = ({ label, valA, valB, icon: Icon, inverse = false, isCurrency = false }: any) => {
    const diff = valA - valB;
    const isABetter = inverse ? valA < valB : valA > valB;
    
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 mb-2 text-sm font-medium">
                <Icon size={16} />
                {label}
            </div>
            <div className="flex justify-between items-end">
                <div>
                    <div className="text-2xl font-bold text-slate-800">
                        {isCurrency && '$'}{valA}
                    </div>
                    <div className="text-xs text-indigo-600 font-semibold">{SEGMENT_A.name}</div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-slate-800">
                         {isCurrency && '$'}{valB}
                    </div>
                    <div className="text-xs text-pink-600 font-semibold">{SEGMENT_B.name}</div>
                </div>
            </div>
             <div className={`mt-3 text-xs text-center py-1 rounded ${isABetter ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {Math.abs(diff)} {isCurrency ? '' : 'points'} {isABetter ? 'Advantage' : 'Gap'}
             </div>
        </div>
    )
}

const SegmentStudio: React.FC<SegmentStudioProps> = ({ onExplain }) => {
  return (
    <div className="h-full flex flex-col gap-6 p-6 overflow-y-auto">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Segment Studio</h2>
          <p className="text-slate-500">Cohort Duel: Behavioral benchmarking.</p>
        </div>
        <button 
           onClick={() => onExplain('Cohort Comparison: Families vs Couples', { SEGMENT_A, SEGMENT_B, RADAR_DATA })}
           className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
        >
          <Sparkles size={16} />
          Compare with AI
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Radar Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="font-semibold text-slate-800">Behavioral DNA</h3>
                 <div className="flex gap-4 text-sm">
                     <span className="flex items-center gap-1 text-indigo-600 font-medium"><div className="w-3 h-3 rounded-full bg-indigo-500"></div> {SEGMENT_A.name}</span>
                     <span className="flex items-center gap-1 text-pink-600 font-medium"><div className="w-3 h-3 rounded-full bg-pink-500"></div> {SEGMENT_B.name}</span>
                 </div>
             </div>
             <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={RADAR_DATA}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name={SEGMENT_A.name} dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                    <Radar name={SEGMENT_B.name} dataKey="B" stroke="#ec4899" fill="#ec4899" fillOpacity={0.3} />
                    <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    </RadarChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Metric Cards */}
          <div className="space-y-4">
             <MetricCard 
                label="Intent Score" 
                valA={SEGMENT_A.intentScore} 
                valB={SEGMENT_B.intentScore} 
                icon={Zap}
             />
             <MetricCard 
                label="Friction Index" 
                valA={SEGMENT_A.frictionIndex} 
                valB={SEGMENT_B.frictionIndex} 
                icon={AlertCircle}
                inverse={true}
             />
              <MetricCard 
                label="Avg Cart Value" 
                valA={SEGMENT_A.avgCartValue} 
                valB={SEGMENT_B.avgCartValue} 
                icon={DollarSign}
                isCurrency={true}
             />
          </div>
      </div>

       {/* Context Insight Banner */}
       <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 flex gap-4 items-start">
            <div className="bg-white p-2 rounded-full shadow-sm text-brand-600">
                <Users size={20} />
            </div>
            <div>
                <h4 className="font-semibold text-brand-900">Observation</h4>
                <p className="text-brand-800 text-sm mt-1">
                    Families show 45% higher friction scores than couples, primarily driven by the "Child Ages" input on Step 2. This correlates with a lower booking velocity.
                </p>
            </div>
       </div>
    </div>
  );
};

export default SegmentStudio;
