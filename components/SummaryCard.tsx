import React from 'react';
import { BarChart3 } from 'lucide-react';

interface SummaryCardProps {
  summary: string;
  primaryMetric?: string;
  primaryValue?: string | number;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  summary,
  primaryMetric,
  primaryValue,
}) => {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[#0947A4]/10 text-[#0947A4] flex-shrink-0">
          <BarChart3 size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
          {primaryMetric != null && primaryValue != null && (
            <p className="mt-2 text-xs font-medium text-slate-500">
              {primaryMetric}: <span className="text-slate-800">{primaryValue}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SummaryCard;
