import React from 'react';

export interface FunnelStepData {
  step_name: string;
  visitors: number;
  conversion_rate: number;
  drop_off_count: number;
  drop_off_rate: number;
}

interface FunnelChartCardProps {
  chartData: FunnelStepData[];
  deltaVsLastPeriod?: string; // e.g. "-18% vs last week"
}

export const FunnelChartCard: React.FC<FunnelChartCardProps> = ({
  chartData,
  deltaVsLastPeriod,
}) => {
  const maxVisitors = Math.max(...chartData.map((s) => s.visitors), 1);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-800">Funnel</h4>
        {deltaVsLastPeriod && (
          <span className="text-xs text-slate-500">{deltaVsLastPeriod}</span>
        )}
      </div>
      <div className="space-y-2">
        {chartData.map((step, i) => {
          const pct = maxVisitors ? (step.visitors / maxVisitors) * 100 : 0;
          return (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700">{step.step_name}</span>
                <span className="text-slate-600">
                  {step.visitors.toLocaleString()}
                  {step.drop_off_rate > 0 && (
                    <span className="ml-1 text-amber-600">
                      (−{step.drop_off_rate.toFixed(0)}%)
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0947A4] rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FunnelChartCard;
