import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Hotel, TrendingUp, Users, Calendar, DollarSign, Star } from 'lucide-react';
import { FunnelDefinition } from '../types';

interface HospitalityMetricsViewProps {
  config: FunnelDefinition;
}

interface HospitalityData {
  adr: number;
  avg_length_of_stay: number;
  avg_booking_value: number;
  total_revenue: number;
  completed_bookings: number;
  segment_performance: Array<{
    segment: string;
    sessions: number;
    conversions: number;
    conversion_rate: number;
    avg_intent_score: number;
    avg_booking_value: number;
    avg_nights: number;
  }>;
  intent_distribution: Array<{
    intent_level: string;
    count: number;
    avg_potential_revenue: number;
  }>;
  ancillary_revenue_impact: {
    sessions_viewing_addons: number;
    avg_booking_with_addons: number;
    avg_booking_without_addons: number;
    addon_lift: number;
  };
  period_days: number;
  currency: string;
}

const HospitalityMetricsView: React.FC<HospitalityMetricsViewProps> = ({ config }) => {
  const [data, setData] = useState<HospitalityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const API_BASE = 'http://localhost:8000';

  useEffect(() => {
    const fetchHospitalityData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/analytics/hospitality-metrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
        
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Error fetching hospitality data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (config.steps.length > 0) {
      fetchHospitalityData();
    }
  }, [config]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Hotel size={48} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">No Hospitality Data Available</h3>
        <p className="text-slate-500">Configure your funnel to see hospitality metrics</p>
      </div>
    );
  }

  const SEGMENT_COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  const INTENT_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

  // Prepare intent distribution chart data
  const intentChartData = data.intent_distribution.map(item => ({
    name: item.intent_level,
    value: item.count,
    revenue: item.avg_potential_revenue
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-100 text-xs font-medium">ADR</span>
            <Hotel size={18} className="text-purple-100" />
          </div>
          <div className="text-2xl font-bold mb-1">${data.adr.toFixed(0)}</div>
          <div className="text-purple-100 text-xs">Avg Daily Rate</div>
        </div>

        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-pink-100 text-xs font-medium">LOS</span>
            <Calendar size={18} className="text-pink-100" />
          </div>
          <div className="text-2xl font-bold mb-1">{data.avg_length_of_stay.toFixed(1)}</div>
          <div className="text-pink-100 text-xs">Avg Nights</div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-amber-100 text-xs font-medium">ABV</span>
            <DollarSign size={18} className="text-amber-100" />
          </div>
          <div className="text-2xl font-bold mb-1">${data.avg_booking_value.toFixed(0)}</div>
          <div className="text-amber-100 text-xs">Avg Booking Value</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-100 text-xs font-medium">Revenue</span>
            <TrendingUp size={18} className="text-green-100" />
          </div>
          <div className="text-2xl font-bold mb-1">${(data.total_revenue / 1000).toFixed(0)}k</div>
          <div className="text-green-100 text-xs">Last {data.period_days} days</div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-100 text-xs font-medium">Bookings</span>
            <Star size={18} className="text-blue-100" />
          </div>
          <div className="text-2xl font-bold mb-1">{data.completed_bookings.toLocaleString()}</div>
          <div className="text-blue-100 text-xs">Completed</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Guest Segment Performance */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Users size={20} className="text-purple-600" />
            Guest Segment Performance
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.segment_performance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="segment" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar yAxisId="left" dataKey="conversions" fill="#8b5cf6" name="Conversions" radius={[8, 8, 0, 0]} />
              <Bar yAxisId="right" dataKey="conversion_rate" fill="#ec4899" name="Conv. Rate %" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Intent Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-green-600" />
            Booking Intent Distribution
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={intentChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {intentChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={INTENT_COLORS[index % INTENT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [value, 'Sessions']}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-xs text-slate-500 text-center mt-2">
            Non-converted sessions by intent level
          </div>
        </div>
      </div>

      {/* Ancillary Revenue Impact */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={24} className="text-emerald-600" />
          <h3 className="text-lg font-bold text-slate-900">💰 Ancillary Revenue Impact (Add-ons)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-emerald-200">
            <div className="text-xs text-slate-500 mb-1">Sessions Viewing Add-ons</div>
            <div className="text-2xl font-bold text-slate-900">
              {data.ancillary_revenue_impact.sessions_viewing_addons.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-emerald-200">
            <div className="text-xs text-slate-500 mb-1">With Add-ons</div>
            <div className="text-2xl font-bold text-emerald-600">
              ${data.ancillary_revenue_impact.avg_booking_with_addons.toFixed(0)}
            </div>
            <div className="text-xs text-slate-600 mt-1">Avg booking value</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-emerald-200">
            <div className="text-xs text-slate-500 mb-1">Without Add-ons</div>
            <div className="text-2xl font-bold text-slate-600">
              ${data.ancillary_revenue_impact.avg_booking_without_addons.toFixed(0)}
            </div>
            <div className="text-xs text-slate-600 mt-1">Avg booking value</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-emerald-300">
            <div className="text-xs text-slate-500 mb-1">Revenue Lift</div>
            <div className="text-3xl font-bold text-emerald-600">
              +{data.ancillary_revenue_impact.addon_lift.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-600 mt-1">From add-ons</div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-white rounded-lg border border-emerald-200">
          <p className="text-sm text-slate-700">
            <strong>📈 Insight:</strong> Guests who view add-ons have an average booking value that is{' '}
            <strong className="text-emerald-600">{data.ancillary_revenue_impact.addon_lift.toFixed(1)}% higher</strong>.
            {data.ancillary_revenue_impact.addon_lift > 0 && (
              <> Promoting add-ons could significantly increase your revenue per booking.</>
            )}
          </p>
        </div>
      </div>

      {/* Detailed Segment Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">📊 Detailed Segment Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Segment</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Sessions</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Conversions</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Conv. Rate</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Intent Score</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">ABV</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Avg Nights</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.segment_performance.map((segment, index) => (
                <tr key={segment.segment} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{segment.segment}</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-600">{segment.sessions.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-600">{segment.conversions.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-purple-600">{segment.conversion_rate.toFixed(1)}%</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-600">{segment.avg_intent_score.toFixed(0)}</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-600">${segment.avg_booking_value.toFixed(0)}</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-600">{segment.avg_nights.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HospitalityMetricsView;
