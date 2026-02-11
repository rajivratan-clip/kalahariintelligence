import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DollarSign, TrendingDown, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { FunnelDefinition } from '../types';

interface RevenueImpactViewProps {
  config: FunnelDefinition;
}

interface RevenueData {
  total_revenue_at_risk: number;
  revenue_per_step: Array<{
    step: number;
    step_name: string;
    sessions_dropped: number;
    revenue_lost: number;
    avg_revenue_per_user: number;
    unconverted_count: number;
    unconverted_revenue: number;
  }>;
  segment_breakdown: Array<{
    segment_name: string;
    segment_id: string;
    revenue_lost: number;
    dropped_sessions: number;
    percentage_of_total: number;
  }>;
  improvement_opportunities: Array<{
    step: number;
    step_name: string;
    current_revenue_lost: number;
    if_reduce_10_percent: number;
    if_reduce_25_percent: number;
    if_reduce_50_percent: number;
  }>;
  period_days: number;
  currency: string;
  has_segments: boolean;
}

const RevenueImpactView: React.FC<RevenueImpactViewProps> = ({ config }) => {
  const [data, setData] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const API_BASE = 'http://localhost:8000';

  useEffect(() => {
    const fetchRevenueData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/analytics/revenue-impact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
        
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Error fetching revenue data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (config.steps.length > 0) {
      fetchRevenueData();
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
        <DollarSign size={48} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">No Revenue Data Available</h3>
        <p className="text-slate-500">Configure your funnel to see revenue impact analysis</p>
      </div>
    );
  }

  // Prepare chart data
  const chartData = data.revenue_per_step.map(step => ({
    name: step.step_name,
    revenue: step.revenue_lost,
    sessions: step.sessions_dropped
  }));

  const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16'];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-100 text-sm font-medium">Total Revenue at Risk</span>
            <AlertTriangle size={20} className="text-red-100" />
          </div>
          <div className="text-3xl font-bold mb-1">
            ${(data.total_revenue_at_risk / 1000).toFixed(1)}k
          </div>
          <div className="text-red-100 text-xs">
            Last {data.period_days} days
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-sm font-medium">Biggest Leak</span>
            <TrendingDown size={20} className="text-red-500" />
          </div>
          {data.revenue_per_step.length > 0 && (
            <>
              <div className="text-2xl font-bold text-slate-900 mb-1">
                {data.revenue_per_step[0].step_name}
              </div>
              <div className="text-slate-600 text-sm">
                ${(data.revenue_per_step[0].revenue_lost / 1000).toFixed(1)}k lost
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-sm font-medium">Avg Loss per User</span>
            <DollarSign size={20} className="text-amber-500" />
          </div>
          {data.revenue_per_step.length > 0 && (
            <>
              <div className="text-2xl font-bold text-slate-900 mb-1">
                ${data.revenue_per_step[0].avg_revenue_per_user.toFixed(0)}
              </div>
              <div className="text-slate-600 text-sm">
                Per dropped user
              </div>
            </>
          )}
        </div>
      </div>

      {/* Revenue Lost per Step Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">💰 Revenue Lost Per Step</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
            <Tooltip 
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue Lost']}
              contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}
            />
            <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Segment Breakdown */}
      {data.has_segments && data.segment_breakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">📊 Revenue Loss by Segment</h3>
          <div className="space-y-3">
            {data.segment_breakdown.map((segment, index) => (
              <div key={segment.segment_id} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-900">{segment.segment_name}</span>
                    <span className="text-sm font-bold text-slate-900">
                      ${(segment.revenue_lost / 1000).toFixed(1)}k
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500"
                      style={{ width: `${segment.percentage_of_total}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{segment.dropped_sessions.toLocaleString()} sessions</span>
                    <span>{segment.percentage_of_total}% of total</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement Opportunities */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowUpRight size={24} className="text-green-600" />
          <h3 className="text-lg font-bold text-slate-900">💡 What-If Scenarios</h3>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Projected revenue recovery if drop-off rates are reduced:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.improvement_opportunities.slice(0, 1).map(opp => (
            <React.Fragment key={opp.step}>
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <div className="text-xs text-slate-500 mb-1">Reduce by 10%</div>
                <div className="text-xl font-bold text-green-600">
                  +${(opp.if_reduce_10_percent / 1000).toFixed(1)}k
                </div>
                <div className="text-xs text-slate-600 mt-1">Quick wins</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-300">
                <div className="text-xs text-slate-500 mb-1">Reduce by 25%</div>
                <div className="text-xl font-bold text-green-600">
                  +${(opp.if_reduce_25_percent / 1000).toFixed(1)}k
                </div>
                <div className="text-xs text-slate-600 mt-1">Medium effort</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-400">
                <div className="text-xs text-slate-500 mb-1">Reduce by 50%</div>
                <div className="text-xl font-bold text-green-600">
                  +${(opp.if_reduce_50_percent / 1000).toFixed(1)}k
                </div>
                <div className="text-xs text-slate-600 mt-1">Major impact</div>
              </div>
            </React.Fragment>
          ))}
        </div>
        <div className="mt-4 p-3 bg-white rounded-lg border border-green-200">
          <p className="text-sm text-slate-700">
            <strong>💰 Total Annual Opportunity:</strong> If you reduce drop-off by 25% across all steps, 
            you could recover approximately <strong className="text-green-600">
              ${((data.total_revenue_at_risk * 0.25 * 365 / data.period_days) / 1000000).toFixed(2)}M
            </strong> per year.
          </p>
        </div>
      </div>

      {/* Detailed Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">📋 Step-by-Step Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Step</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Sessions Dropped</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Revenue Lost</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Avg per User</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Unconverted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.revenue_per_step.map((step, index) => (
                <tr key={step.step} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{step.step_name}</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-600">{step.sessions_dropped.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-red-600">
                    ${(step.revenue_lost / 1000).toFixed(1)}k
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-slate-600">${step.avg_revenue_per_user.toFixed(0)}</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-600">{step.unconverted_count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RevenueImpactView;
