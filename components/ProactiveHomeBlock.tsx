import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, TrendingDown, BarChart3, Target, Lightbulb } from 'lucide-react';

interface Anomaly {
  anomaly_type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  detected_at: string;
  metric_value?: number;
  baseline_value?: number;
  metadata?: Record<string, unknown>;
}

interface ProactiveHomeBlockProps {
  onActionClick: (question: string) => void;
  isProcessing?: boolean;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

function formatAnomalyBullet(a: Anomaly): string {
  const desc = a.description || '';
  const meta = a.metadata || {};
  const pct = a.metric_value != null && a.baseline_value != null && a.baseline_value !== 0
    ? Math.round(((a.metric_value - a.baseline_value) / a.baseline_value) * 100)
    : null;
  if (desc.length > 0) return desc;
  if (a.anomaly_type === 'conversion_drop' && pct != null) {
    return `Conversion dropped ${Math.abs(pct)}% on ${(meta as any).segment || 'key segment'}`;
  }
  if (a.anomaly_type === 'revenue_deviation' && pct != null) {
    return pct < 0 ? `Revenue down ${Math.abs(pct)}% vs baseline` : `Revenue up ${pct}% vs baseline`;
  }
  if (a.anomaly_type === 'visitor_drop') {
    return 'Visitor volume dropped vs previous period';
  }
  return 'Unusual activity detected';
}

export const ProactiveHomeBlock: React.FC<ProactiveHomeBlockProps> = ({ onActionClick, isProcessing }) => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchAnomalies = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/ai/anomalies?limit=5');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.anomalies && Array.isArray(data.anomalies) && !cancelled) {
          setAnomalies(data.anomalies);
        }
      } catch {
        if (!cancelled) setAnomalies([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAnomalies();
    return () => { cancelled = true; };
  }, []);

  const greeting = getGreeting();
  const bullets = anomalies.slice(0, 3).map(formatAnomalyBullet);
  const hasAnomalies = bullets.length > 0;

  return (
    <div className="p-4 relative z-10 border-b border-slate-200/80 bg-white/60 backdrop-blur-sm">
      <h2 className="text-base font-semibold text-slate-800 mb-1">
        Good {greeting}, there
      </h2>
      <p className="text-xs text-slate-500 mb-3">Here&apos;s what&apos;s happening today:</p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
          <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-[#0947A4] rounded-full animate-spin" />
          Loading...
        </div>
      ) : hasAnomalies ? (
        <ul className="space-y-1.5 mb-4">
          {bullets.map((text, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              {anomalies[i]?.severity === 'high' ? (
                <TrendingDown size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              ) : (
                <TrendingUp size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
              )}
              <span>{text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600 mb-4">No significant anomalies in the last check. Ask anything to analyze your data.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onActionClick('Why did conversion drop? Investigate the biggest drop-off.')}
          disabled={isProcessing}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-50"
        >
          <AlertCircle size={14} />
          Investigate Drop
        </button>
        <button
          type="button"
          onClick={() => onActionClick('Show funnel for last 7 days')}
          disabled={isProcessing}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[#0947A4]/10 text-[#0947A4] hover:bg-[#0947A4]/20 border border-[#0947A4]/30 transition-colors disabled:opacity-50"
        >
          <BarChart3 size={14} />
          Show Funnel
        </button>
        <button
          type="button"
          onClick={() => onActionClick('Suggest fixes for the main conversion drop-off')}
          disabled={isProcessing}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-50"
        >
          <Lightbulb size={14} />
          Suggest Fix
        </button>
      </div>
    </div>
  );
};

export default ProactiveHomeBlock;
